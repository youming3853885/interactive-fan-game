import { describe, it, expect } from 'vitest';
import { formatCommand, testChannel } from './protocol.js';

describe('formatCommand', () => {
  it('組出 A,dir,pwm,energy;B,... 一行', () => {
    const line = formatCommand(
      { dir: 'F', pwm: 180, energy: 45.6 },
      { dir: 'R', pwm: 200, energy: 60.1 },
    );
    expect(line).toBe('A,F,180,45;B,R,200,60\n');
  });
});

describe('testChannel（硬體測試：馬達PWM＋燈條）', () => {
  it('PWM 128/燈關 → 正轉 128、燈能量0', () => {
    expect(testChannel(128, false)).toEqual({ dir: 'F', pwm: 128, energy: 0 });
  });
  it('PWM 0/燈開 → 停轉、燈能量100', () => {
    expect(testChannel(0, true)).toEqual({ dir: 'S', pwm: 0, energy: 100 });
  });
  it('PWM 0/燈關 → 全停', () => {
    expect(testChannel(0, false)).toEqual({ dir: 'S', pwm: 0, energy: 0 });
  });
  it('可組成一行測試指令（馬達A PWM64、燈條B）', () => {
    expect(formatCommand(testChannel(64, false), testChannel(0, true)))
      .toBe('A,F,64,0;B,S,0,100\n');
  });
});
