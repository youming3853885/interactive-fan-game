// 遊戲狀態 → 一行 ASCII：A,F,180,45;B,R,200,60\n
// a,b = { dir:'F'|'R'|'S', pwm:0..255, energy:0..100 }
export function formatCommand(a, b) {
  const fmt = (id, c) => `${id},${c.dir},${c.pwm},${Math.trunc(c.energy)}`; // ponytail: trunc matches test spec (45.6→45, 60.1→60)
  return `${fmt('A', a)};${fmt('B', b)}\n`;
}

// 馬達分段測試：百分比 → 'M,A,51\n'。>12% 的檔位由韌體限時 5 秒自動回落＋冷卻。
export function motorTestLine(ch, pct) {
  return `M,${ch},${Math.round(255 * pct / 100)}\n`;
}

// 燈條特效碼（與韌體 renderFx 的 case 編號一一對應，改動要兩邊同步）
export const FX = {
  OFF: 0, E65: 1, E100: 2, REVERSE: 3, COMBO_BLUE: 4, COMBO_GOLD: 5,
  COMBO_RAINBOW: 6, FLASH: 7, RED_PULSE: 8, FIREWORK: 9, IDLE_RAINBOW: 10, READY_FILL: 11,
};

// 燈條特效測試：target 'A'|'B'|'D'(兩條) → 'E,D,9\n'
export function effectLine(target, code) {
  return `E,${target},${code}\n`;
}

// 得分閃爍(韌體疊加層，閃 250ms 自動回進度條)：PERFECT=1 金、GREAT=2 白、GOOD=3 藍
export function judgeFlashLine(target, judgment) {
  const n = judgment === 'PERFECT' ? 1 : judgment === 'GREAT' ? 2 : judgment === 'GOOD' ? 3 : 0;
  return n ? `J,${target},${n}\n` : null;
}

// 煙火色調（與韌體 renderFx case 9 對應）：0金白 1紫白 2藍白 3暖橘 4紅白
export const FW_TONE = { GOLD: 0, PURPLE: 1, BLUE: 2, ORANGE: 3, RED: 4 };

// 帶色調的勝利煙火：'E,D,9,<tone>'
export function fireworkLine(target, tone) {
  return `E,${target},${FX.FIREWORK},${tone}\n`;
}

// 最後倒數紅色模式：進度條變紅+脈動
export function urgentLine(on) {
  return `U,${on ? 1 : 0}\n`;
}

// FEVER 狂熱模式：燈條改全彩流動（韌體 V 旗標，優先於紅色模式）
export function feverLine(on) {
  return `V,${on ? 1 : 0}\n`;
}

// Nano 內建 LED(D13)測試指令：'T,1\n'(亮)/'T,0\n'(暗)。用來驗證網頁↔Nano 序列通訊是否正常。
export function builtinLedLine(on) {
  return `T,${on ? 1 : 0}\n`;
}
