import { describe, it, expect } from 'vitest';
import { formatCommand, motorTestLine, effectLine, builtinLedLine, FX } from './protocol.js';

describe('formatCommand', () => {
  it('組出 A,dir,pwm,energy;B,... 一行', () => {
    const line = formatCommand(
      { dir: 'F', pwm: 180, energy: 45.6 },
      { dir: 'R', pwm: 200, energy: 60.1 },
    );
    expect(line).toBe('A,F,180,45;B,R,200,60\n');
  });
});

describe('motorTestLine（馬達分段測試：百分比→PWM）', () => {
  it('5% → M,A,13', () => {
    expect(motorTestLine('A', 5)).toBe('M,A,13\n');
  });
  it('20% → M,B,51', () => {
    expect(motorTestLine('B', 20)).toBe('M,B,51\n');
  });
  it('30% → M,A,77', () => {
    expect(motorTestLine('A', 30)).toBe('M,A,77\n');
  });
  it('停 → M,A,0', () => {
    expect(motorTestLine('A', 0)).toBe('M,A,0\n');
  });
});

describe('effectLine（燈條特效測試）', () => {
  it('兩條勝利煙火 → E,D,9', () => {
    expect(effectLine('D', FX.FIREWORK)).toBe('E,D,9\n');
  });
  it('1P 全暗 → E,A,0', () => {
    expect(effectLine('A', FX.OFF)).toBe('E,A,0\n');
  });
  it('FX 特效碼與韌體約定一致', () => {
    expect(FX).toEqual({
      OFF: 0, E65: 1, E100: 2, REVERSE: 3, COMBO_BLUE: 4, COMBO_GOLD: 5,
      COMBO_RAINBOW: 6, FLASH: 7, RED_PULSE: 8, FIREWORK: 9, IDLE_RAINBOW: 10, READY_FILL: 11,
    });
  });
});

describe('builtinLedLine（Nano 內建燈測連線）', () => {
  it('亮 → T,1；暗 → T,0', () => {
    expect(builtinLedLine(true)).toBe('T,1\n');
    expect(builtinLedLine(false)).toBe('T,0\n');
  });
});
