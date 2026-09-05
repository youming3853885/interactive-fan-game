import { wristAngle, trackRotation } from './motion.js';
import { CONFIG, fanCommand } from './game.js';
import { chartFromBpm, segmentAt } from './chart.js';
import { SCORE_CFG, judgeBySpeed, revScore, targetOmegaFor, comboMultiplier, higherScore, gradeFor } from './score.js';
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
import { createModeModal } from './mode-modal.js';
import { preloadTracks } from './preload.js';
import { sfx } from './sfx.js';

const video = document.getElementById('cam');
const mvVideo = document.getElementById('mv');
const canvas = document.getElementById('overlay');
const hud = document.getElementById('hud');

const ui = createUI(canvas);
ui.onComboBurst = (t) => sfx.comboBurst(t);
let lastCountSec = -1; // 倒數滴答用
let victoryResult = null;

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
let settings = null;
let selectScreen = null;
let selectedIdx = 0;
let lenMode = '2';
let chart = [];
let bpm = 120;
let roundSec = 120;
let maxScore = 1;
let startTime = 0;
// 每個玩家狀態：score 分數、combo 圈數、mult 上次倍率、mAng marker 角度、mAcc marker 累積(判斷整圈)、
// oEMA 平滑角速度(判斷是否在轉)、active 是否在正確方向畫圈、oSum/oN 本圈平均轉速累計。
const newScore = () => ({ score: 0, combo: 0, mult: 1, mAng: -Math.PI / 2, mAcc: 0, spd: 0, oEMA: 0, active: false, oSum: 0, oN: 0 });
let scoreA = newScore();
let scoreB = newScore();
let scoreS = newScore();
const rotA = { lastAngle: null };
const rotB = { lastAngle: null };
const rotS = { lastAngle: null }; // 單人單手
// 手部顯示平滑（EMA 去抖，只影響畫面亮點/就位判定，不影響轉速計分）
const smA = { x: null, y: null, miss: 0 }, smB = { x: null, y: null, miss: 0 }, smS = { x: null, y: null, miss: 0 };
const SMOOTH = 0.3;  // 越小越穩但越延遲
const COAST = 10;    // 偵測掉幀時最多沿用上一位置的幀數（避免閃爍）
function smoothPoint(s, pt, a) {
  if (pt) {
    if (s.x == null) { s.x = pt.x; s.y = pt.y; } else { s.x += a * (pt.x - s.x); s.y += a * (pt.y - s.y); }
    s.miss = 0; return { x: s.x, y: s.y };
  }
  // 未偵測到：短暫沿用上一位置，超過 COAST 幀才真的消失
  if (s.x != null && ++s.miss <= COAST) return { x: s.x, y: s.y };
  s.x = null; return null;
}
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

// 本局理想最高分＝每圈都 PERFECT、combo 一路累積（能量條滿格＝達到此分）。
function estimateMaxScore(sec, b) {
  const ideal = (2 * Math.PI) / targetOmegaFor(b, SCORE_CFG);
  const revs = Math.max(1, Math.floor(sec / ideal));
  let s = 0; for (let i = 1; i <= revs; i++) s += revScore(i, 'PERFECT', SCORE_CFG);
  return s || 1;
}

function startPlaying() {
  const t = media.tracks[selectedIdx];
  bpm = t.bpm || 120;
  const songLen = Number.isFinite(mvVideo.duration) ? mvVideo.duration : 120;
  roundSec = lenMode === '2' ? Math.min(120, songLen) : songLen;
  chart = chartFromBpm(bpm, bpmToStars(bpm), roundSec);
  maxScore = estimateMaxScore(roundSec, bpm); // 本局理想最高分 → 能量條滿格基準
  scoreA = newScore();
  scoreB = newScore();
  ended = false;
  media.playTrack(selectedIdx);
  scoreS = newScore();
  rotA.lastAngle = null; rotB.lastAngle = null; rotS.lastAngle = null;
  video.style.opacity = '0'; // 開打隱藏攝影機，只看 MV + 手
  startTime = performance.now();
  last = startTime;
  lastCountSec = -1; victoryResult = null;
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

  // 一進網頁就把所有東西載好才能玩：相機 + 全部 MV 大檔（顯示進度）+ 辨識模型。
  const camP = navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })
    .then(async (stream) => { video.srcObject = stream; await video.play(); });
  loading.status('載入歌曲影片…');
  const [, blobs] = await Promise.all([camP, preloadTracks(BUILTIN_TRACKS, (p) => loading.progress(p * 0.9))]);
  // 換成 blob URL（播放即時、不再重抓）
  for (const b of blobs) { const t = BUILTIN_TRACKS.find((x) => x.id === b.id); if (t) t.src = b.url; }

  loading.status('載入辨識模型…');
  const pose = await createPoseReader(video);
  loading.progress(0.95);

  settings = loadSettings(BUILTIN_TRACKS.map((t) => t.id));

  media = createMusicWidget(hud, mvVideo, video, settings, BUILTIN_TRACKS);
  sp = createSettingsPanel(hud, settings, media, { btn: arduinoBtn, status: arduinoStatus });
  selectScreen = createSelectScreen(hud, (idx, m) => {
    selectedIdx = idx; lenMode = m;
    modeModal.show();
  });
  modeModal = createModeModal(hud, (picked) => {
    mode = picked;
    selectScreen.hide(); showControls(false);
    media.prep(selectedIdx); // 開始緩衝選中的 MV（利用 5 秒 ready 期間邊載）
    startReady();
  });

  loading.progress(1);
  loading.hide();
  phase = 'select';
  selectScreen.show(media.tracks);
  showControls(true);
  loop(pose);
}

// 半張座標→canvas 像素（含左右鏡像）。A=原始右半、B=原始左半。
function toCanvas(pt, side) {
  const halfW = video.videoWidth / 2;
  const xInFull = (side === 'A' ? halfW : 0) + pt.x;
  const fx = video.videoWidth - xInFull; // CSS scaleX(-1) 鏡像
  return { x: (fx / video.videoWidth) * canvas.width, y: (pt.y / video.videoHeight) * canvas.height };
}

// 把 pose 全畫面座標換算成 overlay canvas 像素（含左右鏡像）。
function toCanvasFull(pt) {
  const fx = video.videoWidth - pt.x; // 鏡像
  return { x: (fx / video.videoWidth) * canvas.width, y: (pt.y / video.videoHeight) * canvas.height };
}

// 在「螢幕座標(鏡像後)」算角速度 → 正轉F=螢幕順時針恆對應 omega>0，左右一致。
// 若實機發現方向相反，把 DIR_SIGN 改成 -1 即可整體翻轉。
const DIR_SIGN = 1;
function omegaScreen(rot, wrist, shoulder, mapFn, dt) {
  const a = wristAngle(mapFn(wrist), mapFn(shoulder));
  const r = trackRotation(rot, a, dt);
  rot.lastAngle = r.state.lastAngle;
  return DIR_SIGN * r.omega;
}

async function loop(pose) {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  let handA = null, handB = null, handS = null;
  let omegaA = 0, omegaB = 0, omegaS = 0;
  if (phase !== 'select') {
    if (mode === 'single') {
      const arm = pickArm(await pose.readFull());
      if (arm) { omegaS = omegaScreen(rotS, arm.wrist, arm.shoulder, toCanvasFull, dt); handS = toCanvasFull(arm.wrist); } else rotS.lastAngle = null;
      handS = smoothPoint(smS, handS, SMOOTH);
    } else {
      // 左右半邊各自偵測 → 保證每邊各抓到一位玩家（螢幕左=A、右=B）。
      const armA = pickArm(await pose.readHalf('A'));
      const armB = pickArm(await pose.readHalf('B'));
      if (armA) { omegaA = omegaScreen(rotA, armA.wrist, armA.shoulder, (p) => toCanvas(p, 'A'), dt); handA = toCanvas(armA.wrist, 'A'); } else rotA.lastAngle = null;
      if (armB) { omegaB = omegaScreen(rotB, armB.wrist, armB.shoulder, (p) => toCanvas(p, 'B'), dt); handB = toCanvas(armB.wrist, 'B'); } else rotB.lastAngle = null;
      handA = smoothPoint(smA, handA, SMOOTH); handB = smoothPoint(smB, handB, SMOOTH);
    }
  }

  if (phase === 'select') {
    ui.clear();
    sendStop();
  } else if (phase === 'ready') {
    if (mode === 'single') {
      const inTgt = ui.handInTarget(handS);
      readyState.A = { ...updateHold(readyState.A.hold, inTgt, dt, READY_NEED) };
      ui.drawReadySingle({ need: READY_NEED, hold: readyState.A.hold, ready: readyState.A.ready, hand: handS });
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
    const dirSign = segDir === 'R' ? -1 : 1;
    const energyOf = (om) => Math.min(100, Math.abs(om) / (guideOmega * 1.5) * 100);
    const endRound = (result, win) => {
      ended = true; phase = 'victory'; victoryResult = result; sendStop(); mvVideo.pause(); sfx.fanfare(win);
      setTimeout(() => { selectScreen.show(media.tracks); showControls(true); video.style.opacity = ''; phase = 'select'; }, 6000);
    };
    // 一位玩家：偵測「在正確方向畫圈」(平滑omega+遲滯)→ marker 以固定速度沿圈勻速跑；
    // marker 每跑滿一圈=完成一圈 → 用該圈平均轉速判定 PERFECT/GREAT/GOOD、加分/combo/特效音效。
    const ON = 1.2, OFF = 0.5; // 遲滯門檻（rad/s）
    const MAXW = 16; // marker 最高角速度上限（rad/s，避免爆衝）
    const stepPlayer = (st, omega, cx, cy, color) => {
      st.oEMA += 0.4 * (omega - st.oEMA); // 平滑真實角速度（跟手但不抖）
      const correctSign = dirSign > 0 ? st.oEMA > 0 : st.oEMA < 0;
      if (segDir === 'S') st.active = false;
      else if (!st.active && correctSign && Math.abs(st.oEMA) > ON) st.active = true;
      else if (st.active && (!correctSign || Math.abs(st.oEMA) < OFF)) st.active = false;
      // marker 速度＝跟隨你的真實轉速（平滑後），轉快就快、轉慢就慢；再做緩加減速避免硬啟停。
      const targetSpd = st.active ? Math.min(MAXW, Math.abs(st.oEMA)) : 0;
      st.spd += (targetSpd - st.spd) * Math.min(1, dt * 10);
      if (st.spd > 0.02) {
        st.mAng += dirSign * st.spd * dt;
        st.mAcc += st.spd * dt;
        if (st.active) { st.oSum += Math.abs(omega); st.oN += 1; }
        if (st.mAcc >= 2 * Math.PI) {
          st.mAcc -= 2 * Math.PI;
          const avg = st.oN ? st.oSum / st.oN : 0; st.oSum = 0; st.oN = 0;
          const j = judgeBySpeed(avg, bpm, SCORE_CFG);
          st.combo += 1;
          const pts = revScore(st.combo, j, SCORE_CFG); st.score += pts;
          const mult = comboMultiplier(st.combo, SCORE_CFG);
          const leveled = mult > st.mult; st.mult = mult;
          ui.judge(j, pts, mult, cx, cy, color);
          sfx.hit(mult >= 3);
          if (leveled) { sfx.comboBurst(mult); sfx.voice('Combo'); }
          else sfx.voice(j === 'PERFECT' ? 'Perfect' : j === 'GREAT' ? 'Great' : 'Good');
        }
      }
      return { markerAngle: st.mAng, active: st.active };
    };
    if (mode === 'single') {
      const m = stepPlayer(scoreS, omegaS, canvas.width * 0.5, canvas.height * 0.44, '#2b7bff');
      const fs = fanCommand(omegaS, CONFIG); const e = energyOf(omegaS);
      sender.send(formatCommand({ ...fs, energy: e }, { ...fs, energy: e })).catch(() => {});
      ui.render({ mode: 'single', timeLeft, segDir, nextDir: next ? next.dir : null, nextIn: remain, guideOmega, maxScore,
        barStyle: settings.barStyle, score: scoreS.score, combo: scoreS.combo, comboMult: comboMultiplier(scoreS.combo, SCORE_CFG),
        markerAngle: m.markerAngle, active: m.active });
      if (!ended && elapsed >= roundSec) endRound({ mode: 'single', score: scoreS.score, grade: gradeFor(scoreS.score, roundSec, bpm, SCORE_CFG) }, true);
    } else {
      const mA = stepPlayer(scoreA, omegaA, canvas.width * 0.25, canvas.height * 0.44, '#2b7bff');
      const mB = stepPlayer(scoreB, omegaB, canvas.width * 0.75, canvas.height * 0.44, '#ff3b3b');
      const fa = fanCommand(omegaA, CONFIG), fb = fanCommand(omegaB, CONFIG);
      sender.send(formatCommand({ ...fa, energy: energyOf(omegaA) }, { ...fb, energy: energyOf(omegaB) })).catch(() => {});
      ui.render({ mode: 'dual', timeLeft, segDir, nextDir: next ? next.dir : null, nextIn: remain, guideOmega, maxScore,
        barStyle: settings.barStyle,
        A: { score: scoreA.score, combo: scoreA.combo, comboMult: comboMultiplier(scoreA.combo, SCORE_CFG), markerAngle: mA.markerAngle, active: mA.active },
        B: { score: scoreB.score, combo: scoreB.combo, comboMult: comboMultiplier(scoreB.combo, SCORE_CFG), markerAngle: mB.markerAngle, active: mB.active } });
      if (!ended && elapsed >= roundSec) {
        const who = higherScore(scoreA.score, scoreB.score);
        endRound({ mode: 'dual', who, scoreA: scoreA.score, scoreB: scoreB.score }, !!who);
      }
    }
    // 倒數滴答（最後 10 秒每秒一聲，最後 3 秒更急）
    const sec = Math.ceil(timeLeft);
    if (timeLeft <= 10 && sec !== lastCountSec) { lastCountSec = sec; if (sec > 0) sfx.countTick(sec <= 3); }
  } else if (phase === 'victory') {
    if (victoryResult) ui.victory(victoryResult); // 逐幀播放華麗結算動畫
  }

  requestAnimationFrame(() => loop(pose));
}

boot().catch((e) => alert('啟動失敗：' + e.message));
