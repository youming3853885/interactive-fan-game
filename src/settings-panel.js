import { saveSettings, defaultTrackSetting } from './settings.js';

// 齒輪按鈕 + 設定彈窗(modal)：硬體連接(Arduino) + 全域鏡頭透明度 + 每首歌設定。
// 任何變更即時套用(media.applySettings)並存 localStorage。
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
    'width:min(92vw,420px);max-height:86vh;overflow:auto;background:#12131cf7;color:#fff;' +
    'border:1px solid #fff3;border-radius:14px;padding:20px;font-size:14px;box-shadow:0 20px 60px #000a;';
  backdrop.appendChild(modal);

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;';
  const title = document.createElement('div');
  title.textContent = '設定'; title.style.cssText = 'font-size:18px;font-weight:bold;';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:transparent;color:#fff;border:none;font-size:20px;cursor:pointer;';
  head.append(title, closeBtn);
  modal.append(head);

  // 硬體連接（Arduino）
  if (arduino) {
    const box = document.createElement('div');
    box.style.cssText = 'margin-bottom:14px;padding:12px;background:#ffffff10;border-radius:8px;display:flex;flex-direction:column;gap:8px;';
    const t = document.createElement('div'); t.textContent = '硬體連接（Arduino）'; t.style.cssText = 'font-weight:bold;';
    box.append(t, arduino.btn, arduino.status);
    modal.append(box);
  }

  const body = document.createElement('div');
  modal.append(body);

  const open = () => { backdrop.style.display = 'flex'; };
  const close = () => { backdrop.style.display = 'none'; };
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

  function numInput(value, onInput) {
    const n = document.createElement('input');
    n.type = 'number'; n.min = 0; n.step = 1; n.value = value; n.style.width = '70px';
    n.addEventListener('input', () => onInput(Number(n.value) || 0));
    return n;
  }

  function barStylePicker() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:8px;';
    const styles = [[1, '科技藍'], [2, '街機紅黃'], [3, '霓虹管']];
    for (const [id, name] of styles) {
      const b = document.createElement('button');
      b.textContent = name;
      const on = (settings.barStyle || 1) === id;
      b.style.cssText = 'flex:1;padding:8px 6px;border-radius:8px;cursor:pointer;font-size:13px;' +
        (on ? 'background:#2b7bff;color:#fff;border:1px solid #6ea8ff;' : 'background:#ffffff12;color:#cdd6ff;border:1px solid #fff3;');
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
      block.append(row('開始時間 (秒)', numInput(cfg.start, (v) => { cfg.start = v; changed(); })));
      block.append(row('停止時間 (秒，0=到結尾)', numInput(cfg.end, (v) => { cfg.end = v; changed(); })));
      block.append(row('音量', slider(0, 100, cfg.volume, (v) => { cfg.volume = v; changed(); })));
      block.append(row('MV 透明度', slider(0, 100, cfg.mvOpacity, (v) => { cfg.mvOpacity = v; changed(); })));
      body.append(block);
    }
  }
  render();

  hud.append(gear, backdrop);
  return { gear, panel: backdrop };
}
