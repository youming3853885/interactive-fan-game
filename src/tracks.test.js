import { describe, it, expect } from 'vitest';
import { bpmToStars, starString, pickPlayback, BUILTIN_TRACKS } from './tracks.js';

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

describe('pickPlayback（時長模式 → 播放來源/局長）', () => {
  const t = { id: 'canon-rock', src: 'blob:full', chorusSrc: '/base/mv/canon-rock-chorus.mp4' };
  it('chorus 模式 → 載副歌短片、roundSec 固定 60', () => {
    expect(pickPlayback(t, 'chorus')).toEqual({ src: '/base/mv/canon-rock-chorus.mp4', roundSec: 60 });
  });
  it('2 分鐘模式 → 完整 src、roundSec 交給 duration(null)', () => {
    expect(pickPlayback(t, '2')).toEqual({ src: 'blob:full', roundSec: null });
  });
  it('完整曲模式 → 完整 src、roundSec 交給 duration(null)', () => {
    expect(pickPlayback(t, 'F')).toEqual({ src: 'blob:full', roundSec: null });
  });
  it('每首內建曲都有 chorusSrc（{id}-chorus.mp4）', () => {
    for (const bt of BUILTIN_TRACKS) expect(bt.chorusSrc).toContain(`${bt.id}-chorus.mp4`);
  });
});
