import { wristAngle, trackRotation } from './motion.js';
import { CONFIG, fanCommand } from './game.js';
import { chartFromBpm, segmentAt } from './chart.js';
import { SCORE_CFG, scoreStep, targetOmegaFor, comboMultiplier, higherScore } from './score.js';
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

const video = document.getElementById('cam');
const mvVideo = document.getElementById('mv');
const canvas = document.getElementById('overlay');
const hud = document.getElementById('hud');

const ui = createUI(canvas);

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
const rotA = { lastAngle: null };
const rotB = { lastAngle: null };
const readyState = { need: READY_NEED, A: { hold: 0, ready: false }, B: { hold: 0, ready: false } };
let ended = false;
let last = performance.now();

function startReady() {
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
  selectScreen = createSelectScreen(hud, (idx, mode) => {
    selectedIdx = idx;
    lenMode = mode;
    selectScreen.hide();
    showControls(false);
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

async function loop(pose) {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  const { A, B } = await pose.read();
  const armA = pickArm(A), armB = pickArm(B);

  let handA = null, handB = null;
  let omegaA = 0, omegaB = 0;

  if (armA) {
    const ang = wristAngle(armA.wrist, armA.shoulder);
    const r = trackRotation(rotA, ang, dt); rotA.lastAngle = r.state.lastAngle; omegaA = r.omega;
    handA = toCanvas(armA.wrist, 'A');
  } else { rotA.lastAngle = null; }

  if (armB) {
    const ang = wristAngle(armB.wrist, armB.shoulder);
    const r = trackRotation(rotB, ang, dt); rotB.lastAngle = r.state.lastAngle; omegaB = r.omega;
    handB = toCanvas(armB.wrist, 'B');
  } else { rotB.lastAngle = null; }

  if (phase === 'select') {
    ui.clear();
    sendStop();
  } else if (phase === 'ready') {
    const hitA = ui.boxHit(handA, 'A');
    const hitB = ui.boxHit(handB, 'B');
    readyState.A = { ...updateHold(readyState.A.hold, hitA, dt, READY_NEED) };
    readyState.B = { ...updateHold(readyState.B.hold, hitB, dt, READY_NEED) };
    ui.drawReady({
      need: READY_NEED,
      A: { hand: handA, hold: readyState.A.hold, ready: readyState.A.ready },
      B: { hand: handB, hold: readyState.B.hold, ready: readyState.B.ready },
    });
    sendStop();
    if (readyState.A.ready && readyState.B.ready) startPlaying();
  } else if (phase === 'playing') {
    const elapsed = (performance.now() - startTime) / 1000;
    const timeLeft = Math.max(0, roundSec - elapsed);
    const { current, next, remain } = segmentAt(chart, elapsed);
    const segDir = current ? current.dir : 'S';

    scoreA = scoreStep(scoreA, segDir, omegaA, dt, bpm, SCORE_CFG);
    scoreB = scoreStep(scoreB, segDir, omegaB, dt, bpm, SCORE_CFG);

    const fa = fanCommand(omegaA, CONFIG);
    const fb = fanCommand(omegaB, CONFIG);
    sender.send(formatCommand(
      { ...fa, energy: Math.min(100, (scoreA.score / SCORE_CFG.scoreForFullBar) * 100) },
      { ...fb, energy: Math.min(100, (scoreB.score / SCORE_CFG.scoreForFullBar) * 100) },
    )).catch(() => {});

    ui.render({
      timeLeft,
      segDir,
      nextDir: next ? next.dir : null,
      nextIn: remain,
      guideOmega: targetOmegaFor(bpm, SCORE_CFG),
      A: { score: scoreA.score, comboMult: comboMultiplier(scoreA.combo, SCORE_CFG), hand: handA, shoulder: armA ? toCanvas(armA.shoulder, 'A') : null },
      B: { score: scoreB.score, comboMult: comboMultiplier(scoreB.combo, SCORE_CFG), hand: handB, shoulder: armB ? toCanvas(armB.shoulder, 'B') : null },
    });

    if (!ended && elapsed >= roundSec) {
      ended = true;
      phase = 'victory';
      sendStop();
      const who = higherScore(scoreA.score, scoreB.score);
      ui.victory(who, scoreA.score, scoreB.score);
      setTimeout(() => { selectScreen.show(media.tracks); showControls(true); phase = 'select'; }, 4000);
    }
  }
  // phase 'loading'/'victory' 時不更新遊戲，等狀態切換

  requestAnimationFrame(() => loop(pose));
}

boot().catch((e) => alert('啟動失敗：' + e.message));
