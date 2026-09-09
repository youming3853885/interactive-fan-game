import { direction } from './motion.js';

// 風機相關可調常數（校正旋鈕）
export const CONFIG = {
  deadzone: 1.5,
  omegaMax: 12,
  pwmMin: 80,
  power: 0.2,   // 風機輸出功率（0~1）：轉動時固定此比例動力。0.2 = 20%
};

// 風機永遠跟玩家真實手勢方向；動力固定為 CONFIG.power（目前 20%）。
export function fanCommand(omega, cfg) {
  const dir = direction(omega, cfg.deadzone);
  if (dir === 'S') return { dir: 'S', pwm: 0 };
  const pwm = Math.round(255 * (cfg.power ?? 1));
  return { dir, pwm };
}
