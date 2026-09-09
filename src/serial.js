// 回傳一個 { send(line), name } 的 sender。
// 真實模式：開 Web Serial；sim 模式：把字串丟給 callback（畫面顯示）。

export async function connectSerial(baud = 115200) {
  if (!('serial' in navigator)) {
    throw new Error('此瀏覽器不支援 Web Serial，請用 Chrome/Edge');
  }
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: baud });
  // 明確拉高 DTR/RTS：有些 CH340 不設會送不出資料（開埠也會 DTR 重置 Arduino）
  try { await port.setSignals({ dataTerminalReady: true, requestToSend: true }); } catch { /* 平台不支援就略過 */ }
  // 直接寫 port.writable（不經 TextEncoderStream pipe，較穩、每筆立即送出）
  const enc = new TextEncoder();
  const writer = port.writable.getWriter();
  return {
    name: 'USB',
    port,
    async send(line) { await writer.write(enc.encode(line)); },
  };
}

export function simSender(onLine) {
  return {
    name: 'SIM',
    async send(line) { onLine(line.trim()); },
  };
}
