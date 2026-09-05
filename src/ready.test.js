import { describe, it, expect } from 'vitest';
import { boxFor, pointInBox, updateHold } from './ready.js';

describe('boxFor', () => {
  it('A 在左半、B 在右半', () => {
    const a = boxFor('A', 1000, 800);
    const b = boxFor('B', 1000, 800);
    expect(a.x + a.w / 2).toBeCloseTo(250);
    expect(b.x + b.w / 2).toBeCloseTo(750);
  });
});

describe('pointInBox', () => {
  const box = { x: 100, y: 100, w: 50, h: 50 };
  it('框內 → true', () => expect(pointInBox({ x: 120, y: 120 }, box)).toBe(true));
  it('框外 → false', () => expect(pointInBox({ x: 10, y: 10 }, box)).toBe(false));
});

describe('updateHold', () => {
  it('手在框內累加，滿 need 就緒', () => {
    expect(updateHold(4.8, true, 0.3, 5)).toEqual({ hold: 5, ready: true });
    expect(updateHold(2, true, 0.1, 5).ready).toBe(false);
  });
  it('手離開歸零', () => {
    expect(updateHold(3, false, 0.1, 5)).toEqual({ hold: 0, ready: false });
  });
});
