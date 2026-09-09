import { describe, it, expect } from 'vitest';
import { pickArduinoPort } from '../electron/pick-port.cjs';

describe('pickArduinoPort（Electron 自動挑 Arduino 埠）', () => {
  it('優先挑 CH340（vendorId 十六進位 1a86）', () => {
    const list = [
      { portId: 'a', portName: 'COM1' },                      // 主機板內建、無 vendorId
      { portId: 'b', portName: 'COM25', vendorId: '1a86' },   // CH340
    ];
    expect(pickArduinoPort(list)).toBe('b');
  });
  it('CH340 的 vendorId 給十進位 6790 也認得', () => {
    const list = [{ portId: 'x', vendorId: '6790' }];
    expect(pickArduinoPort(list)).toBe('x');
  });
  it('沒 CH340 時挑第一個有 vendorId 的（排除無 vendorId 的 COM1）', () => {
    const list = [
      { portId: 'com1' },                                     // 無 vendorId
      { portId: 'ftdi', vendorId: '0403' },                   // FTDI USB 序列
    ];
    expect(pickArduinoPort(list)).toBe('ftdi');
  });
  it('全都沒 vendorId → 挑第一個', () => {
    expect(pickArduinoPort([{ portId: 'p1' }, { portId: 'p2' }])).toBe('p1');
  });
  it('空清單 → 回空字串', () => {
    expect(pickArduinoPort([])).toBe('');
    expect(pickArduinoPort(undefined)).toBe('');
  });
});
