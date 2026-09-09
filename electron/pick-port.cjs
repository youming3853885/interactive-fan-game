// 從 Electron select-serial-port 的 portList 挑出要連的 Arduino 埠。
// Electron 的 vendorId 是字串，可能是十六進位("1a86")或十進位("6790")，兩種都比對。
function matchesVid(p, targetHex) {
  if (!p || p.vendorId == null || p.vendorId === '') return false;
  const s = String(p.vendorId).replace(/^0x/i, '');
  return parseInt(s, 16) === targetHex || parseInt(s, 10) === targetHex;
}
function hasVid(p) {
  return p && p.vendorId != null && p.vendorId !== '';
}

function pickArduinoPort(portList) {
  const ports = (portList || []).filter(Boolean);
  if (ports.length === 0) return '';
  const KNOWN = [0x1a86, 0x0403, 0x10c4, 0x2341]; // CH340 / FTDI / CP210x / Arduino
  let hit = ports.find((p) => matchesVid(p, 0x1a86));                       // 1) CH340 優先
  if (!hit) hit = ports.find((p) => KNOWN.some((v) => matchesVid(p, v)));   // 2) 其他常見 USB 轉序列
  if (!hit) hit = ports.find(hasVid);                                       // 3) 任何有 USB vendorId 的(排除內建 COM1)
  if (!hit) hit = ports[0];                                                 // 4) 退而求其次
  return hit && hit.portId ? hit.portId : '';
}

module.exports = { pickArduinoPort, matchesVid };
