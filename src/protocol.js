// 遊戲狀態 → 一行 ASCII：A,F,180,45;B,R,200,60\n
// a,b = { dir:'F'|'R'|'S', pwm:0..255, energy:0..100 }
export function formatCommand(a, b) {
  const fmt = (id, c) => `${id},${c.dir},${c.pwm},${Math.trunc(c.energy)}`; // ponytail: trunc matches test spec (45.6→45, 60.1→60)
  return `${fmt('A', a)};${fmt('B', b)}\n`;
}
