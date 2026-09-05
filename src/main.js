import { wristAngle, trackRotation } from './motion.js';
import { CONFIG, initChannel, updateChannel, fanCommand, winner } from './game.js';
import { formatCommand } from './protocol.js';
import { connectSerial, simSender } from './serial.js';
import { createPoseReader, pickArm } from './pose.js';
import { createUI } from './ui.js';
import { createMusicWidget } from './music.js';
import { BUILTIN_TRACKS } from './tracks.js';
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

// ---- 頂部工具列：連接 Arduino（可選，沒有也能玩）----
const bar = document.createElement('div');
bar.style.cssText = 'position:absolute;top:8px;left:50%;transform:translateX(-50%);display:flex;gap:8px;';
const btn = document.createElement('button');
btn.textContent = '連接 Arduino（可選）';
const simLog = document.createElement('span');
simLog.style.cssText = 'color:#8f8;font-family:monospace;font-size:12px;align-self:center;';
simLog.textContent = '示範模式（無需 Arduino）';
bar.append(btn, simLog);
hud.appendChild(bar);

let sender = simSender((line) => { simLog.textContent = line; });
btn.addEventListener('click', async () => {
  try { sender = await connectSerial(); btn.textContent = '已連接 (USB)'; btn.disabled = true; }
  catch (e) { alert(e.message); }
});

// ---- 遊戲狀態 ----
const READY_NEED = 5; // 手放進方塊需維持秒數
let phase = 'loading'; // loading | select | ready | playing | victory
let media = null;
let selectScreen = null;
const chA = { ...initChannel('F') };
const chB = { ...initChannel('R') };
const rotA = { lastAngle: null };
const rotB = { lastAngle: null };
const readyState = { need: READY_NEED, A: { hold: 0, ready: false }, B: { hold: 0, ready: false } };
let done = null;
let last = performance.now();

const rng = () => Math.random();

function startReady() {
  readyState.A = { hold: 0, ready: false };
  readyState.B = { hold: 0, ready: false };
  phase = 'ready';
}

function startPlaying() {
  Object.assign(chA, initChannel('F'));
  Object.assign(chB, initChannel('R'));
  done = null;
  last = performance.now();
  phase = 'playing';
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
  createSettingsPanel(hud, settings, media);
  selectScreen = createSelectScreen(hud, (i) => {
    media.playTrack(i);
    selectScreen.hide();
    startReady();
  });

  loading.progress(1);
  loading.hide();
  phase = 'select';
  selectScreen.show(media.tracks);
  loop(pose);
}

// 把 pose 座標（半張畫面像素）換算成 overlay canvas 像素（含左右鏡像）。
function toCanvas(pt, side) {
  const halfW = video.videoWidth / 2;
  const xInFull = (side === 'A' ? 0 : halfW) + pt.x;
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
    Object.assign(chA, updateChannel(chA, omegaA, dt, CONFIG, rng));
    Object.assign(chB, updateChannel(chB, omegaB, dt, CONFIG, rng));

    const fa = fanCommand(omegaA, CONFIG);
    const fb = fanCommand(omegaB, CONFIG);
    sender.send(formatCommand(
      { ...fa, energy: chA.energy },
      { ...fb, energy: chB.energy },
    )).catch(() => {});

    ui.render({
      A: { energy: chA.energy, requiredDir: chA.requiredDir, hand: handA },
      B: { energy: chB.energy, requiredDir: chB.requiredDir, hand: handB },
    });

    done = winner(chA, chB, CONFIG);
    if (done) {
      ui.victory(done);
      phase = 'victory';
      sendStop();
      setTimeout(() => { selectScreen.show(media.tracks); phase = 'select'; }, 4000);
    }
  }
  // phase 'loading'/'victory' 時不更新遊戲，等狀態切換

  requestAnimationFrame(() => loop(pose));
}

boot().catch((e) => alert('啟動失敗：' + e.message));
