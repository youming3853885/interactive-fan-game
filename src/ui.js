import { boxFor, pointInBox } from './ready.js';

// 全部畫在 overlay canvas 上。座標系用 canvas 像素。
export function createUI(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = [];
  const colorA = '#2b7bff', colorB = '#ff3b3b'; // 左藍 右紅（固定）
  let guidePhase = 0;                            // 導引圓方向標記的動畫相位

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
        // 方塊
        ctx.strokeStyle = s.ready ? '#5dff9b' : color; ctx.lineWidth = 5;
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        // 由下往上填進度
        const f = (s.hold / state.need) * box.h;
        ctx.fillStyle = (s.ready ? '#5dff9b' : color) + '66';
        ctx.fillRect(box.x, box.y + box.h - f, box.w, f);
        const remain = Math.ceil(state.need - s.hold);
        ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(H * 0.05)}px system-ui`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s.ready ? 'OK ✓' : `把手放進方塊 ${remain}`, cx, box.y - H * 0.05);
        // 手掌圖示
        drawHand(s.hand, color);
      }
    }
  }

  function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return {
    drawReady,
    clear,
    boxHit(hand, side) {
      return hand ? pointInBox(hand, boxFor(side, canvas.width, canvas.height)) : false;
    },
    // state = { timeLeft, segDir, nextDir, nextIn, guideOmega,
    //           A:{score, comboMult, hand, shoulder}, B:{...} }
    render(state) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width, H = canvas.height;
      drawDivider();

      const glyph = state.segDir === 'F' ? '↻ 正轉' : state.segDir === 'R' ? '↺ 反轉' : '⏸ 休息';
      centerText(glyph, 0.12, 0.08, '#fff');
      if (state.nextDir) {
        const nn = state.nextDir === 'F' ? '正轉' : state.nextDir === 'R' ? '反轉' : '休息';
        centerText(`下一個：${nn}  ${Math.ceil(state.nextIn)}`, 0.22, 0.03, '#cdd6ff');
      }
      centerText(`⏱ ${Math.ceil(state.timeLeft)}s`, 0.05, 0.03, '#fff');

      const frac = (v) => Math.max(0, Math.min(1, v / 3000));
      drawBar(0.06, frac(state.A.score) * 100, colorA, `A  ${Math.round(state.A.score)}`);
      drawBar(0.94, frac(state.B.score) * 100, colorB, `B  ${Math.round(state.B.score)}`);
      centerTextAt(0.2, 0.9, `x${state.A.comboMult}`, 0.045, colorA);
      centerTextAt(0.8, 0.9, `x${state.B.comboMult}`, 0.045, colorB);

      for (const [side, color] of [['A', colorA], ['B', colorB]]) {
        const h = state[side].hand;
        if (h) spawnParticles(h.x, h.y, color);
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life -= 0.04;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      guidePhase = (guidePhase + (state.guideOmega || 0) / 60) % (Math.PI * 2);
      const R = Math.min(W, H) * 0.16;
      for (const [side, color] of [['A', colorA], ['B', colorB]]) {
        const s = state[side];
        const center = s.shoulder || { x: (side === 'A' ? 0.25 : 0.75) * W, y: H * 0.5 };
        if (state.segDir !== 'S') drawGuide(center, R, state.segDir, color);
        drawHand(s.hand, color);
      }
    },

    victory(who, scoreA, scoreB) {
      ctx.fillStyle = '#000a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = who === 'A' ? colorA : who === 'B' ? colorB : '#fff';
      ctx.font = `${Math.round(canvas.height * 0.1)}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const title = who ? `玩家 ${who} 勝利！` : '平手！';
      ctx.fillText(title, canvas.width / 2, canvas.height * 0.42);
      ctx.font = `${Math.round(canvas.height * 0.05)}px system-ui`;
      ctx.fillStyle = '#fff';
      ctx.fillText(`A ${Math.round(scoreA)}  :  ${Math.round(scoreB)} B`, canvas.width / 2, canvas.height * 0.56);
    },
  };
}
