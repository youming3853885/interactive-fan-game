import { circleStep, newCircleState, createArmPicker } from './motion.js';
import { CONFIG, fanRun } from './game.js';
import { chartFromBpm, segmentAt } from './chart.js';
import { SCORE_CFG, judgeBySpeed, revScore, targetOmegaFor, comboMultiplier, higherScore, gradeFor, maxScoreForChart, BAR_FULL_RATIO } from './score.js';
import { BUILTIN_TRACKS, bpmToStars, pickPlayback } from './tracks.js';
import { formatCommand, motorTestLine, effectLine, builtinLedLine, judgeFlashLine, urgentLine, FX } from './protocol.js';
import { connectSerial, simSender } from './serial.js';
import { createPoseReader } from './pose.js';
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
import { attachAnalyser } from './audio.js';

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
let usbPort = null; // 目前開著的埠，重選時先關掉
async function doConnect({ silent = false, picker = false } = {}) {
  try {
    if (usbPort) { try { await usbPort.close(); } catch { /* 忽略 */ } usbPort = null; } // 重選前先關舊埠
    // picker=true(手動按鈕) → 一定跳選埠視窗讓使用者挑；否則(Electron 自動)先用已授權的埠
    let port = null;
    if (!picker) { try { port = (await navigator.serial.getPorts())[0] || null; } catch { port = null; } }
    if (!port) port = await navigator.serial.requestPort();
    const usb = await connectSerial(115200, port);
    usbPort = usb.port;
    // 包一層：USB 送出時把指令回寫綠字；送出失敗就顯示錯誤（不再默默吞掉）
    sender = { name: 'USB', send: (line) => {
      arduinoStatus.textContent = line.trim(); // 保證先回寫(證明點擊有觸發，與寫入成敗無關)
      Promise.resolve(usb.send(line)).catch((err) => { arduinoStatus.textContent = '⚠ 送出失敗：' + (err && err.message || err); });
      return Promise.resolve();
    } };
    arduinoBtn.textContent = '已連接 (USB)｜點此重選 port'; // 保持可按，讓使用者能換 port
    // 開埠會重置 Nano → 跑自檢(6秒：風機1P+兩燈條慢閃)，期間指令會丟。鎖住測試按鈕，等自檢結束再送 T,1 驗證通訊。
    arduinoStatus.textContent = '已連接，Nano 自檢中(約8秒)，請稍候…';
    if (arduinoCtl.setTestEnabled) arduinoCtl.setTestEnabled(false);
    try {
      await new Promise((r) => setTimeout(r, 8500));
      await usb.send('T,1\n'); arduinoStatus.textContent = '✓ 通訊正常！Nano 內建燈應已亮起';
    } catch (err) { arduinoStatus.textContent = '✗ 送出失敗：' + (err && err.message || err); }
    finally { if (arduinoCtl.setTestEnabled) arduinoCtl.setTestEnabled(true); }
  } catch (e) { if (!silent) alert(e.message); }
}
arduinoBtn.addEventListener('click', () => doConnect({ picker: true })); // 手動一定跳選埠視窗

// 斷開/釋放埠：關閉目前埠(還給 IDE/其他程式) + 忘記所有已授權的埠(下次不再自動咬住舊埠)
const arduinoDisc = document.createElement('button');
arduinoDisc.textContent = '斷開/釋放埠';
arduinoDisc.style.cssText = 'background:#c0392b;color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:700;';
arduinoDisc.addEventListener('click', async () => {
  try {
    if (usbPort) { try { await usbPort.close(); } catch { /* 忽略 */ } usbPort = null; }
    try { const ports = await navigator.serial.getPorts(); for (const p of ports) { if (p.forget) await p.forget(); } } catch { /* 忽略 */ }
    sender = simSender((line) => { arduinoStatus.textContent = line; });
    arduinoBtn.textContent = '連接 Arduino'; arduinoBtn.disabled = false;
    arduinoStatus.textContent = '已斷開、埠已釋放（Arduino IDE 現在可用了）';
  } catch (e) { arduinoStatus.textContent = '斷開失敗：' + (e && e.message || e); }
});

// 傳給設定面板的硬體控制組；settings-panel 會掛上 setTestEnabled（自檢期間鎖測試按鈕用）
const arduinoCtl = {
  btn: arduinoBtn, status: arduinoStatus, disc: arduinoDisc,
  motorTest: (ch, pct) => sender.send(motorTestLine(ch, pct)).catch(() => {}),
  effect: (tgt, code) => sender.send(effectLine(tgt, code)).catch(() => {}),
  testLed: (on) => sender.send(builtinLedLine(on)).catch(() => {}),
};

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
let mvAnalyser = null, mvFreq = null; // MV 音樂即時頻譜（外框音波用）
let startTime = 0;
// 每個玩家狀態：score 分數、combo 圈數、mult 上次倍率、mAng marker 角度、mAcc marker 累積(判斷整圈)、
// oEMA 平滑角速度(判斷是否在轉)、active 是否在正確方向畫圈、oSum/oN 本圈平均轉速累計。
const newScore = () => ({ score: 0, combo: 0, mult: 1, mAng: -Math.PI / 2, mAcc: 0, spd: 0, oEMA: 0, active: false, oSum: 0, oN: 0 });
let scoreA = newScore();
let scoreB = newScore();
let scoreS = newScore();
// 動態圓心畫圈追蹤（取代舊的「手腕相對肩膀」角度法）+ 手臂鎖定（防左右手跳換）
const cirA = newCircleState(), cirB = newCircleState(), cirS = newCircleState();
const pickA = createArmPicker(), pickB = createArmPicker(), pickS = createArmPicker();
const resetCircle = (st) => { st.pts.length = 0; st.lastAngle = null; };
// 手部顯示去抖：One Euro 自適應濾波（慢動作重壓雜訊=穩、快動作放行=跟手不延遲）。
// 只影響畫面亮點/就位判定，不影響轉速計分。
const smA = newEuro(), smB = newEuro(), smS = newEuro();
const COAST = 8; // 偵測掉幀時最多沿用上一位置的幀數
const EURO_MINCUT = 1.7, EURO_BETA = 0.02, EURO_DCUT = 1.0;
function newEuro() { return { x: null, y: null, px: 0, py: 0, dx: 0, dy: 0, miss: 0 }; }
function smoothPoint(s, pt, dt) {
  if (!pt) { if (s.x != null && ++s.miss <= COAST) return { x: s.x, y: s.y }; s.x = null; return null; }
  s.miss = 0;
  if (s.x == null) { s.x = pt.x; s.y = pt.y; s.px = pt.x; s.py = pt.y; s.dx = 0; s.dy = 0; return { x: s.x, y: s.y }; }
  const d = Math.max(dt, 0.001);
  const alpha = (cut) => { const tau = 1 / (2 * Math.PI * cut); return 1 / (1 + tau / d); };
  const rdx = (pt.x - s.px) / d, rdy = (pt.y - s.py) / d; s.px = pt.x; s.py = pt.y;
  const ad = alpha(EURO_DCUT); s.dx += ad * (rdx - s.dx); s.dy += ad * (rdy - s.dy);
  const ax = alpha(EURO_MINCUT + EURO_BETA * Math.abs(s.dx));
  const ay = alpha(EURO_MINCUT + EURO_BETA * Math.abs(s.dy));
  s.x += ax * (pt.x - s.x); s.y += ay * (pt.y - s.y);
  return { x: s.x, y: s.y };
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

// 滿條門檻＝依譜面精算理論滿分 × 0.7 校正（玩得不錯就能看到接近滿條）
function barFullScore() {
  return Math.max(1, Math.round(maxScoreForChart(chart, bpm, SCORE_CFG) * BAR_FULL_RATIO));
}
let urgentSent = false; // 最後 10 秒紅色模式只送一次

function startPlaying() {
  const t = media.tracks[selectedIdx];
  bpm = t.bpm || 120;
  const pb = pickPlayback(t, lenMode);                 // { src, roundSec }
  const songLen = Number.isFinite(mvVideo.duration) ? mvVideo.duration : 120;
  roundSec = pb.roundSec != null ? pb.roundSec         // chorus 固定 60
    : (lenMode === '2' ? Math.min(120, songLen) : songLen);
  chart = chartFromBpm(bpm, bpmToStars(bpm), roundSec);
  maxScore = barFullScore(); // 滿條基準（畫面能量條與燈條共用）
  urgentSent = false;
  scoreA = newScore();
  scoreB = newScore();
  ended = false;
  media.playTrack(selectedIdx, lenMode);               // 傳 lenMode，chorus 會載短片
  if (!mvAnalyser) { try { mvAnalyser = attachAnalyser(mvVideo); mvFreq = new Uint8Array(mvAnalyser.frequencyBinCount); } catch { mvAnalyser = null; } }
  scoreS = newScore();
  resetCircle(cirA); resetCircle(cirB); resetCircle(cirS);
  video.style.opacity = '0'; // 開打隱藏攝影機，只看 MV + 手
  startTime = performance.now();
  last = startTime;
  lastCountSec = -1; victoryResult = null;
  phase = 'playing';
  mvVideo.addEventListener('loadedmetadata', () => {
    if (pb.roundSec != null) return;                   // chorus：固定 60，不用 duration 覆蓋
    const sl = mvVideo.duration;
    if (Number.isFinite(sl)) { roundSec = lenMode === '2' ? Math.min(120, sl) : sl; chart = chartFromBpm(bpm, bpmToStars(bpm), roundSec); maxScore = barFullScore(); }
  }, { once: true });
}

let lastStopPhase = ''; // 記住上次在哪個閒置階段送過停止，避免每幀狂送蓋掉硬體測試指令
function sendStop() {
  sender.send(formatCommand({ dir: 'S', pwm: 0, energy: 0 }, { dir: 'S', pwm: 0, energy: 0 })).catch(() => {});
  sender.send(urgentLine(false)).catch(() => {}); // 一併解除倒數紅色模式
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
  sp = createSettingsPanel(hud, settings, media, arduinoCtl);
  selectScreen = createSelectScreen(hud, (idx, m) => {
    selectedIdx = idx; lenMode = m;
    modeModal.show();
  });
  modeModal = createModeModal(hud, (picked) => {
    mode = picked;
    selectScreen.hide(); showControls(false);
    media.prep(selectedIdx, lenMode); // 用 ready 期間預載選中曲（chorus 模式載短片）
    startReady();
  });

  loading.progress(1);
  loading.hide();
  phase = 'select';
  selectScreen.show(media.tracks);
  showControls(true);
  if (window.__ELECTRON__) doConnect({ silent: true }); // Electron：開機自動連 Arduino
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
function omegaCircle(cir, wrist, mapFn, now, dt) {
  return DIR_SIGN * circleStep(cir, mapFn(wrist), now / 1000, dt);
}

async function loop(pose) {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  let handA = null, handB = null, handS = null;
  let omegaA = 0, omegaB = 0, omegaS = 0;
  if (phase !== 'select') {
    // 掉幀時不清追蹤狀態：時間窗會自己淘汰舊點，手臂回來就無縫接續（大跳會被尖刺防護丟棄）
    if (mode === 'single') {
      const arm = pickS(await pose.readFull());
      if (arm) { omegaS = omegaCircle(cirS, arm.wrist, toCanvasFull, now, dt); handS = toCanvasFull(arm.wrist); }
      handS = smoothPoint(smS, handS, dt);
    } else {
      // 左右半邊各自偵測 → 保證每邊各抓到一位玩家（螢幕左=A、右=B）。
      const armA = pickA(await pose.readHalf('A'));
      const armB = pickB(await pose.readHalf('B'));
      if (armA) { omegaA = omegaCircle(cirA, armA.wrist, (p) => toCanvas(p, 'A'), now, dt); handA = toCanvas(armA.wrist, 'A'); }
      if (armB) { omegaB = omegaCircle(cirB, armB.wrist, (p) => toCanvas(p, 'B'), now, dt); handB = toCanvas(armB.wrist, 'B'); }
      handA = smoothPoint(smA, handA, dt); handB = smoothPoint(smB, handB, dt);
    }
  }

  if (phase === 'select') {
    ui.clear();
    // 只在剛進選歌時停一次，不每幀狂送(否則會蓋掉設定裡的硬體測試指令)
    if (lastStopPhase !== 'select') { sendStop(); lastStopPhase = 'select'; }
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
    if (lastStopPhase !== 'ready') { sendStop(); lastStopPhase = 'ready'; }
  } else if (phase === 'playing') {
    lastStopPhase = ''; // 離開閒置：下次回選歌時會再停一次
    const elapsed = (performance.now() - startTime) / 1000;
    const timeLeft = Math.max(0, roundSec - elapsed);
    const { current, next, remain } = segmentAt(chart, elapsed);
    const segDir = current ? current.dir : 'S';
    const guideOmega = targetOmegaFor(bpm, SCORE_CFG);
    if (mvAnalyser) mvAnalyser.getByteFrequencyData(mvFreq); // 取 MV 即時頻譜
    const dirSign = segDir === 'R' ? -1 : 1;
    const progOf = (st) => Math.min(100, st.score / maxScore * 100); // 燈條=分數進度（與畫面能量條同一百分比）
    const endRound = (result, win) => {
      ended = true; phase = 'victory'; victoryResult = result; mvVideo.pause(); sfx.fanfare(win);
      // 勝利畫面 10 秒：煙火特效；雙人不論誰贏 P2 風扇續轉 10 秒、單人即停。
      // 用 M 指令控馬達（不動燈）+ E 煙火；victory 期間不送 A/B 幀指令，煙火不被蓋掉。
      sender.send(motorTestLine('A', 0)).catch(() => {});
      sender.send(motorTestLine('B', mode === 'dual' ? 20 : 0)).catch(() => {});
      sender.send(effectLine('D', FX.FIREWORK)).catch(() => {});
      setTimeout(() => { selectScreen.show(media.tracks); showControls(true); video.style.opacity = ''; phase = 'select'; }, 10000);
    };
    // 一位玩家：偵測「在正確方向畫圈」(平滑omega+遲滯)→ marker 以固定速度沿圈勻速跑；
    // marker 每跑滿一圈=完成一圈 → 用該圈平均轉速判定 PERFECT/GREAT/GOOD、加分/combo/特效音效。
    const ON = 1.2, OFF = 0.5; // 遲滯門檻（rad/s）
    const MAXW = 16; // marker 最高角速度上限（rad/s，避免爆衝）
    const stepPlayer = (st, omega, cx, cy, color) => {
      const o = Math.max(-MAXW, Math.min(MAXW, omega)); // 先夾掉單幀尖刺
      st.oEMA += 0.22 * (o - st.oEMA);                   // 較重平滑（跟手但更順）
      const correctSign = dirSign > 0 ? st.oEMA > 0 : st.oEMA < 0;
      if (segDir === 'S') st.active = false;
      else if (!st.active && correctSign && Math.abs(st.oEMA) > ON) st.active = true;
      else if (st.active && (!correctSign || Math.abs(st.oEMA) < OFF)) st.active = false;
      // marker 速度＝跟隨真實轉速(平滑後)，再做更緩的加/減速 → 轉動滑順不頓
      const targetSpd = st.active ? Math.abs(st.oEMA) : 0;
      st.spd += (targetSpd - st.spd) * Math.min(1, dt * 6);
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
          const fl = judgeFlashLine('D', j); // 燈條得分閃爍：PERFECT 金、GREAT 白、GOOD 不閃
          if (fl) sender.send(fl).catch(() => {});
          sfx.hit(mult >= 3);                              // 每圈遊戲打點音（GOOD 只有這個）
          if (leveled) sfx.comboBurst(mult);              // combo 升級＝遊戲音效，不喊語音
          if (j === 'PERFECT') sfx.voice('Perfect');       // 只有 PERFECT/GREAT 喊真人語音
          else if (j === 'GREAT') sfx.voice('Great');
        }
      }
      return { markerAngle: st.mAng, active: st.active };
    };
    if (mode === 'single') {
      const m = stepPlayer(scoreS, omegaS, canvas.width * 0.5, canvas.height * 0.44, '#2b7bff');
      // 殘缺版：P2 風扇整場固定轉；燈條送分數進度
      const fan = fanRun(CONFIG); const e = progOf(scoreS);
      sender.send(formatCommand({ dir: 'S', pwm: 0, energy: e }, { ...fan, energy: e })).catch(() => {});
      ui.render({ mode: 'single', timeLeft, segDir, nextDir: next ? next.dir : null, nextIn: remain, guideOmega, maxScore, spectrum: mvFreq,
        barStyle: settings.barStyle, score: scoreS.score, combo: scoreS.combo, comboMult: comboMultiplier(scoreS.combo, SCORE_CFG),
        hand: handS, active: m.active });
      if (!ended && elapsed >= roundSec) endRound({ mode: 'single', score: scoreS.score, grade: gradeFor(scoreS.score, roundSec, bpm, SCORE_CFG) }, true);
    } else {
      const mA = stepPlayer(scoreA, omegaA, canvas.width * 0.25, canvas.height * 0.44, '#2b7bff');
      const mB = stepPlayer(scoreB, omegaB, canvas.width * 0.75, canvas.height * 0.44, '#ff3b3b');
      // 殘缺版：只有 P2 風扇；A 送 1P 進度、B 送 2P 進度（單條燈後到的 B 蓋前面 → 顯示 2P）
      const fan = fanRun(CONFIG);
      sender.send(formatCommand({ dir: 'S', pwm: 0, energy: progOf(scoreA) }, { ...fan, energy: progOf(scoreB) })).catch(() => {});
      ui.render({ mode: 'dual', timeLeft, segDir, nextDir: next ? next.dir : null, nextIn: remain, guideOmega, maxScore, spectrum: mvFreq,
        barStyle: settings.barStyle,
        A: { score: scoreA.score, combo: scoreA.combo, comboMult: comboMultiplier(scoreA.combo, SCORE_CFG), hand: handA, active: mA.active },
        B: { score: scoreB.score, combo: scoreB.combo, comboMult: comboMultiplier(scoreB.combo, SCORE_CFG), hand: handB, active: mB.active } });
      if (!ended && elapsed >= roundSec) {
        const who = higherScore(scoreA.score, scoreB.score);
        endRound({ mode: 'dual', who, scoreA: scoreA.score, scoreB: scoreB.score }, !!who);
      }
    }
    // 最後 10 秒：燈條進度條變紅+脈動（只送一次）
    if (timeLeft <= 10 && !urgentSent) { urgentSent = true; sender.send(urgentLine(true)).catch(() => {}); }
    // 倒數滴答（最後 10 秒每秒一聲，最後 3 秒更急）
    const sec = Math.ceil(timeLeft);
    if (timeLeft <= 10 && sec !== lastCountSec) { lastCountSec = sec; if (sec > 0) sfx.countTick(sec <= 3); }
  } else if (phase === 'victory') {
    if (victoryResult) ui.victory(victoryResult); // 逐幀播放華麗結算動畫
  }

  requestAnimationFrame(() => loop(pose));
}

boot().catch((e) => alert('啟動失敗：' + e.message));
