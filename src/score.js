import { direction } from './motion.js';

export const SCORE_CFG = {
  deadzone: 1.5,
  baseRevScore: 120,   // 每轉完一圈的基礎分
  comboStep: 2,        // 每 N 圈 combo 倍率 +1
  comboMax: 5,
  revsPerBeat: 0.5,    // 目標：每 2 拍一圈
  // 判定視窗（實際整圈耗時 / 理想耗時 的比例）
  exLo: 0.75, exHi: 1.35,   // EXCELLENT
  grLo: 0.55, grHi: 1.8,    // GREAT（其餘 GOOD）
};

export function targetOmegaFor(bpm, cfg) {
  const beatSec = 60 / bpm;
  return cfg.revsPerBeat * 2 * Math.PI / beatSec;
}

export function comboMultiplier(combo, cfg) {
  return Math.min(cfg.comboMax, 1 + Math.floor(combo / cfg.comboStep));
}

// 累積角度偵測「整圈」。acc=已累積角度(弧度)；方向對才累積。
// 回傳 { acc, completed }（completed=1 表示這步剛好轉完一圈）。
export function revStep(acc, omega, segDir, dt, cfg) {
  if (segDir === 'S' || segDir == null) return { acc, completed: 0 };
  const dir = direction(omega, cfg.deadzone);
  if (dir === 'S' || dir !== segDir) return { acc, completed: 0 }; // 方向錯/停手 → 暫停(保留 acc)
  const na = acc + Math.abs(omega) * dt;
  if (na >= 2 * Math.PI) return { acc: na - 2 * Math.PI, completed: 1 };
  return { acc: na, completed: 0 };
}

// 依整圈耗時 vs 理想耗時給判定：EXCELLENT / GREAT / GOOD
export function judgeRev(revTime, bpm, cfg) {
  const ideal = (2 * Math.PI) / targetOmegaFor(bpm, cfg);
  const r = revTime / ideal;
  if (r >= cfg.exLo && r <= cfg.exHi) return 'EXCELLENT';
  if (r >= cfg.grLo && r <= cfg.grHi) return 'GREAT';
  return 'GOOD';
}

// 一圈得分 = 基礎 × 判定倍率 × combo 倍率
export function revScore(combo, judgment, cfg) {
  const jm = judgment === 'EXCELLENT' ? 1.5 : judgment === 'GREAT' ? 1.2 : 1.0;
  return Math.round(cfg.baseRevScore * jm * comboMultiplier(combo, cfg));
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
  const expected = cfg.baseRevScore * Math.max(1, expectedRevs); // 基準（combo 1x、全 GOOD）
  const ratio = score / expected;
  if (ratio >= 2.2) return 'S';
  if (ratio >= 1.4) return 'A';
  if (ratio >= 0.7) return 'B';
  return 'C';
}
