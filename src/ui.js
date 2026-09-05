import { boxFor, pointInBox } from './ready.js';

// 全部畫在 overlay canvas 上。座標系用 canvas 像素。
export function createUI(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = [];
  const colorA = '#2b7bff', colorB = '#ff3b3b'; // 左藍 右紅（固定）
  let guidePhase = 0;                            // 導引圓方向標記的動畫相位

  const SCHOOL = '🏫 澎湖縣湖西鄉龍門國民小學 · 畫圈對決';
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
  function drawTube(xFrac, score, comboMult, color, label, icon) {
    const W = canvas.width, H = canvas.height;
    const bw = W * 0.035, bh = H * 0.6, x = xFrac * W - bw / 2, y = H * 0.2;
    ctx.fillStyle = color; ctx.font = `${Math.round(H * 0.05)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(icon, xFrac * W, y - H * 0.05);
    ctx.strokeStyle = color + 'aa'; ctx.lineWidth = 3;
    roundRectPath(x, y, bw, bh, bw / 2); ctx.stroke();
    const frac = Math.max(0, Math.min(1, score / 3000));
    ctx.save(); roundRectPath(x, y, bw, bh, bw / 2); ctx.clip();
    const cells = 12, gap = bh * 0.012, ch = (bh - gap * (cells - 1)) / cells;
    const lit = Math.round(frac * cells);
    for (let i = 0; i < lit; i++) {
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12;
      const cy = y + bh - (i + 1) * ch - i * gap;
      ctx.fillRect(x, cy, bw, ch);
    }
    ctx.restore(); ctx.shadowBlur = 0;
    ctx.fillStyle = color; ctx.font = `900 ${Math.round(H * 0.03)}px system-ui`;
    ctx.fillText(`${label} ${Math.round(score)}`, xFrac * W, y + bh + H * 0.04);
    ctx.fillStyle = '#ffd76b'; ctx.font = `900 ${Math.round(H * 0.035)}px system-ui`;
    ctx.fillText(`🔥x${comboMult}`, xFrac * W, y + bh + H * 0.09);
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
    ctx.beginPath(); ctx.arc(pt.x, pt.y, H * 0.032, 0, Math.PI * 2);
    ctx.fillStyle = color + '44'; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
    ctx.font = `${Math.round(H * 0.05)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🖐', pt.x, pt.y);
  }

  // 最上層：畫圓運動導引。虛線圓 = 要畫的軌跡；亮點沿圓移動 = 該畫的方向。
  function drawGuide(center, radius, dir, color) {
    ctx.save();
    ctx.strokeStyle = color + 'bb'; ctx.lineWidth = 4; ctx.setLineDash([12, 12]);
    ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    const sign = dir === 'R' ? -1 : 1; // F 順時針、R 逆時針
    const ang = guidePhase * sign;
    const mx = center.x + radius * Math.cos(ang), my = center.y + radius * Math.sin(ang);
    ctx.shadowColor = color; ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(mx, my, canvas.height * 0.02, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 3; i++) {
      const ang = (i / 3) * Math.PI * 2 + x; // 用 x 擾動，避免 Math.random 依賴
      particles.push({ x, y, vx: Math.cos(ang) * 4, vy: Math.sin(ang) * 4, life: 1, color });
    }
  }

  function drawBar(xFrac, energy, color, label) {
    const W = canvas.width, H = canvas.height;
    const bw = W * 0.05, bh = H * 0.7;
    const x = xFrac * W - bw / 2, y = H * 0.15;
    ctx.strokeStyle = '#fff6'; ctx.lineWidth = 3;
    ctx.strokeRect(x, y, bw, bh);
    const fill = (energy / 100) * bh;
    ctx.fillStyle = color;
    ctx.fillRect(x, y + bh - fill, bw, fill);
    ctx.fillStyle = '#fff'; ctx.font = `${Math.round(H * 0.03)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText(`${label} ${Math.round(energy)}%`, xFrac * W, y + bh + H * 0.05);
  }

  function drawArrow(xFrac, dir, color) {
    const W = canvas.width, H = canvas.height;
    const cx = xFrac * W, cy = H * 0.1, r = H * 0.05;
    ctx.strokeStyle = color; ctx.lineWidth = 6;
    ctx.beginPath();
    // dir 'F' 順時針弧、'R' 逆時針弧
    ctx.arc(cx, cy, r, 0, Math.PI * 1.5, dir === 'R');
    ctx.stroke();
    ctx.fillStyle = color; ctx.font = `${Math.round(H * 0.06)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(dir === 'F' ? '↻' : '↺', cx, cy);
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
        ctx.fillText('👋 揮手讓鏡頭看到你', cx, H * 0.4);
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
      ctx.fillText(on ? '✓ ' + label : '👋 ' + label, hx, handY + H * 0.085);
    }

    // 雙手都到 → 大倒數（軀幹中央）
    const bothOn = state.handL && state.handR;
    const remain = Math.max(0, Math.ceil(state.need - state.hold));
    const label = state.ready ? 'GO!' : (bothOn ? String(remain) : '');
    if (label) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ffd76b'; ctx.lineWidth = 6;
      ctx.font = `bold ${Math.round(H * 0.16)}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const my = (shoulderY + hipY) / 2;
      ctx.strokeText(label, cx, my); ctx.fillText(label, cx, my);
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
      drawDivider();
      drawSchool();
      const glyph = state.segDir === 'F' ? '↻ 正轉' : state.segDir === 'R' ? '↺ 反轉' : '⏸ 休息';
      centerText(glyph, 0.12, 0.08, '#fff');
      if (state.nextDir) {
        const nn = state.nextDir === 'F' ? '正轉' : state.nextDir === 'R' ? '反轉' : '休息';
        centerText(`下一個：${nn}  ${Math.ceil(state.nextIn)}`, 0.22, 0.03, '#cdd6ff');
      }
      centerText(`⏱ ${Math.ceil(state.timeLeft)}s`, 0.05, 0.03, '#fff');
      const R = Math.min(W, H) * 0.16;
      guidePhase = (guidePhase + (state.guideOmega || 0) / 60) % (Math.PI * 2);
      if (state.mode === 'single') {
        drawTube(0.5, state.score, state.comboMult, colorA, 'YOU', '🕹️');
        if (state.segDir !== 'S') {
          drawGuide({ x: W * 0.35, y: H * 0.5 }, R, state.segDir, colorA);
          drawGuide({ x: W * 0.65, y: H * 0.5 }, R, state.segDir, colorB);
        }
        drawHand(state.handL, colorA); drawHand(state.handR, colorB);
        if (state.comboMult > prevCombo.S) { triggerBurst(W * 0.5, H * 0.4, colorA, state.comboMult); flash(colorA); }
        prevCombo.S = state.comboMult;
      } else {
        drawTube(0.06, state.A.score, state.A.comboMult, colorA, 'A', '🕹️');
        drawTube(0.94, state.B.score, state.B.comboMult, colorB, 'B', '🎮');
        for (const [side, color, cx] of [['A', colorA, 0.25], ['B', colorB, 0.75]]) {
          if (state.segDir !== 'S') drawGuide({ x: cx * W, y: H * 0.5 }, R, state.segDir, color);
          drawHand(state[side].hand, color);
          if (state[side].comboMult > prevCombo[side]) { triggerBurst(cx * W, H * 0.4, color, state[side].comboMult); flash(color); }
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
