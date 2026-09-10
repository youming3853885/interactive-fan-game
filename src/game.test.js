import { describe, it, expect } from 'vitest';
import { CONFIG, fanRun } from './game.js';

describe('fanRun（殘缺版：整場固定正轉）', () => {
  it('固定正轉 20%(pwm 51)', () => {
    expect(fanRun(CONFIG)).toEqual({ dir: 'F', pwm: 51 });
  });
});
