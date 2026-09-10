// 依 BPM 決定性生成段落表（正F/反R/休S），對齊節拍。
export function chartFromBpm(bpm, stars, roundSec) {
  const beatSec = 60 / bpm;
  const segBeats = Math.max(4, Math.round(8 / beatSec));
  const pattern = stars >= 4 ? ['F', 'R', 'F', 'R', 'S'] : ['F', 'R', 'S'];
  const segLen = segBeats * beatSec;
  const restLen = Math.min(10, Math.max(8, segLen)); // 休息段固定 8~10 秒：讓風機與玩家喘息
  const chart = [];
  let t = 0, i = 0;
  while (t < roundSec) {
    const dir = pattern[i % pattern.length];
    const end = Math.min(t + (dir === 'S' ? restLen : segLen), roundSec);
    chart.push({ dir, startSec: t, endSec: end });
    t = end; i++;
  }
  return chart;
}

// 查 t 秒時的當前段/下一段/當前剩餘秒。超過結尾回 current:null。
export function segmentAt(chart, t) {
  for (let i = 0; i < chart.length; i++) {
    if (t < chart[i].endSec) {
      return { current: chart[i], next: chart[i + 1] || null, remain: chart[i].endSec - t };
    }
  }
  return { current: null, next: null, remain: 0 };
}
