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
  // 得分手感：每累積 FLOAT_STEP 分就從得分處噴一個「+N」上浮字
  const floaters = [];
  const FLOAT_STEP = 100;
  const scoreAcc = { S: 0, A: 0, B: 0 }, prevScoreVal = { S: 0, A: 0, B: 0 };
  function scoreJuice(key, score, x, y, color) {
    const prev = prevScoreVal[key]; prevScoreVal[key] = score;
    if (score < prev) { scoreAcc[key] = 0; return; } // 新局歸零
    scoreAcc[key] += score - prev;
    let n = 0;
    while (scoreAcc[key] >= FLOAT_STEP && n < 3) { // 單幀最多噴 3 個避免爆量
      scoreAcc[key] -= FLOAT_STEP; n++;
      floaters.push({ x: x + ((floaters.length % 3) - 1) * canvas.width * 0.02, y, vy: -canvas.height * 0.012, life: 1, color, text: '+' + FLOAT_STEP });
    }
  }
  function drawFloaters() {
    const H = canvas.height;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.y += f.vy; f.life -= 0.02;
      if (f.life <= 0) { floaters.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.font = `900 ${Math.round(H * 0.045)}px system-ui`;
      ctx.lineWidth = 5; ctx.strokeStyle = '#05070f'; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.shadowColor = f.color; ctx.shadowBlur = 14; ctx.fillText(f.text, f.x, f.y); ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
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
      if (state.mode === 'single') {
        // 圓心大旋轉箭頭（正轉藍/反轉紅），無外圈；單手
        const R = Math.min(W, H) * 0.26;
        dirArrow({ x: W * 0.5, y: H * 0.44 }, R, state.segDir, state.segDir === 'R' ? colorB : colorA);
        drawHand(state.hand, colorA);
        drawGauge({ x: W * 0.09, y: H * 0.80, w: W * 0.82, h: H * 0.12, color: colorA, style: state.barStyle,
          frac: gFrac(state.score), score: state.score, comboMult: state.comboMult, label: 'YOU', showLR: false });
        scoreJuice('S', state.score, W * 0.5, H * 0.72, gold);
        if (state.comboMult > prevCombo.S) { triggerBurst(W * 0.5, H * 0.42, gold, state.comboMult); flash(colorA); }
        prevCombo.S = state.comboMult;
      } else {
        const R = Math.min(W, H) * 0.22;
        for (const [side, color, cx, gx] of [['A', colorA, 0.25, 0.04], ['B', colorB, 0.75, 0.52]]) {
          dirArrow({ x: cx * W, y: H * 0.44 }, R, state.segDir, color); // 各側玩家色大箭頭
          drawHand(state[side].hand, color);
          drawGauge({ x: gx * W, y: H * 0.84, w: W * 0.44, h: H * 0.11, color, style: state.barStyle,
            frac: gFrac(state[side].score), score: state[side].score, comboMult: state[side].comboMult,
            label: side, showLR: false });
          scoreJuice(side, state[side].score, cx * W, H * 0.74, color);
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
      drawFloaters();
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
