import { describe, it, expect } from 'vitest';
import { formatCommand } from './protocol.js';

describe('formatCommand', () => {
  it('組出 A,dir,pwm,energy;B,... 一行', () => {
    const line = formatCommand(
      { dir: 'F', pwm: 180, energy: 45.6 },
      { dir: 'R', pwm: 200, energy: 60.1 },
    );
    expect(line).toBe('A,F,180,45;B,R,200,60\n');
  });
});
