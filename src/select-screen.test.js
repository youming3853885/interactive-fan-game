import { describe, it, expect } from 'vitest';
import { formatTime } from './select-screen.js';

describe('formatTime', () => {
  it('秒 → m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(125)).toBe('2:05');
  });
  it('NaN/未知 → --:--', () => {
    expect(formatTime(NaN)).toBe('--:--');
  });
});
