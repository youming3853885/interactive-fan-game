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

const video = document.getElementById('cam');
const mvVideo = document.getElementById('mv');
const canvas = document.getElementById('overlay');
const hud = document.getElementById('hud');

const ui = createUI(canvas);

// 背景 MV + 設定
const settings = loadSettings(BUILTIN_TRACKS.map((t) => t.id));
const media = createMusicWidget(hud, mvVideo, video, settings, BUILTIN_TRACKS);
createSettingsPanel(hud, settings, media);

// ---- 頂部工具列：連接 Arduino / sim 狀態 ----
const bar = document.createElement('div');
bar.style.cssText = 'position:absolute;top:8px;left:50%;transform:translateX(-50%);display:flex;gap:8px;';
const btn = document.createElement('button');
btn.textContent = '連接 Arduino';
const simLog = document.createElement('span');
simLog.style.cssText = 'color:#8f8;font-family:monospace;font-size:12px;align-self:center;';
bar.append(btn, simLog);
hud.appendChild(bar);

let sender = simSender((line) => { simLog.textContent = line; });
btn.addEventListener('click', async () => {
  try { sender = await connectSerial(); btn.textContent = '已連接 (USB)'; btn.disabled = true; }
  catch (e) { alert(e.message); }
});

// ---- 狀態 ----
const chA = { ...initChannel('F') };
const chB = { ...initChannel('R') };
const rotA = { lastAngle: null };
const rotB = { lastAngle: null };
let done = null;
let last = performance.now();

const rng = () => Math.random();

async function boot() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
  video.srcObject = stream;
  await video.play();
  const pose = await createPoseReader(video);
  loop(pose);
}

// 把 pose 座標（半張畫面像素）換算成 overlay canvas 像素（含左右鏡像）。
function toCanvas(pt, side) {
  const halfW = video.videoWidth / 2;
  // 畫面 CSS 有 scaleX(-1) 鏡像；A=左半、B=右半
  const xInFull = (side === 'A' ? 0 : halfW) + pt.x;
  const fx = video.videoWidth - xInFull; // 鏡像
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

  if (!done) {
    done = winner(chA, chB, CONFIG);
    if (done) { ui.victory(done); setTimeout(reset, 4000); }
  }
  requestAnimationFrame(() => loop(pose));
}

function reset() {
  Object.assign(chA, initChannel('F'));
  Object.assign(chB, initChannel('R'));
  done = null;
}

boot().catch((e) => alert('啟動失敗：' + e.message));
