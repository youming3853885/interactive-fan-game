import { saveSettings, defaultTrackSetting } from './settings.js';

// 齒輪按鈕 + 設定面板：全域鏡頭透明度 + 每首歌 開始/停止/音量/MV透明度。
// 任何變更即時套用(media.applySettings)並存 localStorage。
export function createSettingsPanel(hud, settings, media) {
  const gear = document.createElement('button');
  gear.textContent = '⚙ 設定';
  gear.style.cssText =
    'position:absolute;top:8px;right:12px;background:#222b;color:#fff;border:1px solid #fff5;border-radius:8px;padding:6px 10px;cursor:pointer;';

  const panel = document.createElement('div');
  panel.style.cssText =
    'position:absolute;top:48px;right:12px;width:340px;max-height:80vh;overflow:auto;' +
    'background:#12131cf2;color:#fff;border:1px solid #fff3;border-radius:12px;padding:16px;' +
    'display:none;pointer-events:auto;font-size:14px;';

  gear.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  function changed() {
    saveSettings(settings);
    media.applySettings();
  }

  function row(labelText, input) {
    const r = document.createElement('label');
    r.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0;';
    const s = document.createElement('span');
    s.textContent = labelText;
    r.append(s, input);
    return r;
  }

  function slider(min, max, value, onInput) {
    const box = document.createElement('span');
    box.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const range = document.createElement('input');
    range.type = 'range'; range.min = min; range.max = max; range.value = value;
    range.style.width = '140px';
    const num = document.createElement('span');
    num.textContent = value; num.style.minWidth = '32px'; num.style.textAlign = 'right';
    range.addEventListener('input', () => { num.textContent = range.value; onInput(Number(range.value)); });
    box.append(range, num);
    return box;
  }

  function numInput(value, onInput) {
    const n = document.createElement('input');
    n.type = 'number'; n.min = 0; n.step = 1; n.value = value; n.style.width = '70px';
    n.addEventListener('input', () => onInput(Number(n.value) || 0));
    return n;
  }

  function render() {
    panel.replaceChildren();
    const title = document.createElement('div');
    title.textContent = '設定';
    title.style.cssText = 'font-size:16px;font-weight:bold;margin-bottom:8px;';
    panel.append(title);

    // 全域：鏡頭透明度（越低越看得到背景 MV）
    panel.append(row('鏡頭透明度（越低越看得到MV）',
      slider(0, 100, settings.cameraOpacity, (v) => { settings.cameraOpacity = v; changed(); })));

    const hr = document.createElement('hr');
    hr.style.cssText = 'border-color:#fff2;margin:10px 0;';
    panel.append(hr);

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
      panel.append(block);
    }
  }
  render();

  hud.append(gear, panel);
  return { gear, panel };
}
