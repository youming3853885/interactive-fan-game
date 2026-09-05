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
  for (const n of [1, 2, 3]) { barImgs[n] = new Image(); barImgs[n].src = import.meta.env.BASE_URL + `bars/bar-${n}.webp`; }
  let guidePhase = 0;                            // 導引圓方向標記的動畫相位

  const SCHOOL = '澎湖縣龍門國小 · 畫圈對決';
  const bursts = [];
  let prevCombo = { A: 1, B: 1, S: 1 };
  const trails = { S: [], A: [], B: [] };  // 手 marker 流星尾
  const fireworks = [];                     // 結算煙火
  const judges = [];                         // 判定文字特效 EXCELLENT/GREAT/GOOD
  // 判定特效（每轉完一圈觸發）：大字彈出 + 上浮 + 淡出，附 +分數。
  function judge(word, pts, mult, x, y, color) {
    judges.push({ word, pts, mult, x, y, color, life: 1 });
  }
  function drawJudges() {
    const H = canvas.height;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = judges.length - 1; i >= 0; i--) {
      const j = judges[i]; j.life -= 0.022; j.y -= H * 0.004;
      if (j.life <= 0) { judges.splice(i, 1); continue; }
      const pop = Math.min(1, (1 - j.life) * 5), sc = 0.6 + pop * 0.5; // 彈入
      const col = j.word === 'EXCELLENT' ? '#ffd76b' : j.word === 'GREAT' ? '#4ec3ff' : '#dfe6ff';
      ctx.save(); ctx.globalAlpha = Math.min(1, j.life * 1.6); ctx.translate(j.x, j.y); ctx.scale(sc, sc);
      ctx.font = `900 ${Math.round(H * 0.07)}px system-ui`;
      ctx.lineWidth = 8; ctx.strokeStyle = '#05070f'; ctx.strokeText(j.word, 0, 0);
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 24; ctx.fillText(j.word, 0, 0);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(H * 0.04)}px system-ui`;
      ctx.fillText(`+${j.pts}`, 0, H * 0.055);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function pushTrail(key, pt) {
    const tr = trails[key];
    if (!pt) { tr.length = 0; return; }
    tr.push({ x: pt.x, y: pt.y }); if (tr.length > 22) tr.shift();
  }
  // 流星尾：頭粗尾細、強發光的漸縮尾巴
  function drawMeteor(key, color) {
    const tr = trails[key]; if (tr.length < 2) return;
    const H = canvas.height;
    ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = color; ctx.shadowBlur = 24;
    for (let i = 1; i < tr.length; i++) {
      const f = i / tr.length; // 越接近頭越粗越亮
      ctx.globalAlpha = f * f * 0.9; ctx.strokeStyle = f > 0.7 ? '#ffffff' : color;
      ctx.lineWidth = H * 0.03 * f + 1.5;
      ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  // 手 marker：鎖在圈上（angle 由 main 依累積角度算），流星尾 + 飄散粒子。
  function drawMarker(key, cx, cy, R, angle, color, active) {
    const H = canvas.height, mx = cx + R * Math.cos(angle), my = cy + R * Math.sin(angle);
    pushTrail(key, { x: mx, y: my });
    drawMeteor(key, color);
    if (active) { // 沿路飄散不規則粒子
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3.5;
        particles.push({ x: mx, y: my, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 1, color, r: 2 + Math.random() * 3 });
      }
    }
    ctx.save(); ctx.beginPath(); ctx.arc(mx, my, H * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#00000066'; ctx.fill(); ctx.shadowColor = color; ctx.shadowBlur = 26;
    ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.stroke(); ctx.restore();
    ctx.font = `${Math.round(H * 0.07)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🖐', mx, my);
  }
  // combo 等級 → 全畫面邊框光暈升級（越高越亮越華麗）
  function drawComboAura(mult) {
    if (mult < 2) return;
    const W = canvas.width, H = canvas.height, t = Math.min(1, (mult - 1) / 4);
    const col = mult >= 5 ? '#ff3bd0' : mult >= 4 ? '#ff6b3b' : mult >= 3 ? '#ffd76b' : '#4ec3ff';
    const pulse = 0.65 + 0.35 * Math.sin(guidePhase * 4);
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 45 * t * pulse; ctx.strokeStyle = col;
    ctx.globalAlpha = 0.55 * t; ctx.lineWidth = Math.max(6, H * 0.03 * t);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function spawnFirework(x, y, color) {
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2, sp = 4 + (i % 4);
      fireworks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color });
    }
  }
  function drawFireworks() {
    const H = canvas.height;
    for (let i = fireworks.length - 1; i >= 0; i--) {
      const p = fireworks[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.vx *= 0.98; p.life -= 0.018;
      if (p.life <= 0) { fireworks.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(p.x, p.y, H * 0.006, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  let victoryKey = '', victoryT = 0;
  function starPath(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5;
      const px = x + rr * Math.cos(a), py = y + rr * Math.sin(a);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
  function drawStars(cx, cy, n, ease) {
    const H = canvas.height, R = H * 0.05, gap = H * 0.11;
    for (let i = 0; i < 3; i++) {
      const on = i < n, x = cx + (i - 1) * gap;
      ctx.save(); ctx.translate(x, cy); ctx.scale(ease, ease);
      starPath(0, 0, R);
      ctx.fillStyle = on ? gold : '#ffffff22';
      if (on) { ctx.shadowColor = gold; ctx.shadowBlur = 22; }
      ctx.fill(); ctx.shadowBlur = 0; ctx.restore();
    }
  }
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

  // 7 段數位顯示
  const SEG7 = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcfgd' };
  function drawDigit(x, y, w, h, ch, onC) {
    const t = w * 0.18, off = '#ffffff10', S = SEG7[ch] || '';
    const put = (k, rx, ry, rw, rh) => {
      if (S.includes(k)) { ctx.fillStyle = onC; ctx.shadowColor = onC; ctx.shadowBlur = w * 0.28; }
      else { ctx.fillStyle = off; ctx.shadowBlur = 0; }
      ctx.fillRect(rx, ry, rw, rh); ctx.shadowBlur = 0;
    };
    put('a', x + t, y, w - 2 * t, t); put('g', x + t, y + h / 2 - t / 2, w - 2 * t, t); put('d', x + t, y + h - t, w - 2 * t, t);
    put('f', x, y + t, t, h / 2 - 1.5 * t); put('b', x + w - t, y + t, t, h / 2 - 1.5 * t);
    put('e', x, y + h / 2 + t / 2, t, h / 2 - 1.5 * t); put('c', x + w - t, y + h / 2 + t / 2, t, h / 2 - 1.5 * t);
  }
  // 遊戲式電子鐘 MM:SS；剩時 ≤10 秒轉紅並脈動。
  function drawClock(cx, cy, secs) {
    const H = canvas.height, low = secs <= 10, onC = low ? '#ff3b3b' : '#3fe0ff';
    const mm = Math.floor(secs / 60), ss = secs % 60;
    const digs = [Math.floor(mm / 10) % 10, mm % 10, Math.floor(ss / 10), ss % 10];
    const dh = H * 0.11, dw = dh * 0.6, gap = dw * 0.22, colonW = dw * 0.5;
    const total = dw * 4 + gap * 3 + colonW; const y = cy - dh / 2;
    const scale = low ? (1 + 0.05 * Math.sin(guidePhase * 6)) : 1;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.translate(-cx, -cy);
    let x = cx - total / 2;
    const padx = dh * 0.30, pady = dh * 0.24;
    ctx.fillStyle = '#05070fe6'; ctx.strokeStyle = onC; ctx.lineWidth = 3; ctx.shadowColor = onC; ctx.shadowBlur = low ? 26 : 16;
    roundRectPath(x - padx, y - pady, total + padx * 2, dh + pady * 2, dh * 0.22); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = onC; ctx.font = `900 ${Math.round(dh * 0.22)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('T I M E', cx, y - pady * 0.15);
    drawDigit(x, y, dw, dh, digs[0], onC); x += dw + gap; drawDigit(x, y, dw, dh, digs[1], onC); x += dw + gap;
    ctx.fillStyle = onC; ctx.shadowColor = onC; ctx.shadowBlur = dh * 0.2;
    ctx.beginPath(); ctx.arc(x + colonW / 2, y + dh * 0.33, dw * 0.09, 0, Math.PI * 2); ctx.arc(x + colonW / 2, y + dh * 0.67, dw * 0.09, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; x += colonW + gap;
    drawDigit(x, y, dw, dh, digs[2], onC); x += dw + gap; drawDigit(x, y, dw, dh, digs[3], onC);
    ctx.restore();
  }
  // 右上「下一個」小旋轉箭頭 + 秒數（不與其他元件重疊）
  function drawNextHint(dir, n) {
    if (!dir) return;
    const W = canvas.width, H = canvas.height, x = W - H * 0.13, y = H * 0.11;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#aeb8e0'; ctx.font = `${Math.round(H * 0.026)}px system-ui`; ctx.fillText('下一個', x, y - H * 0.06);
    if (dir === 'S') {
      ctx.fillStyle = '#aeb8e0'; ctx.font = `900 ${Math.round(H * 0.04)}px system-ui`; ctx.fillText('休息', x, y + H * 0.01);
    } else {
      const sign = dir === 'R' ? -1 : 1, r = H * 0.032, col = dir === 'R' ? colorB : colorA;
      const a0 = -Math.PI / 2, a1 = a0 + Math.PI * 1.4 * sign;
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.shadowColor = col; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(x, y, r, a0, a1, sign < 0); ctx.stroke();
      const tx = x + r * Math.cos(a1), ty = y + r * Math.sin(a1), tang = a1 + sign * Math.PI / 2, head = r * 0.7;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - head * Math.cos(tang - sign * 0.6), ty - head * Math.sin(tang - sign * 0.6));
      ctx.moveTo(tx, ty); ctx.lineTo(tx - head * Math.cos(tang + sign * 0.6), ty - head * Math.sin(tang + sign * 0.6)); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(H * 0.045)}px system-ui`; ctx.fillText(String(Math.ceil(n)), x, y + H * 0.08);
    ctx.restore();
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
    ctx.fillStyle = o.color || '#fff'; ctx.font = `900 ${Math.round(h * 0.55)}px system-ui`;
    ctx.fillText(`得分：${Math.round(o.score)} 分`, x + w * 0.5, y - h * 0.28);
    if (o.comboMult > 1) {
      ctx.fillStyle = gold; ctx.font = `900 ${Math.round(h * 0.5)}px system-ui`;
      ctx.fillText(`COMBO x${o.comboMult}`, x + w * 0.85, y - h * 0.28);
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

  // 圓心大旋轉箭頭（取代黃色導引圈）：F 順時針、R 逆時針，沿方向轉。S=暫停圖。
  function dirArrow(center, radius, dir, color) {
    const { x: cx, y: cy } = center;
    if (dir === 'S' || dir == null) { // 休息：暫停雙槓
      ctx.save(); ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 24;
      const bw = radius * 0.24, bh = radius * 0.9, g = radius * 0.22;
      roundRectPath(cx - g - bw, cy - bh / 2, bw, bh, bw * 0.3); ctx.fill();
      roundRectPath(cx + g, cy - bh / 2, bw, bh, bw * 0.3); ctx.fill();
      ctx.restore(); return;
    }
    const sign = dir === 'R' ? -1 : 1; // F 順時針、R 逆時針
    const a0 = -Math.PI / 2 + guidePhase * sign, a1 = a0 + Math.PI * 1.55 * sign;
    ctx.save(); ctx.lineCap = 'round';
    // 深色襯底弧
    ctx.strokeStyle = '#000000aa'; ctx.lineWidth = radius * 0.22;
    ctx.beginPath(); ctx.arc(cx, cy, radius, a0, a1, sign < 0); ctx.stroke();
    // 彩色弧 + 發光
    ctx.strokeStyle = color; ctx.lineWidth = radius * 0.16; ctx.shadowColor = color; ctx.shadowBlur = radius * 0.35;
    ctx.beginPath(); ctx.arc(cx, cy, radius, a0, a1, sign < 0); ctx.stroke();
    // 箭頭
    const head = radius * 0.42, tx = cx + radius * Math.cos(a1), ty = cy + radius * Math.sin(a1), tang = a1 + sign * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty); ctx.lineTo(tx - head * Math.cos(tang - sign * 0.5), ty - head * Math.sin(tang - sign * 0.5));
    ctx.moveTo(tx, ty); ctx.lineTo(tx - head * Math.cos(tang + sign * 0.5), ty - head * Math.sin(tang + sign * 0.5));
    ctx.stroke(); ctx.restore();
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

  // 單人單一中央目標圈座標（draw 與 hit-test 共用），回傳 canvas 像素。
  function singleTargets() {
    const W = canvas.width, H = canvas.height;
    return { r: H * 0.12, C: { x: W / 2, y: H * 0.44 } };
  }
  // 手是否放進中央目標圈（容忍 1.3×半徑）。
  function handInTarget(hand) {
    if (!hand) return false;
    const t = singleTargets();
    return Math.hypot(hand.x - t.C.x, hand.y - t.C.y) <= t.r * 1.3;
  }

  // 單人準備：中央一個目標圈，單手放進圈內維持 5 秒開始。
  // state = { need, hold, ready, hand }
  function drawReadySingle(state) {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(4,5,12,0.55)'; ctx.fillRect(0, 0, W, H);
    centerText('把一隻手放進中央圈圈，維持 5 秒開始', 0.10, 0.034, '#fff');

    const t = singleTargets(), cx = t.C.x, cy = t.C.y, inTgt = handInTarget(state.hand);
    // 目標圈
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, t.r, 0, Math.PI * 2);
    if (inTgt) { ctx.fillStyle = colorA + '44'; ctx.fill(); ctx.shadowColor = colorA; ctx.shadowBlur = 34; }
    ctx.setLineDash(inTgt ? [] : [12, 10]);
    ctx.strokeStyle = inTgt ? colorA : '#ffffffaa'; ctx.lineWidth = inTgt ? 8 : 5; ctx.stroke();
    ctx.restore();

    // 倒數 / 提示
    const remain = Math.max(0, Math.ceil(state.need - state.hold));
    const label = state.ready ? 'GO!' : (inTgt ? String(remain) : '');
    if (label) {
      const big = state.ready ? H * 0.16 : H * 0.22;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.round(big)}px system-ui`;
      ctx.lineWidth = 10; ctx.strokeStyle = '#05070f'; ctx.strokeText(label, cx, cy);
      ctx.fillStyle = '#fff'; ctx.shadowColor = gold; ctx.shadowBlur = 24; ctx.fillText(label, cx, cy); ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#ffffffcc'; ctx.font = `bold ${Math.round(H * 0.03)}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('把手移進來', cx, cy);
    }

    drawHand(state.hand, colorA); // 實際手部亮點
  }

  function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  const api = {
    drawReady,
    drawReadySingle,
    handInTarget,
    judge,
    clear,
    onComboBurst: null,
    boxHit(hand, side) {
      return hand ? pointInBox(hand, boxFor(side, canvas.width, canvas.height)) : false;
    },
    render(state) {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      // 遊玩區把 MV 壓暗（半透明黑遮罩）→ 導引圓/能量條看得超清楚
      ctx.fillStyle = 'rgba(4,5,12,0.62)'; ctx.fillRect(0, 0, W, H);
      if (state.mode !== 'single') drawDivider(); // 單人不分左右
      drawSchool();
      drawClock(W / 2, H * 0.11, Math.max(0, Math.ceil(state.timeLeft))); // 遊戲式電子鐘
      drawNextHint(state.nextDir, state.nextIn);                           // 右上：下一個
      const spin = Math.max(3.5, state.guideOmega || 0); // rad/s，至少看得到在轉
      guidePhase = (guidePhase + spin / 60) % (Math.PI * 2);
      const gFrac = (s) => Math.max(0, Math.min(1, s / 3000));
      const maxMult = state.mode === 'single' ? state.comboMult : Math.max(state.A.comboMult, state.B.comboMult);
      drawComboAura(maxMult); // combo 等級 → 全畫面光環升級
      if (state.mode === 'single') {
        const R = Math.min(W, H) * 0.28, cx = W * 0.5, cy = H * 0.44;
        dirArrow({ x: cx, y: cy }, R * 0.52, state.segDir, state.segDir === 'R' ? colorB : colorA); // 中心方向箭頭（縮小）
        drawMarker('S', cx, cy, R, state.markerAngle, colorA, state.active); // 手鎖圈上（軌道隱藏）
        drawGauge({ x: W * 0.09, y: H * 0.80, w: W * 0.82, h: H * 0.12, color: colorA, style: state.barStyle,
          frac: gFrac(state.score), score: state.score, comboMult: state.comboMult, label: '', showLR: false });
        if (state.comboMult > prevCombo.S) { triggerBurst(cx, cy, gold, state.comboMult); flash(colorA); }
        prevCombo.S = state.comboMult;
      } else {
        const R = Math.min(W, H) * 0.22;
        for (const [side, color, cxf, gx] of [['A', colorA, 0.25, 0.04], ['B', colorB, 0.75, 0.52]]) {
          const cx = cxf * W, cy = H * 0.44;
          dirArrow({ x: cx, y: cy }, R * 0.52, state.segDir, color);
          drawMarker(side, cx, cy, R, state[side].markerAngle, color, state[side].active);
          drawGauge({ x: gx * W, y: H * 0.84, w: W * 0.44, h: H * 0.11, color, style: state.barStyle,
            frac: gFrac(state[side].score), score: state[side].score, comboMult: state[side].comboMult,
            label: '', showLR: false });
          if (state[side].comboMult > prevCombo[side]) { triggerBurst(cx, cy, color, state[side].comboMult); flash(color); }
          prevCombo[side] = state[side].comboMult;
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; p.life -= 0.03;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      drawJudges();
      drawBursts();
    },

    // 華麗結算（逐幀動畫）：評級彈出 + 分數 count-up + 星星 + 週期煙火。主迴圈每幀呼叫。
    victory(result) {
      const W = canvas.width, H = canvas.height, cx = W / 2;
      const key = JSON.stringify(result);
      if (key !== victoryKey) { victoryKey = key; victoryT = 0; fireworks.length = 0; }
      victoryT++;
      const p = Math.min(1, victoryT / 45), ease = 1 - Math.pow(1 - p, 3); // 入場彈跳
      ctx.fillStyle = '#000d'; ctx.fillRect(0, 0, W, H);
      // 週期煙火
      if (victoryT % 16 === 0) {
        const cols = ['#ffd76b', '#4ec3ff', '#ff6bd0', '#8effc0'];
        spawnFirework(W * (0.25 + 0.5 * ((victoryT / 16) % 2)), H * (0.22 + 0.1 * ((victoryT / 32) % 2)), cols[(victoryT / 16) % cols.length]);
      }
      drawFireworks();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (result.mode === 'single') {
        const stars = { S: 3, A: 2, B: 1, C: 0 }[result.grade] ?? 0;
        drawStars(cx, H * 0.24, stars, ease);
        ctx.save(); ctx.translate(cx, H * 0.44); ctx.scale(0.3 + ease * 0.7, 0.3 + ease * 0.7);
        ctx.fillStyle = gold; ctx.shadowColor = gold; ctx.shadowBlur = 40; ctx.font = `900 ${Math.round(H * 0.22)}px system-ui`;
        ctx.fillText(result.grade, 0, 0); ctx.restore();
        ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(H * 0.06)}px system-ui`;
        ctx.fillText(`分數 ${Math.round(result.score * ease)}`, cx, H * 0.64);
      } else {
        ctx.save(); ctx.translate(cx, H * 0.4); ctx.scale(0.3 + ease * 0.7, 0.3 + ease * 0.7);
        ctx.fillStyle = result.who === 'A' ? colorA : result.who === 'B' ? colorB : '#fff';
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 30; ctx.font = `900 ${Math.round(H * 0.11)}px system-ui`;
        ctx.fillText(result.who ? `玩家 ${result.who} 勝利！` : '平手！', 0, 0); ctx.restore();
        ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(H * 0.055)}px system-ui`;
        ctx.fillText(`A ${Math.round(result.scoreA * ease)} : ${Math.round(result.scoreB * ease)} B`, cx, H * 0.6);
      }
      ctx.fillStyle = '#aeb4d8'; ctx.font = `${Math.round(H * 0.025)}px system-ui`;
      ctx.shadowBlur = 0; ctx.fillText(SCHOOL, cx, H * 0.78);
    },
  };
  return api;
}
