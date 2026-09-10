import { describe, it, expect } from 'vitest';
import { wristAngle, angularDelta, trackRotation, direction, newCircleState, circleStep, createArmPicker } from './motion.js';

describe('circleStep（動態圓心畫圈追蹤）', () => {
  const DT = 1 / 30;
  const runCircle = (st, { cx, cy, r, w, from, to }) => {
    let acc = 0;
    for (let i = Math.round(from / DT); i < Math.round(to / DT); i++) {
      const t = i * DT;
      const pt = { x: cx + r * Math.cos(w * t), y: cy + r * Math.sin(w * t) };
      acc += circleStep(st, pt, t, DT) * DT;
    }
    return acc;
  };
  it('在任意位置畫圈（不繞肩膀）→ 量得到接近真實角速度', () => {
    const st = newCircleState();
    runCircle(st, { cx: 300, cy: 200, r: 80, w: 4, from: 0, to: 2 });        // 暖機
    const acc = runCircle(st, { cx: 300, cy: 200, r: 80, w: 4, from: 2, to: 4 }); // 穩態 2 秒
    expect(acc).toBeGreaterThan(4 * 2 * 0.75); // 累積角度 ≈ w×2 秒（容忍 25%）
    expect(acc).toBeLessThan(4 * 2 * 1.25);
  });
  it('小圈也量得到（半徑 40px）', () => {
    const st = newCircleState();
    runCircle(st, { cx: 500, cy: 400, r: 40, w: 5, from: 0, to: 2 });
    const acc = runCircle(st, { cx: 500, cy: 400, r: 40, w: 5, from: 2, to: 4 });
    expect(acc).toBeGreaterThan(5 * 2 * 0.7);
  });
  it('原地不動（手抖）→ ω=0', () => {
    const st = newCircleState();
    let om = 0;
    for (let i = 0; i < 90; i++) om = circleStep(st, { x: 100 + (i % 2), y: 100 }, i * DT, DT);
    expect(om).toBe(0);
  });
  it('掉偵測(null) → 清空重來、ω=0', () => {
    const st = newCircleState();
    runCircle(st, { cx: 300, cy: 200, r: 80, w: 4, from: 0, to: 2 });
    expect(circleStep(st, null, 2, DT)).toBe(0);
    expect(st.pts.length).toBe(0);
  });
  it('單幀瞬移（偵測尖刺）→ 該幀丟棄不產生假 ω', () => {
    const st = newCircleState();
    runCircle(st, { cx: 300, cy: 200, r: 80, w: 4, from: 0, to: 2 });
    const om = circleStep(st, { x: 300, y: 200 - 80 }, 2, DT); // 突然跳到對面
    expect(om).toBe(0);
  });
});

describe('createArmPicker（手臂鎖定）', () => {
  const kp = (x, y, score = 0.9) => ({ x, y, score });
  const person = (lw, rw) => ({
    leftWrist: lw, leftShoulder: kp(100, 300), rightWrist: rw, rightShoulder: kp(300, 300),
  });
  it('先鎖舉較高的手', () => {
    const pick = createArmPicker();
    const a = pick(person(kp(100, 100), kp(300, 250)));
    expect(a.wrist.x).toBe(100); // 左手較高
  });
  it('另一隻手舉更高也不跳換（黏住原手）', () => {
    const pick = createArmPicker();
    pick(person(kp(100, 100), kp(300, 250)));
    const a = pick(person(kp(100, 200), kp(300, 50))); // 右手突然更高
    expect(a.wrist.x).toBe(100); // 仍是左手
  });
  it('鎖定的手短暫消失 → 回 null 不換手；超過 maxMiss 才重挑', () => {
    const pick = createArmPicker(3);
    pick(person(kp(100, 100), kp(300, 250)));
    const gone = person(kp(100, 100, 0.1), kp(300, 250)); // 左手信心掉光
    expect(pick(gone)).toBe(null);
    expect(pick(gone)).toBe(null);
    expect(pick(gone)).toBe(null);
    const a = pick(gone); // 第 4 次：重挑 → 換右手
    expect(a.wrist.x).toBe(300);
  });
});

describe('wristAngle', () => {
  it('手腕在肩右側 → 角度 0', () => {
    expect(wristAngle({ x: 1, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(0);
  });
});

describe('angularDelta', () => {
  it('跨 ±π 回繞取最短路徑', () => {
    expect(angularDelta(3.0, -3.0)).toBeCloseTo(2 * Math.PI - 6.0);
  });
});

describe('trackRotation', () => {
  it('第一幀無前值 → ω=0', () => {
    const { omega } = trackRotation({ lastAngle: null }, 0.0, 0.1);
    expect(omega).toBe(0);
  });
  it('0.5 rad / 0.1 s → ω=5', () => {
    let r = trackRotation({ lastAngle: null }, 0.0, 0.1);
    r = trackRotation(r.state, 0.5, 0.1);
    expect(r.omega).toBeCloseTo(5);
  });
});

describe('direction', () => {
  it('死區內 → S', () => expect(direction(0.5, 1.5)).toBe('S'));
  it('正 → F', () => expect(direction(6, 1.5)).toBe('F'));
  it('負 → R', () => expect(direction(-6, 1.5)).toBe('R'));
});
