// 遊戲狀態 → 一行 ASCII：A,F,180,45;B,R,200,60\n
// a,b = { dir:'F'|'R'|'S', pwm:0..255, energy:0..100 }
export function formatCommand(a, b) {
  const fmt = (id, c) => `${id},${c.dir},${c.pwm},${Math.trunc(c.energy)}`; // ponytail: trunc matches test spec (45.6→45, 60.1→60)
  return `${fmt('A', a)};${fmt('B', b)}\n`;
}

// 硬體測試：某頻道的「馬達 PWM + 燈條開關」→ 指令物件。
// pwm>0 正轉到該 PWM、pwm=0 停；燈開=能量100。同 token 同時帶馬達與燈，兩者獨立。
export function testChannel(pwm, ledOn) {
  return { dir: pwm > 0 ? 'F' : 'S', pwm: Math.max(0, Math.trunc(pwm)), energy: ledOn ? 100 : 0 };
}
