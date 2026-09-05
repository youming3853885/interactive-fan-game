import { boxFor, pointInBox } from './ready.js';

// 全部畫在 overlay canvas 上。座標系用 canvas 像素。
export function createUI(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = [];
  const colorA = '#4ec3ff', colorB = '#ff6b9d';

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
        // 手的位置點
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(s.hand.x, s.hand.y, 12, 0, Math.PI * 2); ctx.fill();
        const remain = Math.ceil(state.need - s.hold);
        ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(H * 0.05)}px system-ui`;
        ctx.fillText(s.ready ? 'OK ✓' : `把手放進方塊 ${remain}`, cx, box.y - H * 0.05);
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
    // state = { A:{energy,requiredDir,hand}, B:{...} }；hand = {wrist} 或 null
    render(state) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawDivider();
      drawBar(0.06, state.A.energy, colorA, 'A');
      drawBar(0.94, state.B.energy, colorB, 'B');
      drawArrow(0.2, state.A.requiredDir, colorA);
      drawArrow(0.8, state.B.requiredDir, colorB);

      // 手上噴粒子（座標需主迴圈換算成 canvas 像素後傳入）
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
    },

    victory(who) {
      ctx.fillStyle = '#000a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = who === 'A' ? '#4ec3ff' : '#ff6b9d';
      ctx.font = `${Math.round(canvas.height * 0.12)}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`玩家 ${who} 勝利！`, canvas.width / 2, canvas.height / 2);
    },
  };
}
