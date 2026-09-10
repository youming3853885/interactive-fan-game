import { saveSettings, defaultTrackSetting } from './settings.js';
import { FX } from './protocol.js';

// 齒輪按鈕 + 設定彈窗(modal)，分兩個分頁：
//   「硬體測試」：連接 + 馬達分段動力(5%~30%) + 燈條特效預覽（展場開演前逐一檢查用）
//   「遊戲設定」：鏡頭透明度 + 能量條風格 + 每首歌音量/MV透明度
// 任何遊戲設定變更即時套用(media.applySettings)並存 localStorage；硬體測試狀態不存檔。
export function createSettingsPanel(hud, settings, media, arduino) {
  const gear = document.createElement('button');
  gear.textContent = '設定';
  gear.style.cssText =
    'position:absolute;top:10px;right:12px;z-index:6;background:#222b;color:#fff;border:1px solid #fff5;' +
    'border-radius:8px;padding:8px 14px;cursor:pointer;font-size:15px;';

  const backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
    'background:#000a;pointer-events:auto;z-index:30;';

  const modal = document.createElement('div');
  modal.style.cssText =
    'width:min(92vw,440px);max-height:86vh;overflow:auto;background:#12131cf7;color:#fff;' +
    'border:1px solid #fff3;border-radius:14px;padding:20px;font-size:14px;box-shadow:0 20px 60px #000a;';
  backdrop.appendChild(modal);

  // 特效預覽動畫用的 keyframes（只注入一次）
  if (!document.getElementById('fx-preview-css')) {
    const st = document.createElement('style');
    st.id = 'fx-preview-css';
    st.textContent =
      '@keyframes fxShift{from{background-position:0 0}to{background-position:240px 0}}' +
      '@keyframes fxPulse{0%,100%{opacity:.15}50%{opacity:1}}' +
      '@keyframes fxBreathe{0%,100%{opacity:.15}50%{opacity:.7}}' +
      '@keyframes fxFill{from{width:0}to{width:100%}}' +
      '@keyframes fxFlash{0%{opacity:1}100%{opacity:0}}';
    document.head.appendChild(st);
  }

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;';
  const title = document.createElement('div');
  title.textContent = '設定'; title.style.cssText = 'font-size:18px;font-weight:bold;';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:transparent;color:#fff;border:none;font-size:20px;cursor:pointer;';
  head.append(title, closeBtn);
  modal.append(head);

  const onCss = 'background:#2b7bff;color:#fff;border:1px solid #6ea8ff;';
  const offCss = 'background:#ffffff12;color:#cdd6ff;border:1px solid #fff3;';

  // ---- 分頁 ----
  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;gap:6px;margin-bottom:14px;';
  const hwPane = document.createElement('div');
  const gamePane = document.createElement('div');
  const tabBtns = [];
  const showPane = (i) => {
    hwPane.style.display = i === 0 ? '' : 'none';
    gamePane.style.display = i === 1 ? '' : 'none';
    tabBtns.forEach((b, j) => {
      b.style.cssText = 'flex:1;padding:10px;border-radius:8px;cursor:pointer;font-weight:700;font-size:14px;' + (i === j ? onCss : offCss);
    });
  };
  for (const [i, name] of [[0, '硬體測試'], [1, '遊戲設定']]) {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('click', () => showPane(i));
    tabBtns.push(b); tabs.append(b);
  }
  modal.append(tabs, hwPane, gamePane);

  // ============ 分頁 1：硬體測試 ============
  let resetHwTest = null;
  if (arduino) {
    // 連接
    const conn = document.createElement('div');
    conn.style.cssText = 'margin-bottom:14px;padding:12px;background:#ffffff10;border-radius:8px;display:flex;flex-direction:column;gap:8px;';
    const ct = document.createElement('div'); ct.textContent = '連接（Arduino）'; ct.style.cssText = 'font-weight:bold;';
    conn.append(ct, arduino.btn);
    if (arduino.disc) conn.append(arduino.disc);
    conn.append(arduino.status);
    hwPane.append(conn);

    // 測試區（自檢期間整區鎖住）
    const box = document.createElement('div');
    hwPane.append(box);

    // Nano 內建燈（D13）：測「網頁↔Nano」序列通訊是否正常，與馬達/驅動板無關。
    if (arduino.testLed) {
      let nanoOn = false;
      const nb = document.createElement('button');
      const paintNb = () => {
        nb.textContent = `Nano 內建燈（測連線）：${nanoOn ? '亮' : '暗'}`;
        nb.style.cssText = 'width:100%;margin-bottom:14px;padding:10px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;' + (nanoOn ? onCss : offCss);
      };
      nb.addEventListener('click', () => { nanoOn = !nanoOn; paintNb(); arduino.testLed(nanoOn); });
      paintNb();
      box.append(nb);
    }

    // ---- 馬達分段動力 ----
    const PCT_LEVELS = [0, 5, 10, 15, 20, 25, 30];
    const HIGH_PCT = 20; // 超過 15% 韌體上限的檔位：跑 5 秒自動回落
    const warnCss = 'background:#ffffff12;color:#f5c542;border:1px solid #f5c542aa;';
    const hotCss = 'background:#ffffff12;color:#ff6b5e;border:1px solid #ff6b5eaa;';
    const mBox = document.createElement('div');
    mBox.style.cssText = 'margin-bottom:14px;padding:12px;background:#ffffff10;border-radius:8px;';
    const mt = document.createElement('div');
    mt.textContent = '馬達動力（點檔位＝持續轉，點「停」停止）';
    mt.style.cssText = 'font-weight:bold;margin-bottom:8px;';
    mBox.append(mt);
    const motor = { A: 0, B: 0 };
    const motorBtns = { A: [], B: [] };
    let revertTimer = { A: 0, B: 0 };
    const paintMotor = (ch) => motorBtns[ch].forEach(({ el, pct }) => {
      const base = pct >= 30 ? hotCss : pct >= 20 ? warnCss : offCss;
      el.style.cssText = 'flex:1;padding:8px 2px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;' + (motor[ch] === pct ? onCss : base);
    });
    const setMotor = (ch, pct) => {
      motor[ch] = pct; paintMotor(ch);
      arduino.motorTest(ch, pct);
      clearTimeout(revertTimer[ch]);
      if (pct >= HIGH_PCT) revertTimer[ch] = setTimeout(() => { motor[ch] = 0; paintMotor(ch); }, 5000); // 跟著韌體限時回落
    };
    for (const [ch, label] of [['A', '1P'], ['B', '2P']]) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:6px;';
      const lab = document.createElement('span');
      lab.textContent = label; lab.style.cssText = 'min-width:26px;font-weight:700;font-size:13px;';
      row.append(lab);
      for (const pct of PCT_LEVELS) {
        const b = document.createElement('button');
        b.textContent = pct === 0 ? '停' : `${pct}%`;
        motorBtns[ch].push({ el: b, pct });
        b.addEventListener('click', () => setMotor(ch, pct));
        row.append(b);
      }
      paintMotor(ch);
      mBox.append(row);
    }
    // 兩台同轉（驗證電流餘裕）
    const dualRow = document.createElement('div');
    dualRow.style.cssText = 'display:flex;gap:6px;margin-top:2px;';
    const dualBtn = document.createElement('button');
    dualBtn.textContent = '兩台同轉 15%（錯開啟動）';
    dualBtn.style.cssText = 'flex:3;padding:8px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;' + offCss;
    // 先踢 A 起轉，0.6 秒後再踢 B：避免兩台同時抽峰值電流把電源打趴（跟遊戲中韌體踢腳錯開同理）
    dualBtn.addEventListener('click', () => {
      setMotor('A', 25); setTimeout(() => setMotor('A', 15), 400);
      setTimeout(() => { setMotor('B', 25); setTimeout(() => setMotor('B', 15), 400); }, 600);
    });
    const dualStop = document.createElement('button');
    dualStop.textContent = '停';
    dualStop.style.cssText = 'flex:1;padding:8px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;' + offCss;
    dualStop.addEventListener('click', () => { setMotor('A', 0); setMotor('B', 0); });
    dualRow.append(dualBtn, dualStop);
    mBox.append(dualRow);
    const mNote = document.createElement('div');
    mNote.textContent = '20% 以上為高檔位：跑 5 秒自動停，之後 8 秒冷卻內只給 15%，避免驅動板過熱。實測堵轉門檻約 10%。';
    mNote.style.cssText = 'font-size:12px;color:#9aa3c0;margin-top:6px;line-height:1.5;';
    mBox.append(mNote);
    box.append(mBox);

    // ---- 燈條特效 ----
    const fxBox = document.createElement('div');
    fxBox.style.cssText = 'margin-bottom:14px;padding:12px;background:#ffffff10;border-radius:8px;';
    const ft = document.createElement('div');
    ft.textContent = '燈條特效（預覽遊戲中所有效果）';
    ft.style.cssText = 'font-weight:bold;margin-bottom:8px;';
    fxBox.append(ft);
    // 套用目標
    let target = 'D';
    const tgtRow = document.createElement('div');
    tgtRow.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:8px;';
    const tgtLab = document.createElement('span');
    tgtLab.textContent = '套用到'; tgtLab.style.cssText = 'min-width:48px;font-weight:700;font-size:13px;';
    tgtRow.append(tgtLab);
    const tgtBtns = [];
    const paintTgt = () => tgtBtns.forEach(({ el, val }) => {
      el.style.cssText = 'flex:1;padding:7px 2px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;' + (target === val ? onCss : offCss);
    });
    for (const [val, label] of [['A', '1P'], ['B', '2P'], ['D', '兩條']]) {
      const b = document.createElement('button');
      b.textContent = label;
      tgtBtns.push({ el: b, val });
      b.addEventListener('click', () => { target = val; paintTgt(); });
      tgtRow.append(b);
    }
    paintTgt();
    fxBox.append(tgtRow);
    // 模擬預覽條：網頁端畫出燈條「應該的樣子」，實體沒跟上＝接線/電源問題
    const strip = document.createElement('div');
    strip.style.cssText = 'height:14px;border-radius:7px;background:#000;border:1px solid #fff2;margin-bottom:8px;overflow:hidden;';
    const stripFill = document.createElement('div');
    stripFill.style.cssText = 'height:100%;width:0;';
    strip.append(stripFill);
    fxBox.append(strip);
    const RAINBOW = 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)';
    const PREVIEW = { // code → 模擬條 cssText（近似就好，實體以韌體為準）
      [FX.OFF]: 'width:0;',
      [FX.E65]: 'width:65%;background:#00e5ff;',
      [FX.E100]: 'width:100%;background:#00e5ff;',
      [FX.REVERSE]: 'width:65%;margin-left:auto;background:repeating-linear-gradient(90deg,#00e5ff 0 34px,#fff 34px 40px);background-size:240px 100%;animation:fxShift 1.2s linear infinite reverse;',
      [FX.COMBO_BLUE]: 'width:100%;background:#2b7bff;',
      [FX.COMBO_GOLD]: 'width:100%;background:#ffb400;',
      [FX.COMBO_RAINBOW]: `width:100%;background:${RAINBOW};background-size:240px 100%;animation:fxShift 1.5s linear infinite;`,
      [FX.FLASH]: 'width:100%;background:#fff;animation:fxFlash .3s forwards;',
      [FX.RED_PULSE]: 'width:100%;background:#f22;animation:fxPulse .85s ease-in-out infinite;',
      [FX.FIREWORK]: 'width:100%;background:repeating-linear-gradient(90deg,#1a0530 0 26px,#ffd700 26px 30px,#1a0530 30px 52px,#fff 52px 55px);background-size:240px 100%;animation:fxShift .8s steps(8) infinite;',
      [FX.IDLE_RAINBOW]: `width:100%;background:${RAINBOW};background-size:240px 100%;animation:fxShift 6s linear infinite,fxBreathe 4s ease-in-out infinite;`,
      [FX.READY_FILL]: 'width:100%;background:#2ecc71;animation:fxFill 3s linear infinite;',
    };
    const EFFECTS = [
      [FX.E65, '能量條 65%'], [FX.E100, '能量條 100%'], [FX.REVERSE, '反轉倒流'],
      [FX.COMBO_BLUE, 'combo 藍'], [FX.COMBO_GOLD, 'combo 金'], [FX.COMBO_RAINBOW, 'combo 彩虹'],
      [FX.FLASH, 'PERFECT 閃白'], [FX.RED_PULSE, '最後10秒紅脈衝'], [FX.FIREWORK, '勝利煙火'],
      [FX.IDLE_RAINBOW, '待機彩虹呼吸'], [FX.READY_FILL, '就位漸滿'], [FX.OFF, '全暗'],
    ];
    let curFx = FX.OFF;
    const fxGrid = document.createElement('div');
    fxGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;';
    const fxBtns = [];
    const paintFx = () => fxBtns.forEach(({ el, code }) => {
      el.style.cssText = 'padding:9px 4px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;' + (curFx === code ? onCss : offCss);
    });
    let flashTimer = 0;
    const setFx = (code) => {
      curFx = code; paintFx();
      stripFill.style.cssText = 'height:100%;' + (PREVIEW[code] || 'width:0;');
      arduino.effect(target, code);
      clearTimeout(flashTimer);
      if (code === FX.FLASH) flashTimer = setTimeout(() => { curFx = FX.OFF; paintFx(); }, 400); // 一次性：跟著韌體回全暗
    };
    for (const [code, label] of EFFECTS) {
      const b = document.createElement('button');
      b.textContent = label;
      fxBtns.push({ el: b, code });
      b.addEventListener('click', () => setFx(code));
      fxGrid.append(b);
    }
    paintFx();
    fxBox.append(fxGrid);
    box.append(fxBox);

    // 全部停止
    const stopAll = document.createElement('button');
    stopAll.textContent = '全部停止（馬達＋燈條）';
    stopAll.style.cssText = 'width:100%;padding:9px;border-radius:8px;cursor:pointer;background:#c0392b;color:#fff;border:none;font-weight:700;font-size:14px;';
    const reset = (doSend) => {
      clearTimeout(revertTimer.A); clearTimeout(revertTimer.B); clearTimeout(flashTimer);
      const any = motor.A || motor.B || curFx !== FX.OFF;
      motor.A = 0; motor.B = 0; paintMotor('A'); paintMotor('B');
      curFx = FX.OFF; paintFx(); stripFill.style.cssText = 'height:100%;width:0;';
      if (doSend && any) { arduino.motorTest('A', 0); arduino.motorTest('B', 0); arduino.effect('D', FX.OFF); }
    };
    stopAll.addEventListener('click', () => reset(true));
    box.append(stopAll);
    resetHwTest = () => reset(true); // 關窗安全：停掉馬達/燈
    // Nano 自檢期間收不了指令 → 鎖住整個測試區，避免使用者亂按以為壞了
    arduino.setTestEnabled = (v) => { box.style.pointerEvents = v ? '' : 'none'; box.style.opacity = v ? '' : '0.45'; };
  }

  // ============ 分頁 2：遊戲設定 ============
  const body = document.createElement('div');
  gamePane.append(body);

  const open = () => { backdrop.style.display = 'flex'; showPane(0); };
  const close = () => { backdrop.style.display = 'none'; if (resetHwTest) resetHwTest(); };
  gear.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  function changed() { saveSettings(settings); media.applySettings(); }

  function row(labelText, input) {
    const r = document.createElement('label');
    r.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0;';
    const s = document.createElement('span');
    s.textContent = labelText;
    r.append(s, input);
    return r;
  }

  function slider(min, max, value, onInput) {
    const boxEl = document.createElement('span');
    boxEl.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const range = document.createElement('input');
    range.type = 'range'; range.min = min; range.max = max; range.value = value;
    range.style.width = '140px';
    const num = document.createElement('span');
    num.textContent = value; num.style.minWidth = '32px'; num.style.textAlign = 'right';
    range.addEventListener('input', () => { num.textContent = range.value; onInput(Number(range.value)); });
    boxEl.append(range, num);
    return boxEl;
  }

  function barStylePicker() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:8px;';
    const styles = [[1, '科技藍'], [2, '街機紅黃'], [3, '霓虹管']];
    for (const [id, name] of styles) {
      const b = document.createElement('button');
      b.textContent = name;
      const on = (settings.barStyle || 1) === id;
      b.style.cssText = 'flex:1;padding:8px 6px;border-radius:8px;cursor:pointer;font-size:13px;' + (on ? onCss : offCss);
      b.addEventListener('click', () => { settings.barStyle = id; changed(); render(); });
      wrap.append(b);
    }
    return wrap;
  }

  function render() {
    body.replaceChildren();
    body.append(row('鏡頭透明度（越低越看得到MV）',
      slider(0, 100, settings.cameraOpacity, (v) => { settings.cameraOpacity = v; changed(); })));

    const bs = document.createElement('div');
    bs.style.cssText = 'margin:8px 0;';
    const bsl = document.createElement('div');
    bsl.textContent = '能量條風格'; bsl.style.cssText = 'margin-bottom:6px;';
    bs.append(bsl, barStylePicker());
    body.append(bs);

    const hr = document.createElement('hr');
    hr.style.cssText = 'border-color:#fff2;margin:10px 0;';
    body.append(hr);

    for (const t of media.tracks) {
      const cfg = settings.perTrack[t.id] || (settings.perTrack[t.id] = defaultTrackSetting());
      const block = document.createElement('div');
      block.style.cssText = 'margin:10px 0;padding:8px;background:#ffffff10;border-radius:8px;';
      const name = document.createElement('div');
      name.textContent = t.name;
      name.style.cssText = 'font-weight:bold;margin-bottom:4px;';
      block.append(name);
      block.append(row('音量', slider(0, 100, cfg.volume, (v) => { cfg.volume = v; changed(); })));
      block.append(row('MV 透明度', slider(0, 100, cfg.mvOpacity, (v) => { cfg.mvOpacity = v; changed(); })));
      body.append(block);
    }
  }
  render();

  hud.append(gear, backdrop);
  return { gear, panel: backdrop };
}
