import { wristAngle, trackRotation } from './motion.js';
import { CONFIG, fanCommand } from './game.js';
import { chartFromBpm, segmentAt } from './chart.js';
import { SCORE_CFG, scoreStep, scoreStepSingle, targetOmegaFor, comboMultiplier, higherScore, gradeFor } from './score.js';
import { BUILTIN_TRACKS, bpmToStars } from './tracks.js';
import { formatCommand } from './protocol.js';
import { connectSerial, simSender } from './serial.js';
import { createPoseReader, pickArm } from './pose.js';
import { createUI } from './ui.js';
import { createMusicWidget } from './music.js';
import { loadSettings } from './settings.js';
import { createSettingsPanel } from './settings-panel.js';
import { createSelectScreen } from './select-screen.js';
import { updateHold } from './ready.js';
import { createLoadingScreen } from './loading.js';
import { preloadTracks } from './preload.js';
import { createModeModal } from './mode-modal.js';
import { sfx } from './sfx.js';

const video = document.getElementById('cam');
const mvVideo = document.getElementById('mv');
const canvas = document.getElementById('overlay');
const hud = document.getElementById('hud');

const ui = createUI(canvas);
ui.onComboBurst = (t) => sfx.comboBurst(t);

// ---- 連接 Arduino（放進「設定」彈窗，於選歌畫面設定；進遊戲後退場）----
const arduinoBtn = document.createElement('button');
arduinoBtn.textContent = '連接 Arduino';
arduinoBtn.style.cssText = 'background:#2b7bff;color:#0b0b12;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:700;';
const arduinoStatus = document.createElement('span');
arduinoStatus.style.cssText = 'color:#8f8;font-family:monospace;font-size:12px;';
arduinoStatus.textContent = '示範模式（無需 Arduino，直接開始也能玩）';

let sender = simSender((line) => { arduinoStatus.textContent = line; });
arduinoBtn.addEventListener('click', async () => {
  try { sender = await connectSerial(); arduinoBtn.textContent = '已連接 (USB)'; arduinoBtn.disabled = true; }
  catch (e) { alert(e.message); }
});

// 設定齒輪只在選歌畫面顯示，遊戲中退場
let sp = null;
function showControls(v) {
  if (sp) { sp.gear.style.display = v ? 'block' : 'none'; if (!v) sp.panel.style.display = 'none'; }
}

// ---- 遊戲狀態 ----
const READY_NEED = 5;
let phase = 'loading';
let mode = 'dual';
let media = null;
let selectScreen = null;
let selectedIdx = 0;
let lenMode = '2';
let chart = [];
let bpm = 120;
let roundSec = 120;
let startTime = 0;
let scoreA = { score: 0, combo: 0 };
let scoreB = { score: 0, combo: 0 };
let scoreS = { score: 0, combo: 0 };
const rotA = { lastAngle: null };
const rotB = { lastAngle: null };
const rotL = { lastAngle: null };
const rotR = { lastAngle: null };
const readyState = { need: READY_NEED, A: { hold: 0, ready: false }, B: { hold: 0, ready: false } };
let ended = false;
let last = performance.now();
let modeModal = null;

function startReady() {
  video.style.opacity = '';
  readyState.A = { hold: 0, ready: false };
  readyState.B = { hold: 0, ready: false };
  phase = 'ready';
}

function startPlaying() {
  const t = media.tracks[selectedIdx];
  bpm = t.bpm || 120;
  const songLen = Number.isFinite(mvVideo.duration) ? mvVideo.duration : 120;
  roundSec = lenMode === '2' ? Math.min(120, songLen) : songLen;
  chart = chartFromBpm(bpm, bpmToStars(bpm), roundSec);
  scoreA = { score: 0, combo: 0 };
  scoreB = { score: 0, combo: 0 };
  ended = false;
  media.playTrack(selectedIdx);
  scoreS = { score: 0, combo: 0 };
  rotL.lastAngle = null; rotR.lastAngle = null;
  video.style.opacity = '0'; // 開打隱藏攝影機，只看 MV + 手
  startTime = performance.now();
  last = startTime;
  phase = 'playing';
  mvVideo.addEventListener('loadedmetadata', () => {
    const sl = mvVideo.duration;
    if (Number.isFinite(sl)) { roundSec = lenMode === '2' ? Math.min(120, sl) : sl; chart = chartFromBpm(bpm, bpmToStars(bpm), roundSec); }
  }, { once: true });
}

function sendStop() {
  sender.send(formatCommand({ dir: 'S', pwm: 0, energy: 0 }, { dir: 'S', pwm: 0, energy: 0 })).catch(() => {});
}

async function boot() {
  const loading = createLoadingScreen(hud);

  // 並行：抓相機 + 預載所有 MV 大檔
  const camP = navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })
    .then(async (stream) => { video.srcObject = stream; await video.play(); });
  const preP = preloadTracks(BUILTIN_TRACKS, (p) => loading.progress(p));
  const [, blobs] = await Promise.all([camP, preP]);

  // 換成 blob URL（播放即時，不再重抓）
  for (const b of blobs) {
    const t = BUILTIN_TRACKS.find((x) => x.id === b.id);
    if (t) t.src = b.url;
  }

  loading.status('載入辨識模型…');
  const pose = await createPoseReader(video);

  // 設定（並套用內建預設起播秒數，如超跑情人夢第 5 秒）
  const settings = loadSettings(BUILTIN_TRACKS.map((t) => t.id));
  for (const t of BUILTIN_TRACKS) {
    const ps = settings.perTrack[t.id];
    if (t.start && ps && ps.start === 0) ps.start = t.start;
  }

  media = createMusicWidget(hud, mvVideo, video, settings, BUILTIN_TRACKS);
  sp = createSettingsPanel(hud, settings, media, { btn: arduinoBtn, status: arduinoStatus });
  selectScreen = createSelectScreen(hud, (idx, m) => {
    selectedIdx = idx; lenMode = m;
    modeModal.show();
  });
  modeModal = createModeModal(hud, (picked) => {
    mode = picked;
    selectScreen.hide(); showControls(false);
    startReady();
  });

  loading.progress(1);
  loading.hide();
  phase = 'select';
  selectScreen.show(media.tracks);
  showControls(true);
  loop(pose);
}

// 把 pose 座標（半張畫面像素）換算成 overlay canvas 像素（含左右鏡像）。
function toCanvas(pt, side) {
  const halfW = video.videoWidth / 2;
  // 對應 pose.js 的半邊對調：A=原始右半、B=原始左半
  const xInFull = (side === 'A' ? halfW : 0) + pt.x;
  const fx = video.videoWidth - xInFull; // CSS scaleX(-1) 鏡像
  return { x: (fx / video.videoWidth) * canvas.width, y: (pt.y / video.videoHeight) * canvas.height };
}

function toCanvasFull(pt) {
  const fx = video.videoWidth - pt.x; // 鏡像
  return { x: (fx / video.videoWidth) * canvas.width, y: (pt.y / video.videoHeight) * canvas.height };
}

async function loop(pose) {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  let handA = null, handB = null, handL = null, handR = null;
  let omegaA = 0, omegaB = 0, omegaL = 0, omegaR = 0;
  if (mode === 'single' && phase !== 'select') {
    const f = await pose.readFull();
    const pickL = f && f.leftWrist && f.leftShoulder && f.leftWrist.score > 0.3 ? { wrist: f.leftWrist, shoulder: f.leftShoulder } : null;
    const pickR = f && f.rightWrist && f.rightShoulder && f.rightWrist.score > 0.3 ? { wrist: f.rightWrist, shoulder: f.rightShoulder } : null;
    if (pickL) { const ang = wristAngle(pickL.wrist, pickL.shoulder); const r = trackRotation(rotL, ang, dt); rotL.lastAngle = r.state.lastAngle; omegaL = r.omega; handL = toCanvasFull(pickL.wrist); } else rotL.lastAngle = null;
    if (pickR) { const ang = wristAngle(pickR.wrist, pickR.shoulder); const r = trackRotation(rotR, ang, dt); rotR.lastAngle = r.state.lastAngle; omegaR = r.omega; handR = toCanvasFull(pickR.wrist); } else rotR.lastAngle = null;
    handA = handL; handB = handR;
  } else {
    const { A, B } = await pose.read();
    const armA = pickArm(A), armB = pickArm(B);
    if (armA) { const ang = wristAngle(armA.wrist, armA.shoulder); const r = trackRotation(rotA, ang, dt); rotA.lastAngle = r.state.lastAngle; omegaA = r.omega; handA = toCanvas(armA.wrist, 'A'); } else rotA.lastAngle = null;
    if (armB) { const ang = wristAngle(armB.wrist, armB.shoulder); const r = trackRotation(rotB, ang, dt); rotB.lastAngle = r.state.lastAngle; omegaB = r.omega; handB = toCanvas(armB.wrist, 'B'); } else rotB.lastAngle = null;
  }

  if (phase === 'select') {
    ui.clear();
    sendStop();
  } else if (phase === 'ready') {
    if (mode === 'single') {
      const both = !!(handL && handR);
      readyState.A = { ...updateHold(readyState.A.hold, both, dt, READY_NEED) };
      ui.drawReadySingle({ need: READY_NEED, hold: readyState.A.hold, ready: readyState.A.ready, handL, handR });
      if (readyState.A.ready) startPlaying();
    } else {
      const hitA = ui.boxHit(handA, 'A'), hitB = ui.boxHit(handB, 'B');
      readyState.A = { ...updateHold(readyState.A.hold, hitA, dt, READY_NEED) };
      readyState.B = { ...updateHold(readyState.B.hold, hitB, dt, READY_NEED) };
      ui.drawReady({ need: READY_NEED, A: { hand: handA, hold: readyState.A.hold, ready: readyState.A.ready }, B: { hand: handB, hold: readyState.B.hold, ready: readyState.B.ready } });
      if (readyState.A.ready && readyState.B.ready) startPlaying();
    }
    sendStop();
  } else if (phase === 'playing') {
    const elapsed = (performance.now() - startTime) / 1000;
    const timeLeft = Math.max(0, roundSec - elapsed);
    const { current, next, remain } = segmentAt(chart, elapsed);
    const segDir = current ? current.dir : 'S';
    const guideOmega = targetOmegaFor(bpm, SCORE_CFG);
    if (mode === 'single') {
      scoreS = scoreStepSingle(scoreS, segDir, omegaL, omegaR, dt, bpm, SCORE_CFG);
      const fa = fanCommand(omegaL, CONFIG), fb = fanCommand(omegaR, CONFIG);
      sender.send(formatCommand(
        { ...fa, energy: Math.min(100, scoreS.score / SCORE_CFG.scoreForFullBar * 100) },
        { ...fb, energy: Math.min(100, scoreS.score / SCORE_CFG.scoreForFullBar * 100) })).catch(() => {});
      const active = (om, hand) => segDir === 'S' ? !!hand : segDir === 'F' ? om > CONFIG.deadzone : om < -CONFIG.deadzone;
      ui.render({ mode: 'single', timeLeft, segDir, nextDir: next ? next.dir : null, nextIn: remain, guideOmega,
        barStyle: settings.barStyle,
        score: scoreS.score, comboMult: comboMultiplier(scoreS.combo, SCORE_CFG), handL, handR,
        lActive: active(omegaL, handL), rActive: active(omegaR, handR) });
      if (!ended && elapsed >= roundSec) {
        ended = true; phase = 'victory'; sendStop(); mvVideo.pause();
        ui.victory({ mode: 'single', score: scoreS.score, grade: gradeFor(scoreS.score, roundSec, SCORE_CFG) });
        setTimeout(() => { selectScreen.show(media.tracks); showControls(true); video.style.opacity = ''; phase = 'select'; }, 5000);
      }
    } else {
      scoreA = scoreStep(scoreA, segDir, omegaA, dt, bpm, SCORE_CFG);
      scoreB = scoreStep(scoreB, segDir, omegaB, dt, bpm, SCORE_CFG);
      const fa = fanCommand(omegaA, CONFIG), fb = fanCommand(omegaB, CONFIG);
      sender.send(formatCommand(
        { ...fa, energy: Math.min(100, scoreA.score / SCORE_CFG.scoreForFullBar * 100) },
        { ...fb, energy: Math.min(100, scoreB.score / SCORE_CFG.scoreForFullBar * 100) })).catch(() => {});
      ui.render({ mode: 'dual', timeLeft, segDir, nextDir: next ? next.dir : null, nextIn: remain, guideOmega,
        barStyle: settings.barStyle,
        A: { score: scoreA.score, comboMult: comboMultiplier(scoreA.combo, SCORE_CFG), hand: handA },
        B: { score: scoreB.score, comboMult: comboMultiplier(scoreB.combo, SCORE_CFG), hand: handB } });
      if (!ended && elapsed >= roundSec) {
        ended = true; phase = 'victory'; sendStop(); mvVideo.pause();
        ui.victory({ mode: 'dual', who: higherScore(scoreA.score, scoreB.score), scoreA: scoreA.score, scoreB: scoreB.score });
        setTimeout(() => { selectScreen.show(media.tracks); showControls(true); video.style.opacity = ''; phase = 'select'; }, 5000);
      }
    }
  }
  // phase 'loading'/'victory' 時不更新遊戲，等狀態切換

  requestAnimationFrame(() => loop(pose));
}

boot().catch((e) => alert('啟動失敗：' + e.message));
