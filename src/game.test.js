import { describe, it, expect } from 'vitest';
import { CONFIG, fanCommand } from './game.js';

describe('fanCommand', () => {
  it('停手 → S / pwm 0', () => {
    expect(fanCommand(0, CONFIG)).toEqual({ dir: 'S', pwm: 0 });
  });
  it('正轉 → F / 固定 15% 動力(pwm 38)', () => {
    expect(fanCommand(CONFIG.omegaMax, CONFIG)).toEqual({ dir: 'F', pwm: 38 });
  });
  it('反轉 → R / 固定 15% 動力(pwm 38)', () => {
    expect(fanCommand(-CONFIG.omegaMax, CONFIG)).toEqual({ dir: 'R', pwm: 38 });
  });
});
