import { describe, it, expect } from 'vitest';
import { SCORE_CFG, targetOmegaFor, comboMultiplier, revStep, judgeRev, revScore, higherScore, gradeFor } from './score.js';

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

describe('revStep', () => {
  const T = 2 * Math.PI;
  it('方向對 → 累積角度', () => {
    const r = revStep(0, T, 'F', 0.1, SCORE_CFG); // 2π rad/s * 0.1 = 0.628
    expect(r.completed).toBe(0);
    expect(r.acc).toBeCloseTo(0.628, 2);
  });
  it('累積跨過 2π → completed=1，acc 進位', () => {
    const r = revStep(2 * Math.PI - 0.3, 6.283, 'F', 0.1, SCORE_CFG);
    expect(r.completed).toBe(1);
    expect(r.acc).toBeGreaterThanOrEqual(0);
    expect(r.acc).toBeLessThan(2 * Math.PI);
  });
  it('方向錯 → 暫停，保留 acc、不完成', () => {
    expect(revStep(1.0, -6, 'F', 0.1, SCORE_CFG)).toEqual({ acc: 1.0, completed: 0 });
  });
  it('休息段 → 保留 acc', () => {
    expect(revStep(1.0, 6, 'S', 0.1, SCORE_CFG)).toEqual({ acc: 1.0, completed: 0 });
  });
});

describe('judgeRev', () => {
  it('接近理想耗時 → PERFECT', () => {
    const ideal = (2 * Math.PI) / targetOmegaFor(120, SCORE_CFG);
    expect(judgeRev(ideal, 120, SCORE_CFG)).toBe('PERFECT');
  });
  it('偏離一些 → GREAT', () => {
    const ideal = (2 * Math.PI) / targetOmegaFor(120, SCORE_CFG);
    expect(judgeRev(ideal * 2, 120, SCORE_CFG)).toBe('GREAT');
  });
  it('太慢 → GOOD', () => {
    const ideal = (2 * Math.PI) / targetOmegaFor(120, SCORE_CFG);
    expect(judgeRev(ideal * 3, 120, SCORE_CFG)).toBe('GOOD');
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
