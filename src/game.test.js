import { describe, it, expect } from 'vitest';
import { CONFIG, fanCommand } from './game.js';

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
