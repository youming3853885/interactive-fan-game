// 回傳一個 { send(line), name } 的 sender。
// 真實模式：開 Web Serial；sim 模式：把字串丟給 callback（畫面顯示）。

export async function connectSerial(baud = 115200) {
  if (!('serial' in navigator)) {
    throw new Error('此瀏覽器不支援 Web Serial，請用 Chrome/Edge');
  }
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: baud });
  // 直接寫 port.writable，每筆加逾時：寫入卡住(埠沒在收/被佔用)就報錯，不無聲卡死
  const enc = new TextEncoder();
  const writer = port.writable.getWriter();
  return {
    name: 'USB',
    port,
    async send(line) {
      let timer;
      const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('寫入逾時(埠沒在收/被佔用)')), 1200); });
      try { await Promise.race([writer.write(enc.encode(line)), timeout]); }
      finally { clearTimeout(timer); }
    },
  };
}

export function simSender(onLine) {
  return {
    name: 'SIM',
    async send(line) { onLine(line.trim()); },
  };
}
