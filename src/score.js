
export const SCORE_CFG = {
  deadzone: 1.5,
  sGood: 100, sGreat: 200, sPerfect: 300, // 每級基礎分（再乘 combo 倍率）
  comboStep: 2,        // 每 N 圈 combo 倍率 +1
  comboMax: 5,
  revsPerBeat: 0.5,    // 導引箭頭/風機用的目標轉速
  // 判定：與目標速率(targetOmegaFor)的偏差頻帶——太快太慢都掉級，跟著每首歌 BPM 走
  perfectBand: 0.2,    // ±20% 內 → PERFECT
  greatBand: 0.5,      // ±50% 內 → GREAT；更偏 → GOOD
};

export function targetOmegaFor(bpm, cfg) {
  const beatSec = 60 / bpm;
  return cfg.revsPerBeat * 2 * Math.PI / beatSec;
}

export function comboMultiplier(combo, cfg) {
  return Math.min(cfg.comboMax, 1 + Math.floor(combo / cfg.comboStep));
}

// 依「該圈平均轉速與目標速率的偏差」評級：契合=PERFECT，太快太慢都掉級。
// 回傳 { judge, pace }，pace: 'ok'|'fast'|'slow'（給畫面顯示「太快/太慢」提示用）。
export function judgeBySpeed(avgOmega, bpm, cfg) {
  const dev = Math.abs(avgOmega) / targetOmegaFor(bpm, cfg) - 1;
  const judge = Math.abs(dev) <= cfg.perfectBand ? 'PERFECT'
    : Math.abs(dev) <= cfg.greatBand ? 'GREAT' : 'GOOD';
  return { judge, pace: judge === 'PERFECT' ? 'ok' : dev > 0 ? 'fast' : 'slow' };
}

// 一圈得分 = 該級固定分 × combo 倍率
export function revScore(combo, judgment, cfg) {
  const base = judgment === 'PERFECT' ? cfg.sPerfect : judgment === 'GREAT' ? cfg.sGreat : cfg.sGood;
  return base * comboMultiplier(combo, cfg);
}

export const BAR_FULL_RATIO = 0.7; // 滿條門檻 = 理論滿分 × 此係數（小學生玩得不錯就能看到接近滿條）

// 依譜面精算理論滿分：只計 F/R 段、每圈 PERFECT、combo 跨段累積。休息段不計分。
export function maxScoreForChart(chart, bpm, cfg) {
  const revTime = (2 * Math.PI) / targetOmegaFor(bpm, cfg);
  let combo = 0, total = 0;
  for (const seg of chart) {
    if (seg.dir === 'S') continue;
    const revs = Math.floor((seg.endSec - seg.startSec) / revTime);
    for (let r = 0; r < revs; r++) { combo += 1; total += revScore(combo, 'PERFECT', cfg); }
  }
  return total || 1;
}

export function higherScore(a, b) {
  if (a > b) return 'A';
  if (b > a) return 'B';
  return null;
}

// 評級=能量條同一套語言：滿條(=BAR_FULL_RATIO×理論滿分)即 S、75% A、45% B、其他 C。
// 玩家看條的刻度線就知道自己會拿什麼，結算不再與條打架。
export const GRADE_TICKS = [{ f: 0.45, g: 'B' }, { f: 0.75, g: 'A' }, { f: 1, g: 'S' }];
export function gradeForProgress(score, barFull) {
  const r = score / Math.max(1, barFull);
  if (r >= 1) return 'S';
  if (r >= 0.75) return 'A';
  if (r >= 0.45) return 'B';
  return 'C';
}
