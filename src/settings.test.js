import { describe, it, expect } from 'vitest';
import { defaultSettings, loopSeekTime } from './settings.js';

describe('defaultSettings', () => {
  it('每首歌都有預設值 + 全域鏡頭透明度', () => {
    const s = defaultSettings(['a', 'b']);
    expect(s.cameraOpacity).toBe(60);
    expect(s.perTrack.a).toEqual({ start: 0, end: 0, volume: 70, mvOpacity: 100 });
    expect(s.perTrack.b.volume).toBe(70);
  });
});

describe('loopSeekTime', () => {
  it('到達段尾 → 跳回起點', () => {
    expect(loopSeekTime(30, 5, 30)).toBe(5);
    expect(loopSeekTime(31, 5, 30)).toBe(5);
  });
  it('未到段尾 → 不動', () => {
    expect(loopSeekTime(10, 5, 30)).toBe(null);
  });
  it('沒設段尾(end<=0) → 不動', () => {
    expect(loopSeekTime(999, 0, 0)).toBe(null);
  });
});
