// 遊戲狀態 → 一行 ASCII：A,F,180,45;B,R,200,60\n
// a,b = { dir:'F'|'R'|'S', pwm:0..255, energy:0..100 }
export function formatCommand(a, b) {
  const fmt = (id, c) => `${id},${c.dir},${c.pwm},${Math.trunc(c.energy)}`; // ponytail: trunc matches test spec (45.6→45, 60.1→60)
  return `${fmt('A', a)};${fmt('B', b)}\n`;
}

// 硬體測試：某頻道的「風機/燈條」開關 → 指令物件。風機開=正轉 PWM200，燈條開=能量100。
// 因協定同 token 同時帶馬達(dir,pwm)與燈(energy)，兩者可獨立開關。
export function channelFor(fanOn, ledOn) {
  return { dir: fanOn ? 'F' : 'S', pwm: fanOn ? 200 : 0, energy: ledOn ? 100 : 0 };
}
