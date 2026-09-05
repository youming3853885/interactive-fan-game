import { describe, it, expect } from 'vitest';
import { bpmToStars, starString } from './tracks.js';

describe('bpmToStars', () => {
  it('BPM 越高星越多（單調遞增）', () => {
    expect(bpmToStars(90)).toBe(2);
    expect(bpmToStars(120)).toBe(3);
    expect(bpmToStars(150)).toBe(4);
    expect(bpmToStars(165)).toBe(5);
  });
  it('缺 BPM → 0 星', () => expect(bpmToStars(0)).toBe(0));
  it('遞增不倒退', () => {
    const seq = [60, 100, 130, 160].map(bpmToStars);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]);
  });
});

describe('starString', () => {
  it('5 星滿、2 星', () => {
    expect(starString(5)).toBe('★★★★★');
    expect(starString(2)).toBe('★★☆☆☆');
  });
});
