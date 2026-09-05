// 準備階段：左右各一個方塊，玩家把手放進去持續 need 秒才算就緒。

// 某一側方塊的幾何（canvas 像素）。main 判定手在不在框內、ui 畫框，共用同一組。
export function boxFor(side, W, H) {
  const w = Math.min(W, H) * 0.18;
  const cx = side === 'A' ? W * 0.25 : W * 0.75;
  const cy = H * 0.55;
  return { x: cx - w / 2, y: cy - w / 2, w, h: w };
}

export function pointInBox(pt, box) {
  return pt.x >= box.x && pt.x <= box.x + box.w && pt.y >= box.y && pt.y <= box.y + box.h;
}

// 手在框內 → 累加；離開 → 歸零。回傳 { hold(夾在 need 內), ready }。
export function updateHold(hold, inside, dt, need) {
  const next = inside ? hold + dt : 0;
  return { hold: Math.min(next, need), ready: next >= need };
}
