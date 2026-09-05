import { describe, it, expect } from 'vitest';
import { defaultSettings } from './settings.js';

describe('defaultSettings', () => {
  it('每首歌都有預設值 + 全域鏡頭透明度', () => {
    const s = defaultSettings(['a', 'b']);
    expect(s.cameraOpacity).toBe(60);
    expect(s.perTrack.a).toEqual({ volume: 70, mvOpacity: 100 });
    expect(s.perTrack.b.volume).toBe(70);
  });
});
