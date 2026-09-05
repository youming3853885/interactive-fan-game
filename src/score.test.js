import { describe, it, expect } from 'vitest';
import { SCORE_CFG, targetOmegaFor, comboMultiplier, scoreStep, higherScore } from './score.js';

describe('targetOmegaFor', () => {
  it('每2拍一圈：120BPM → 2π rad/s', () => {
    expect(targetOmegaFor(120, SCORE_CFG)).toBeCloseTo(2 * Math.PI);
  });
});
describe('comboMultiplier', () => {
  it('每 comboStep 秒 +1，封頂 comboMax', () => {
    expect(comboMultiplier(0, SCORE_CFG)).toBe(1);
    expect(comboMultiplier(SCORE_CFG.comboStep * 2, SCORE_CFG)).toBe(3);
    expect(comboMultiplier(9999, SCORE_CFG)).toBe(SCORE_CFG.comboMax);
  });
});
describe('scoreStep', () => {
  it('休息段：保留 combo、不加分', () => {
    expect(scoreStep({ score: 50, combo: 2 }, 'S', 6, 0.1, 120, SCORE_CFG)).toEqual({ score: 50, combo: 2 });
  });
  it('做對且合拍：加分、combo 隨時間升', () => {
    const r = scoreStep({ score: 0, combo: 0 }, 'F', 2 * Math.PI, 0.1, 120, SCORE_CFG);
    expect(r.combo).toBeCloseTo(0.1);
    expect(r.score).toBeCloseTo(16);
  });
  it('方向錯 → 只暫停(保留 combo)、不加分', () => {
    expect(scoreStep({ score: 50, combo: 2 }, 'F', -6, 0.1, 120, SCORE_CFG)).toEqual({ score: 50, combo: 2 });
  });
  it('做對但不合拍(轉太快) → 只給基礎分(無加成)', () => {
    const r = scoreStep({ score: 0, combo: 0 }, 'F', 50, 0.1, 120, SCORE_CFG);
    expect(r.score).toBeCloseTo(10);
  });
});
describe('higherScore', () => {
  it('比分高者勝、平手 null', () => {
    expect(higherScore(100, 50)).toBe('A');
    expect(higherScore(20, 80)).toBe('B');
    expect(higherScore(30, 30)).toBe(null);
  });
});

import { gradeFor } from './score.js';

describe('gradeFor', () => {
  it('依正規化比例給 S/A/B/C', () => {
    const R = 100;
    expect(gradeFor(R * 120 * 1.6, 120, SCORE_CFG)).toBe('S');
    expect(gradeFor(R * 120 * 1.0, 120, SCORE_CFG)).toBe('A');
    expect(gradeFor(R * 120 * 0.6, 120, SCORE_CFG)).toBe('B');
    expect(gradeFor(R * 120 * 0.2, 120, SCORE_CFG)).toBe('C');
  });
});
