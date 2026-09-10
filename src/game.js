// 風機相關可調常數（校正旋鈕）
export const CONFIG = {
  deadzone: 1.5,
  omegaMax: 12,
  pwmMin: 80,
  power: 0.15,  // 風機輸出功率（0~1）：0.15 = 15%。實測堵轉門檻~10%；起轉由韌體踢腳(25%×0.3s)幫忙
};

// 風機跟譜面段落、不跟玩家：F/R 段一律「正轉定速」、S 休息段停。
// 玩家畫圈方向只影響計分與畫面；風機不換向、不隨手勢頓挫起停 → 起停衝擊最少、電刷/驅動板最長壽。
export function fanForSegment(segDir, cfg) {
  if (segDir !== 'F' && segDir !== 'R') return { dir: 'S', pwm: 0 };
  return { dir: 'F', pwm: Math.round(255 * (cfg.power ?? 1)) };
}
