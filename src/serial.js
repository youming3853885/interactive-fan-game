// 回傳一個 { send(line), name } 的 sender。
// 真實模式：開 Web Serial；sim 模式：把字串丟給 callback（畫面顯示）。

export async function connectSerial(baud = 115200) {
  if (!('serial' in navigator)) {
    throw new Error('此瀏覽器不支援 Web Serial，請用 Chrome/Edge');
  }
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: baud });
  const encoder = new TextEncoderStream();
  encoder.readable.pipeTo(port.writable);
  const writer = encoder.writable.getWriter();
  return {
    name: 'USB',
    async send(line) { await writer.write(line); },
  };
}

export function simSender(onLine) {
  return {
    name: 'SIM',
    async send(line) { onLine(line.trim()); },
  };
}
