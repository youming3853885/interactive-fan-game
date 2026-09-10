// 風機相關可調常數（校正旋鈕）
export const CONFIG = {
  deadzone: 1.5,
  omegaMax: 12,
  pwmMin: 80,
  power: 0.20,  // 風機輸出功率（0~1）：0.20 = 20%。實測堵轉門檻~10%，20% 免踢腳可直接起轉
};

// 殘缺版：P2 風扇整場固定正轉（不踢腳、不隨休息段起停），遊戲結束才停。
export function fanRun(cfg) {
  return { dir: 'F', pwm: Math.round(255 * (cfg.power ?? 1)) };
}
