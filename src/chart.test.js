import { describe, it, expect } from 'vitest';
import { chartFromBpm, segmentAt } from './chart.js';

describe('chartFromBpm', () => {
  it('120BPM/3星 → 每段≈8秒(16拍)、正反休循環', () => {
    const c = chartFromBpm(120, 3, 32);
    expect(c[0]).toEqual({ dir: 'F', startSec: 0, endSec: 8 });
    expect(c[1]).toEqual({ dir: 'R', startSec: 8, endSec: 16 });
    expect(c[2]).toEqual({ dir: 'S', startSec: 16, endSec: 24 });
    expect(c[3].dir).toBe('F');
    expect(c[c.length - 1].endSec).toBe(32);
  });
  it('高難度(≥4星)樣式休息更少', () => {
    const c = chartFromBpm(120, 5, 100);
    expect(c.slice(0, 5).map((s) => s.dir)).toEqual(['F', 'R', 'F', 'R', 'S']);
  });
  it('最後一段裁切、不超過 roundSec', () => {
    const c = chartFromBpm(120, 3, 20);
    expect(c[c.length - 1]).toEqual({ dir: 'S', startSec: 16, endSec: 20 });
  });
});
describe('segmentAt', () => {
  const c = chartFromBpm(120, 3, 32);
  it('回傳當前段、下一段、當前剩餘秒數', () => {
    const r = segmentAt(c, 10);
    expect(r.current.dir).toBe('R');
    expect(r.next.dir).toBe('S');
    expect(r.remain).toBeCloseTo(6);
  });
  it('超過結尾 → current 為 null', () => {
    expect(segmentAt(c, 999).current).toBe(null);
  });
});
