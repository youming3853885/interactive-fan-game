import { direction } from './motion.js';

// 風機相關可調常數（校正旋鈕）
export const CONFIG = {
  deadzone: 1.5,
  omegaMax: 12,
  pwmMin: 80,
  power: 0.15,  // 風機輸出功率（0~1）：0.15 = 15%。實測堵轉門檻~10%；起轉由韌體踢腳(25%×0.3s)幫忙
};

// 風機永遠跟玩家真實手勢方向；動力固定為 CONFIG.power（目前 15%）。
export function fanCommand(omega, cfg) {
  const dir = direction(omega, cfg.deadzone);
  if (dir === 'S') return { dir: 'S', pwm: 0 };
  const pwm = Math.round(255 * (cfg.power ?? 1));
  return { dir, pwm };
}
