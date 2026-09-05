import { describe, it, expect } from 'vitest';
import { CONFIG, initChannel, updateChannel, fanCommand, winner } from './game.js';

describe('updateChannel', () => {
  it('方向做對 → 能量依 ω 累積', () => {
    let s = initChannel('F');               // energy 0, timeToSwitch 0
    s = updateChannel(s, 6, 0.1, CONFIG, () => 0); // rng=0 → requiredDir 'F'
    expect(s.requiredDir).toBe('F');
    expect(s.energy).toBeCloseTo(CONFIG.gain * 6 * 0.1); // 24
  });

  it('方向做錯 → 只緩降，不倒扣到負', () => {
    let s = { energy: 10, requiredDir: 'F', timeToSwitch: 3 };
    s = updateChannel(s, -6, 0.1, CONFIG, () => 0); // dir R ≠ F
    expect(s.energy).toBeCloseTo(10 - CONFIG.decay * 0.1); // 8.5
  });

  it('能量夾在 0 以上', () => {
    let s = { energy: 0.5, requiredDir: 'F', timeToSwitch: 3 };
    s = updateChannel(s, 0, 1, CONFIG, () => 0); // 停手，大幅緩降
    expect(s.energy).toBe(0);
  });

  it('倒數到 0 會重抽方向指令', () => {
    let s = { energy: 0, requiredDir: 'F', timeToSwitch: 0.05 };
    s = updateChannel(s, 0, 0.1, CONFIG, () => 0.9); // rng≥0.5 → 'R'
    expect(s.requiredDir).toBe('R');
    expect(s.timeToSwitch).toBeGreaterThan(0);
  });
});

describe('fanCommand', () => {
  it('停手 → S / pwm 0', () => {
    expect(fanCommand(0, CONFIG)).toEqual({ dir: 'S', pwm: 0 });
  });
  it('滿速正轉 → F / pwm 255', () => {
    expect(fanCommand(CONFIG.omegaMax, CONFIG)).toEqual({ dir: 'F', pwm: 255 });
  });
  it('滿速反轉 → R / pwm 255', () => {
    expect(fanCommand(-CONFIG.omegaMax, CONFIG)).toEqual({ dir: 'R', pwm: 255 });
  });
});

describe('winner', () => {
  it('A 先滿', () => expect(winner({ energy: 100 }, { energy: 50 }, CONFIG)).toBe('A'));
  it('B 先滿', () => expect(winner({ energy: 20 }, { energy: 100 }, CONFIG)).toBe('B'));
  it('都沒滿 → null', () => expect(winner({ energy: 20 }, { energy: 50 }, CONFIG)).toBe(null));
});
