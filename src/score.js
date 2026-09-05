
export const SCORE_CFG = {
  deadzone: 1.5,
  sGood: 100, sGreat: 200, sPerfect: 300, // 每級基礎分（再乘 combo 倍率）
  comboStep: 2,        // 每 N 圈 combo 倍率 +1
  comboMax: 5,
  revsPerBeat: 0.5,    // 目標：每 2 拍一圈
  // 判定：該圈平均轉速 / 目標轉速 的比例（寬鬆，容易 PERFECT；轉更快也算 PERFECT）
  spPerfect: 0.75, spGreat: 0.45,
};

export function targetOmegaFor(bpm, cfg) {
  const beatSec = 60 / bpm;
  return cfg.revsPerBeat * 2 * Math.PI / beatSec;
}

export function comboMultiplier(combo, cfg) {
  return Math.min(cfg.comboMax, 1 + Math.floor(combo / cfg.comboStep));
}

// 依「該圈平均轉速 vs 目標轉速」給判定：PERFECT / GREAT / GOOD（速率契合度）
export function judgeBySpeed(avgOmega, bpm, cfg) {
  const r = Math.abs(avgOmega) / targetOmegaFor(bpm, cfg);
  if (r >= cfg.spPerfect) return 'PERFECT';
  if (r >= cfg.spGreat) return 'GREAT';
  return 'GOOD';
}

// 一圈得分 = 該級固定分 × combo 倍率
export function revScore(combo, judgment, cfg) {
  const base = judgment === 'PERFECT' ? cfg.sPerfect : judgment === 'GREAT' ? cfg.sGreat : cfg.sGood;
  return base * comboMultiplier(combo, cfg);
}

export function higherScore(a, b) {
  if (a > b) return 'A';
  if (b > a) return 'B';
  return null;
}

// 評級：依實際分數 / 該局理想分數 的比例
export function gradeFor(score, roundSec, bpm, cfg) {
  const idealRevTime = (2 * Math.PI) / targetOmegaFor(bpm, cfg);
  const expectedRevs = roundSec / idealRevTime;
  const expected = cfg.sGood * Math.max(1, expectedRevs); // 基準（combo 1x、全 GOOD）
  const ratio = score / expected;
  if (ratio >= 2.2) return 'S';
  if (ratio >= 1.4) return 'A';
  if (ratio >= 0.7) return 'B';
  return 'C';
}
