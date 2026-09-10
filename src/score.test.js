import { describe, it, expect } from 'vitest';
import { SCORE_CFG, targetOmegaFor, comboMultiplier, judgeBySpeed, revScore, higherScore, gradeForProgress, maxScoreForChart, BAR_FULL_RATIO } from './score.js';
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

describe('judgeBySpeed（與目標速率的偏差評級：太快太慢都掉級）', () => {
  const T = targetOmegaFor(120, SCORE_CFG);
  it('±20% 內 → PERFECT / 節奏完美', () => {
    expect(judgeBySpeed(T, 120, SCORE_CFG)).toEqual({ judge: 'PERFECT', pace: 'ok' });
    expect(judgeBySpeed(T * 1.15, 120, SCORE_CFG).judge).toBe('PERFECT');
  });
  it('偏快 20~50% → GREAT / 太快', () => {
    expect(judgeBySpeed(T * 1.4, 120, SCORE_CFG)).toEqual({ judge: 'GREAT', pace: 'fast' });
  });
  it('偏慢 20~50% → GREAT / 太慢', () => {
    expect(judgeBySpeed(T * 0.6, 120, SCORE_CFG)).toEqual({ judge: 'GREAT', pace: 'slow' });
  });
  it('偏差超過 50% → GOOD（太快也一樣）', () => {
    expect(judgeBySpeed(T * 2, 120, SCORE_CFG)).toEqual({ judge: 'GOOD', pace: 'fast' });
    expect(judgeBySpeed(T * 0.3, 120, SCORE_CFG)).toEqual({ judge: 'GOOD', pace: 'slow' });
  });
  it('目標速率跟著 BPM：120 的速度拿去玩 168 的歌會變太慢', () => {
    expect(judgeBySpeed(T, 168, SCORE_CFG).pace).toBe('slow');
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

describe('gradeForProgress（評級=能量條同一套語言）', () => {
  it('滿條 S、75% A、45% B、以下 C', () => {
    expect(gradeForProgress(10000, 10000)).toBe('S');
    expect(gradeForProgress(7500, 10000)).toBe('A');
    expect(gradeForProgress(4500, 10000)).toBe('B');
    expect(gradeForProgress(4400, 10000)).toBe('C');
    expect(gradeForProgress(99999, 10000)).toBe('S'); // 超過滿條(FEVER 後)仍是 S
  });
});
