// 手腕相對肩膀的角度（弧度）。螢幕 y 向下為正，全程一致即可。
export function wristAngle(wrist, shoulder) {
  return Math.atan2(wrist.y - shoulder.y, wrist.x - shoulder.x);
}

// 兩角度間的最短有號差，落在 (-π, π]。
export function angularDelta(prev, curr) {
  let d = curr - prev;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// state = { lastAngle: number|null }；回傳新 state 與角速度 ω (rad/s)。
export function trackRotation(state, angle, dt) {
  if (state.lastAngle === null || dt <= 0) {
    return { state: { lastAngle: angle }, omega: 0 };
  }
  const omega = angularDelta(state.lastAngle, angle) / dt;
  return { state: { lastAngle: angle }, omega };
}

// ω → 方向。deadzone 以下視為停手。
// ponytail: F/R 對應順/逆時針的實際朝向，在整合層用一個 sign 常數校正；此處只管正負。
export function direction(omega, deadzone) {
  if (Math.abs(omega) < deadzone) return 'S';
  return omega > 0 ? 'F' : 'R';
}

// ---- 動態圓心畫圈追蹤 ----
// 舊法用「手腕相對肩膀」的角度，只有繞肩掄大圈才量得到 360°；在胸前畫正常大小的圈
// 角度只會小幅擺動 → 系統以為沒在轉。改用「手腕自己軌跡的移動平均」當圓心：
// 圈畫在哪、畫多大、繞肘還是繞肩，一律量得到完整旋轉。
export const CIRCLE_CFG = {
  windowSec: 1.5,       // 圓心估計窗（涵蓋約一圈；太短圓心會偏、太長跟不上人移動）
  minRadius: 15,        // px：手離圓心太近＝原地抖，不算畫圈
  maxStep: Math.PI / 2, // 單幀角度跳超過 90° 視為偵測尖刺，丟棄該幀
};

export function newCircleState() { return { pts: [], lastAngle: null }; }

// 每幀餵入手腕位置（canvas 座標）；pt=null（掉偵測）會清空重來。回傳角速度 ω (rad/s)。
export function circleStep(st, pt, t, dt, cfg = CIRCLE_CFG) {
  if (!pt) { st.pts.length = 0; st.lastAngle = null; return 0; }
  st.pts.push({ x: pt.x, y: pt.y, t });
  while (st.pts.length && t - st.pts[0].t > cfg.windowSec) st.pts.shift();
  if (st.pts.length < 5) { st.lastAngle = null; return 0; }
  let cx = 0, cy = 0;
  for (const p of st.pts) { cx += p.x; cy += p.y; }
  cx /= st.pts.length; cy /= st.pts.length;
  const dx = pt.x - cx, dy = pt.y - cy;
  if (Math.hypot(dx, dy) < cfg.minRadius) { st.lastAngle = null; return 0; }
  const a = Math.atan2(dy, dx);
  if (st.lastAngle === null || dt <= 0) { st.lastAngle = a; return 0; }
  const d = angularDelta(st.lastAngle, a);
  st.lastAngle = a;
  if (Math.abs(d) > cfg.maxStep) return 0; // 尖刺：丟棄該幀
  return d / dt;
}

// ---- 手臂鎖定 ----
// pickArm 每幀重挑「舉較高的手」，畫圈中另一隻手一抬就跳換目標 → 角度大跳。
// 改成：鎖住目前追蹤的手，連續 maxMiss 幀無效才重挑。
export function createArmPicker(maxMiss = 12) {
  let side = null, miss = 0;
  const cand = (p, s) => {
    const wrist = s === 'L' ? p.leftWrist : p.rightWrist;
    const shoulder = s === 'L' ? p.leftShoulder : p.rightShoulder;
    return (wrist && shoulder && wrist.score > 0.25 && shoulder.score > 0.25) ? { wrist, shoulder } : null;
  };
  return (person) => {
    if (!person) { if (++miss > maxMiss) side = null; return null; }
    if (side) {
      const c = cand(person, side);
      if (c) { miss = 0; return c; }
      if (++miss <= maxMiss) return null; // 短暫掉幀：等它回來，不急著換手
      side = null;
    }
    const L = cand(person, 'L'), R = cand(person, 'R');
    const free = L && R ? (L.wrist.y <= R.wrist.y ? L : R) : (L || R); // 重挑：舉較高者
    if (!free) return null;
    side = free === L ? 'L' : 'R';
    miss = 0;
    return free;
  };
}
