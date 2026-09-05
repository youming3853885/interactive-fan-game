import { direction } from './motion.js';

// 可調常數（校正旋鈕）
export const CONFIG = {
  gain: 40,       // 做對時，每 (rad/s) 每秒累積的能量 (k)
  decay: 15,      // 做錯/停手時，每秒緩降的能量
  deadzone: 1.5,  // rad/s，低於此視為停手
  omegaMax: 12,   // rad/s，對應風機滿速（約 2 圈/秒）
  pwmMin: 80,     // DC 馬達死區下限，低於此轉不動
  switchMin: 3,   // 指令最短維持秒數
  switchMax: 5,   // 指令最長維持秒數
  winAt: 100,     // 過關能量
};

export function initChannel(requiredDir) {
  return { energy: 0, requiredDir, timeToSwitch: 0 };
}

// state → 新 state。rng() 回傳 [0,1)，注入以利測試。
export function updateChannel(state, omega, dt, cfg, rng) {
  let { energy, requiredDir, timeToSwitch } = state;
  timeToSwitch -= dt;
  if (timeToSwitch <= 0) {
    requiredDir = rng() < 0.5 ? 'F' : 'R';
    timeToSwitch = cfg.switchMin + rng() * (cfg.switchMax - cfg.switchMin);
  }
  const dir = direction(omega, cfg.deadzone);
  const correct = dir !== 'S' && dir === requiredDir;
  energy += correct ? cfg.gain * Math.abs(omega) * dt : -cfg.decay * dt;
  energy = Math.max(0, Math.min(cfg.winAt, energy));
  return { energy, requiredDir, timeToSwitch };
}

// 風機永遠跟真實手勢方向，與做對與否無關。
export function fanCommand(omega, cfg) {
  const dir = direction(omega, cfg.deadzone);
  if (dir === 'S') return { dir: 'S', pwm: 0 };
  const mag = Math.min(Math.abs(omega), cfg.omegaMax);
  const pwm = Math.round(cfg.pwmMin + (mag / cfg.omegaMax) * (255 - cfg.pwmMin));
  return { dir, pwm };
}

export function winner(a, b, cfg) {
  const aWin = a.energy >= cfg.winAt;
  const bWin = b.energy >= cfg.winAt;
  if (aWin && bWin) return a.energy >= b.energy ? 'A' : 'B';
  if (aWin) return 'A';
  if (bWin) return 'B';
  return null;
}
