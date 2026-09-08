import { describe, it, expect } from 'vitest';
import { formatCommand, channelFor } from './protocol.js';

describe('formatCommand', () => {
  it('組出 A,dir,pwm,energy;B,... 一行', () => {
    const line = formatCommand(
      { dir: 'F', pwm: 180, energy: 45.6 },
      { dir: 'R', pwm: 200, energy: 60.1 },
    );
    expect(line).toBe('A,F,180,45;B,R,200,60\n');
  });
});

describe('channelFor（硬體測試開關）', () => {
  it('風機開/燈條關 → 正轉、燈能量0', () => {
    expect(channelFor(true, false)).toEqual({ dir: 'F', pwm: 200, energy: 0 });
  });
  it('風機關/燈條開 → 停轉、燈能量100', () => {
    expect(channelFor(false, true)).toEqual({ dir: 'S', pwm: 0, energy: 100 });
  });
  it('兩者關 → 全停', () => {
    expect(channelFor(false, false)).toEqual({ dir: 'S', pwm: 0, energy: 0 });
  });
  it('可組成一行測試指令（風機A、燈條B）', () => {
    expect(formatCommand(channelFor(true, false), channelFor(false, true)))
      .toBe('A,F,200,0;B,S,0,100\n');
  });
});
