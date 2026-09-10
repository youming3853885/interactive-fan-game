import { describe, it, expect } from 'vitest';
import { SCORE_CFG, targetOmegaFor, comboMultiplier, judgeBySpeed, revScore, higherScore, gradeFor, maxScoreForChart, BAR_FULL_RATIO } from './score.js';
import { chartFromBpm } from './chart.js';

describe('maxScoreForChart（依譜面精算理論滿分）', () => {
  it('120BPM/24秒(F8s+R8s+S8s) → 16圈全PERFECT含combo = 19200', () => {
    // 120BPM 目標轉速 2π rad/s → 每圈 1 秒；F/R 各 8 圈、S 段不計分
    const chart = chartFromBpm(120, 3, 24);
    expect(maxScoreForChart(chart, 120, SCORE_CFG)).toBe(19200);
  });
  it('全休息譜面 → 回 1（避免除以零）', () => {
    expect(maxScoreForChart([{ dir: 'S', startSec: 0, endSec: 10 }], 120, SCORE_CFG)).toBe(1);
  });
  it('滿條校正係數 0.7', () => {
    expect(BAR_FULL_RATIO).toBe(0.7);
  });
});

describe('targetOmegaFor', () => {
  it('每2拍一圈：120BPM → 2π rad/s', () => {
    expect(targetOmegaFor(120, SCORE_CFG)).toBeCloseTo(2 * Math.PI);
  });
});

describe('comboMultiplier', () => {
  it('每 comboStep 圈 +1，封頂 comboMax', () => {
    expect(comboMultiplier(0, SCORE_CFG)).toBe(1);
    expect(comboMultiplier(SCORE_CFG.comboStep * 2, SCORE_CFG)).toBe(3);
    expect(comboMultiplier(9999, SCORE_CFG)).toBe(SCORE_CFG.comboMax);
  });
});

describe('judgeBySpeed', () => {
  const T = targetOmegaFor(120, SCORE_CFG);
  it('接近或超過目標轉速 → PERFECT', () => {
    expect(judgeBySpeed(T, 120, SCORE_CFG)).toBe('PERFECT');
    expect(judgeBySpeed(T * 1.5, 120, SCORE_CFG)).toBe('PERFECT');
  });
  it('偏慢一些 → GREAT', () => {
    expect(judgeBySpeed(T * 0.5, 120, SCORE_CFG)).toBe('GREAT');
  });
  it('太慢 → GOOD', () => {
    expect(judgeBySpeed(T * 0.2, 120, SCORE_CFG)).toBe('GOOD');
  });
});

describe('revScore', () => {
  it('PERFECT>GREAT>GOOD；combo 越高分越高', () => {
    const g = revScore(0, 'GOOD', SCORE_CFG);
    const gr = revScore(0, 'GREAT', SCORE_CFG);
    const p = revScore(0, 'PERFECT', SCORE_CFG);
    expect(p).toBeGreaterThan(gr); expect(gr).toBeGreaterThan(g);
    expect(revScore(10, 'GOOD', SCORE_CFG)).toBeGreaterThan(g);
  });
});

describe('higherScore', () => {
  it('比分高者勝、平手 null', () => {
    expect(higherScore(100, 50)).toBe('A');
    expect(higherScore(20, 80)).toBe('B');
    expect(higherScore(30, 30)).toBe(null);
  });
});

describe('gradeFor', () => {
  it('分數越高評級越好', () => {
    const roundSec = 120, bpm = 120;
    expect(gradeFor(0, roundSec, bpm, SCORE_CFG)).toBe('C');
    expect(gradeFor(999999, roundSec, bpm, SCORE_CFG)).toBe('S');
  });
});
