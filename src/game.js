import { direction } from './motion.js';

// ponytail: stubs — initChannel/updateChannel/winner were removed in refactor but main.js still imports them; add back until main.js is updated
export function initChannel(dir) { return { requiredDir: dir, energy: 0, score: 0, comboMult: 1, timeLeft: 120, segDir: dir, nextDir: null, nextIn: 0, guideOmega: 6 }; }
export function updateChannel(ch) { return ch; }
export function winner() { return null; }

// 風機相關可調常數（校正旋鈕）
export const CONFIG = {
  deadzone: 1.5,
  omegaMax: 12,
  pwmMin: 80,
};

// 風機永遠跟玩家真實手勢方向/轉速。
export function fanCommand(omega, cfg) {
  const dir = direction(omega, cfg.deadzone);
  if (dir === 'S') return { dir: 'S', pwm: 0 };
  const mag = Math.min(Math.abs(omega), cfg.omegaMax);
  const pwm = Math.round(cfg.pwmMin + (mag / cfg.omegaMax) * (255 - cfg.pwmMin));
  return { dir, pwm };
}
