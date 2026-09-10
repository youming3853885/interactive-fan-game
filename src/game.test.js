import { describe, it, expect } from 'vitest';
import { CONFIG, fanForSegment } from './game.js';

describe('fanForSegment（風機跟譜面段落，不跟玩家）', () => {
  it('F 段 → 正轉 15%(pwm 38)', () => {
    expect(fanForSegment('F', CONFIG)).toEqual({ dir: 'F', pwm: 38 });
  });
  it('R 段 → 仍是正轉(風機不換向)', () => {
    expect(fanForSegment('R', CONFIG)).toEqual({ dir: 'F', pwm: 38 });
  });
  it('S 休息段 → 停', () => {
    expect(fanForSegment('S', CONFIG)).toEqual({ dir: 'S', pwm: 0 });
  });
  it('段落結束(null) → 停', () => {
    expect(fanForSegment(null, CONFIG)).toEqual({ dir: 'S', pwm: 0 });
  });
});
