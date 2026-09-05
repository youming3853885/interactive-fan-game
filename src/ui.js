import { boxFor, pointInBox } from './ready.js';

// 全部畫在 overlay canvas 上。座標系用 canvas 像素。
export function createUI(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = [];
  const colorA = '#2b7bff', colorB = '#ff3b3b'; // 左藍 右紅（固定）
  const gold = '#ffd76b';
  // 三款能量條底圖（codex 生成）+ 可填充通道座標（占底圖框的比例，端蓋已內縮避開）
  const BAR_META = {
    1: { chXL: 0.10, chXR: 0.90, chYT: 0.331, chYB: 0.620 }, // 科技HUD藍
    2: { chXL: 0.11, chXR: 0.89, chYT: 0.363, chYB: 0.604 }, // 街機紅黃
    3: { chXL: 0.10, chXR: 0.90, chYT: 0.324, chYB: 0.658 }, // 霓虹管
  };
  const barImgs = {};
  for (const n of [1, 2, 3]) { barImgs[n] = new Image(); barImgs[n].src = import.meta.env.BASE_URL + `bars/bar-${n}.png`; }
  let guidePhase = 0;                            // 導引圓方向標記的動畫相位

  const SCHOOL = '澎湖縣龍門國小 · 畫圈對決';
  const bursts = [];
  let prevCombo = { A: 1, B: 1, S: 1 };
  function drawSchool() {
    ctx.fillStyle = '#dfe6ff'; ctx.font = `${Math.round(canvas.height * 0.022)}px system-ui`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(SCHOOL, canvas.width * 0.012, canvas.height * 0.02);
  }
  function triggerBurst(cx, cy, color, mult) {
    bursts.push({ x: cx, y: cy, color, mult, life: 1 });
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; particles.push({ x: cx, y: cy, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, life: 1, color }); }
    if (api.onComboBurst) api.onComboBurst(mult);
  }
  function drawBursts() {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.life -= 0.02; b.y -= 2;
      if (b.life <= 0) { bursts.splice(i, 1); continue; }
      ctx.globalAlpha = b.life; ctx.fillStyle = b.color;
      ctx.font = `900 ${Math.round(canvas.height * 0.08)}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`COMBO x${b.mult}!`, b.x, b.y);
      ctx.globalAlpha = 1;
    }
  }
  function flash(color) {
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
  }
  function roundRectPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // 能量條：codex 底圖(3款可選) + 未填滿處暗罩露出底圖=進度。
  // o = { x, y, w, h, frac, score, comboMult, label, color, style, showLR, lActive, rActive }
  function drawGauge(o) {
    const { x, y, w, h } = o;
    const frac = Math.max(0, Math.min(1, o.frac));
    const style = BAR_META[o.style] ? o.style : 1;
    const meta = BAR_META[style], img = barImgs[style];
    if (img.complete && img.naturalWidth) {
      ctx.drawImage(img, x, y, w, h);
      const chXL = x + w * meta.chXL, chXR = x + w * meta.chXR;
      const chY = y + h * meta.chYT, chH = h * (meta.chYB - meta.chYT);
      const fillX = chXL + frac * (chXR - chXL);
      ctx.save(); ctx.globalAlpha = 0.8; ctx.fillStyle = '#02030a';
      ctx.fillRect(fillX, chY, chXR - fillX, chH); ctx.restore();
    } else { // 底圖未載入的退路：簡單實心條
      ctx.save(); roundRectPath(x, y, w, h, h * 0.5); ctx.fillStyle = '#0a0e1ad9'; ctx.fill();
      ctx.fillStyle = o.color || '#5bd6ff'; ctx.fillRect(x + h * 0.2, y + h * 0.3, (w - h * 0.4) * frac, h * 0.4); ctx.restore();
    }
    // 玩家色外框光暈（雙人辨識 A/B）
    if (o.color) {
      ctx.save(); ctx.strokeStyle = o.color; ctx.lineWidth = Math.max(2, h * 0.05);
      ctx.shadowColor = o.color; ctx.shadowBlur = 16;
      roundRectPath(x + w * 0.01, y + h * 0.06, w * 0.98, h * 0.88, h * 0.4); ctx.stroke(); ctx.restore();
    }
    // 兩端 L / R 指示環（僅單人）：該手正確畫圈才亮
    if (o.showLR) {
      for (const [cx, on, col, txt] of [[x + w * 0.05, o.lActive, colorA, 'L'], [x + w * 0.95, o.rActive, colorR, 'R']]) {
        const cyy = y + h * 0.5, rr = h * 0.32;
        ctx.save();
        ctx.shadowColor = on ? col : 'transparent'; ctx.shadowBlur = on ? 26 : 0;
        ctx.strokeStyle = on ? col : '#ffffff55'; ctx.lineWidth = on ? 5 : 3;
        ctx.beginPath(); ctx.arc(cx, cyy, rr, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        ctx.fillStyle = on ? '#fff' : '#8891b5'; ctx.font = `900 ${Math.round(h * 0.34)}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, cx, cyy);
      }
    }
    // 分數 + Combo（條上方）
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = o.color || '#fff'; ctx.font = `900 ${Math.round(h * 0.6)}px system-ui`;
    ctx.fillText(`${o.label} ${Math.round(o.score)}`, x + w * 0.5, y - h * 0.28);
    if (o.comboMult > 1) {
      ctx.fillStyle = gold; ctx.font = `900 ${Math.round(h * 0.52)}px system-ui`;
      ctx.fillText(`COMBO x${o.comboMult}`, x + w * 0.82, y - h * 0.28);
    }
  }

  function resize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // 左右分隔：中央亮線 + 兩側極淡色調，讓左右邊界一目了然。
  function drawDivider() {
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = colorA + '14'; ctx.fillRect(0, 0, W / 2, H);
    ctx.fillStyle = colorB + '14'; ctx.fillRect(W / 2, 0, W / 2, H);
    ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 3;
    ctx.setLineDash([14, 12]);
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.setLineDash([]);
  }

  function centerText(text, yFrac, sizeFrac, color) {
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = color; ctx.font = `bold ${Math.round(H * sizeFrac)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, H * yFrac);
  }

  function centerTextAt(xFrac, yFrac, text, sizeFrac, color) {
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = color; ctx.font = `bold ${Math.round(H * sizeFrac)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, W * xFrac, H * yFrac);
  }

  // 玩家手部：手腕位置畫手掌圖示 + 側色光環，方便知道手在哪。
  function drawHand(pt, color) {
    if (!pt) return;
    const H = canvas.height;
    ctx.save();
    // 深色底環 + 發光，讓手在花俏 MV 上仍清楚
    ctx.beginPath(); ctx.arc(pt.x, pt.y, H * 0.064, 0, Math.PI * 2);
    ctx.fillStyle = '#00000066'; ctx.fill();
    ctx.shadowColor = color; ctx.shadowBlur = 24;
    ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.stroke();
    ctx.restore();
    ctx.font = `${Math.round(H * 0.10)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🖐', pt.x, pt.y);
  }

  // 最上層：畫圓運動導引。虛線圓 = 要畫的軌跡；亮點沿圓移動 = 該畫的方向。
  function drawGuide(center, radius, dir, color) {
    ctx.save();
    // 1) 深色襯底環（實線、較粗）→ 不論 MV 多花都看得到圈
    ctx.strokeStyle = '#000000aa'; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, Math.PI * 2); ctx.stroke();
    // 2) 彩色虛線圈 + 發光疊在上面
    ctx.shadowColor = color; ctx.shadowBlur = 20;
    ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.setLineDash([16, 14]);
    ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // 3) 沿圈移動的方向亮點（大顆 + 深色描邊 + 發光）
    const sign = dir === 'R' ? -1 : 1; // F 順時針、R 逆時針
    const ang = guidePhase * sign;
    const mx = center.x + radius * Math.cos(ang), my = center.y + radius * Math.sin(ang);
    ctx.shadowBlur = 26;
    ctx.beginPath(); ctx.arc(mx, my, canvas.height * 0.032, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + x; // 用 x 擾動，避免 Math.random 依賴
      particles.push({ x, y, vx: Math.cos(ang) * 4, vy: Math.sin(ang) * 4, life: 1, color });
    }
  }

  // 準備階段：分隔 + 每側方塊 + 揮手/放手提示 + 5秒進度。
  // state = { need, A:{hand, hold, ready}, B:{...} }
  function drawReady(state) {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    drawDivider();
    centerText('兩位玩家站定位，把手放進方塊維持 5 秒開始', 0.08, 0.035, '#fff');
    for (const [side, color] of [['A', colorA], ['B', colorB]]) {
      const s = state[side];
      const box = boxFor(side, W, H);
      // 側邊提示文字
      ctx.fillStyle = color; ctx.font = `bold ${Math.round(H * 0.03)}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cx = side === 'A' ? W * 0.25 : W * 0.75;
      if (!s.hand) {
        ctx.fillText('揮手讓鏡頭看到你', cx, H * 0.4);
      } else {
        // 方塊：固定側色（左藍右紅），不變色
        ctx.strokeStyle = color; ctx.lineWidth = 6;
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        // 由下往上填進度（側色）
        const f = (s.hold / state.need) * box.h;
        ctx.fillStyle = color + '55';
        ctx.fillRect(box.x, box.y + box.h - f, box.w, f);
        // 手掌圖示（先畫，倒數數字疊在上面）
        drawHand(s.hand, color);
        // 大倒數 5→0（框正中央）
        const remain = Math.max(0, Math.ceil(state.need - s.hold));
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = color; ctx.lineWidth = 6;
        ctx.font = `bold ${Math.round(box.h * 0.7)}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const label = s.ready ? 'GO!' : String(remain);
        ctx.strokeText(label, box.x + box.w / 2, box.y + box.h / 2);
        ctx.fillText(label, box.x + box.w / 2, box.y + box.h / 2);
        // 說明字（框上方，側色）
        ctx.fillStyle = color; ctx.font = `bold ${Math.round(H * 0.028)}px system-ui`;
        ctx.fillText('把手放進方塊維持', cx, box.y - H * 0.045);
      }
    }
  }

  // 單人準備：不分割，中央虛線人形輪廓 + 左右手目標環；雙手都被鏡頭看到才倒數。
  // state = { need, hold, ready, handL, handR }
  function drawReadySingle(state) {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    centerText('站到鏡頭前，舉起左右手讓鏡頭看到你，維持 5 秒開始', 0.08, 0.032, '#fff');

    const cx = W / 2;
    const headY = H * 0.30, headR = H * 0.055;
    const shoulderY = H * 0.40, hipY = H * 0.64;
    const handLx = cx - W * 0.15, handRx = cx + W * 0.15, handY = H * 0.24;

    // 虛線人形輪廓
    ctx.save();
    ctx.setLineDash([14, 12]);
    ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(cx, headY, headR, 0, Math.PI * 2);               // 頭
    ctx.moveTo(cx, headY + headR); ctx.lineTo(cx, hipY);      // 軀幹
    ctx.moveTo(cx, shoulderY); ctx.lineTo(handLx, handY);     // 左臂舉高
    ctx.moveTo(cx, shoulderY); ctx.lineTo(handRx, handY);     // 右臂舉高
    ctx.moveTo(cx, hipY); ctx.lineTo(cx - W * 0.06, H * 0.84);// 左腿
    ctx.moveTo(cx, hipY); ctx.lineTo(cx + W * 0.06, H * 0.84);// 右腿
    ctx.stroke();
    ctx.restore();

    // 左右手目標環：被偵測到就點亮
    for (const [hand, hx, color, label] of [[state.handL, handLx, colorA, '左手'], [state.handR, handRx, colorB, '右手']]) {
      const on = !!hand;
      ctx.beginPath(); ctx.arc(hx, handY, H * 0.05, 0, Math.PI * 2);
      ctx.save();
      if (on) { ctx.fillStyle = color + '55'; ctx.fill(); ctx.shadowColor = color; ctx.shadowBlur = 30; }
      ctx.setLineDash(on ? [] : [10, 8]);
      ctx.strokeStyle = on ? color : '#ffffff88'; ctx.lineWidth = on ? 6 : 4; ctx.stroke();
      ctx.restore();
      ctx.fillStyle = on ? color : '#ffffffaa'; ctx.font = `bold ${Math.round(H * 0.026)}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(on ? '已偵測 ' + label : '舉起 ' + label, hx, handY + H * 0.085);
    }

    // 雙手都到 → 大倒數（軀幹中央）
    const bothOn = state.handL && state.handR;
    const remain = Math.max(0, Math.ceil(state.need - state.hold));
    const label = state.ready ? 'GO!' : (bothOn ? String(remain) : '');
    if (label) {
      const my = (shoulderY + hipY) / 2;
      const big = state.ready ? H * 0.22 : H * 0.30; // 數字比 GO! 更大
      // 深色圓底 + 環，讓數字在花俏 MV 上超清楚
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, my, big * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = '#05070fcc'; ctx.fill();
      ctx.lineWidth = 8; ctx.strokeStyle = gold; ctx.shadowColor = gold; ctx.shadowBlur = 30; ctx.stroke();
      ctx.restore();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.round(big)}px system-ui`;
      ctx.lineWidth = 10; ctx.strokeStyle = '#05070f'; ctx.strokeText(label, cx, my);
      ctx.fillStyle = '#fff'; ctx.fillText(label, cx, my);
    }

    // 實際手部亮點
    drawHand(state.handL, colorA);
    drawHand(state.handR, colorB);
  }

  function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  const api = {
    drawReady,
    drawReadySingle,
    clear,
    onComboBurst: null,
    boxHit(hand, side) {
      return hand ? pointInBox(hand, boxFor(side, canvas.width, canvas.height)) : false;
    },
    render(state) {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      if (state.mode !== 'single') drawDivider(); // 單人不分左右
      drawSchool();
      const glyph = state.segDir === 'F' ? '↻ 正轉' : state.segDir === 'R' ? '↺ 反轉' : '休息';
      centerText(glyph, 0.12, 0.08, '#fff');
      if (state.nextDir) {
        const nn = state.nextDir === 'F' ? '正轉' : state.nextDir === 'R' ? '反轉' : '休息';
        centerText(`下一個：${nn}  ${Math.ceil(state.nextIn)}`, 0.22, 0.03, '#cdd6ff');
      }
      centerText(`剩餘 ${Math.ceil(state.timeLeft)} 秒`, 0.05, 0.03, '#fff');
      guidePhase = (guidePhase + (state.guideOmega || 0) / 60) % (Math.PI * 2);
      const gFrac = (s) => Math.max(0, Math.min(1, s / 3000));
      if (state.mode === 'single') {
        // 單一大導引圓（雙手共用）
        const R = Math.min(W, H) * 0.26;
        if (state.segDir !== 'S') drawGuide({ x: W * 0.5, y: H * 0.42 }, R, state.segDir, gold);
        drawHand(state.handL, colorA); drawHand(state.handR, colorB);
        drawGauge({ x: W * 0.09, y: H * 0.80, w: W * 0.82, h: H * 0.12, color: colorA, style: state.barStyle,
          frac: gFrac(state.score), score: state.score, comboMult: state.comboMult,
          label: 'YOU', showLR: true, lActive: state.lActive, rActive: state.rActive });
        if (state.comboMult > prevCombo.S) { triggerBurst(W * 0.5, H * 0.42, gold, state.comboMult); flash(colorA); }
        prevCombo.S = state.comboMult;
      } else {
        const R = Math.min(W, H) * 0.2;
        for (const [side, color, cx, gx] of [['A', colorA, 0.25, 0.04], ['B', colorB, 0.75, 0.52]]) {
          if (state.segDir !== 'S') drawGuide({ x: cx * W, y: H * 0.42 }, R, state.segDir, color);
          drawHand(state[side].hand, color);
          drawGauge({ x: gx * W, y: H * 0.84, w: W * 0.44, h: H * 0.11, color, style: state.barStyle,
            frac: gFrac(state[side].score), score: state[side].score, comboMult: state[side].comboMult,
            label: side, showLR: false });
          if (state[side].comboMult > prevCombo[side]) { triggerBurst(cx * W, H * 0.42, color, state[side].comboMult); flash(color); }
          prevCombo[side] = state[side].comboMult;
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; p.life -= 0.03;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      drawBursts();
    },

    victory(result) {
      ctx.fillStyle = '#000c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cx = canvas.width / 2, H = canvas.height;
      if (result.mode === 'single') {
        ctx.fillStyle = '#ffd76b'; ctx.font = `900 ${Math.round(H * 0.16)}px system-ui`;
        ctx.fillText(result.grade, cx, H * 0.4);
        ctx.fillStyle = '#fff'; ctx.font = `${Math.round(H * 0.05)}px system-ui`;
        ctx.fillText(`分數 ${Math.round(result.score)}`, cx, H * 0.58);
      } else {
        ctx.fillStyle = result.who === 'A' ? colorA : result.who === 'B' ? colorB : '#fff';
        ctx.font = `900 ${Math.round(H * 0.1)}px system-ui`;
        ctx.fillText(result.who ? `玩家 ${result.who} 勝利！` : '平手！', cx, H * 0.4);
        ctx.fillStyle = '#fff'; ctx.font = `${Math.round(H * 0.05)}px system-ui`;
        ctx.fillText(`A ${Math.round(result.scoreA)} : ${Math.round(result.scoreB)} B`, cx, H * 0.56);
      }
      ctx.fillStyle = '#aeb4d8'; ctx.font = `${Math.round(H * 0.025)}px system-ui`;
      ctx.fillText(SCHOOL, cx, H * 0.7);
    },
  };
  return api;
}
