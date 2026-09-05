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
