import { describe, it, expect } from 'vitest';
import { wristAngle, angularDelta, trackRotation, direction } from './motion.js';

describe('wristAngle', () => {
  it('手腕在肩右側 → 角度 0', () => {
    expect(wristAngle({ x: 1, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(0);
  });
});

describe('angularDelta', () => {
  it('跨 ±π 回繞取最短路徑', () => {
    expect(angularDelta(3.0, -3.0)).toBeCloseTo(2 * Math.PI - 6.0);
  });
});

describe('trackRotation', () => {
  it('第一幀無前值 → ω=0', () => {
    const { omega } = trackRotation({ lastAngle: null }, 0.0, 0.1);
    expect(omega).toBe(0);
  });
  it('0.5 rad / 0.1 s → ω=5', () => {
    let r = trackRotation({ lastAngle: null }, 0.0, 0.1);
    r = trackRotation(r.state, 0.5, 0.1);
    expect(r.omega).toBeCloseTo(5);
  });
});

describe('direction', () => {
  it('死區內 → S', () => expect(direction(0.5, 1.5)).toBe('S'));
  it('正 → F', () => expect(direction(6, 1.5)).toBe('F'));
  it('負 → R', () => expect(direction(-6, 1.5)).toBe('R'));
});
