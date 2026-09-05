// 設定：全域鏡頭透明度 + 每首歌（開始/停止時間、音量、MV透明度）。存 localStorage。

const KEY = 'ifg-settings-v1';

// 每首歌預設：volume 70、mvOpacity 100。（遊玩時間改由選歌時的 2分鐘/全曲決定，不再有起訖秒數）
export function defaultTrackSetting() {
  return { volume: 70, mvOpacity: 100 };
}

export function defaultSettings(trackIds) {
  const perTrack = {};
  for (const id of trackIds) perTrack[id] = defaultTrackSetting();
  return { cameraOpacity: 60, barStyle: 1, perTrack };
}

export function loadSettings(trackIds) {
  const def = defaultSettings(trackIds);
  let saved;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { saved = null; }
  if (!saved) return def;
  // 淺層合併，確保新歌/新欄位有預設值
  const merged = { cameraOpacity: saved.cameraOpacity ?? def.cameraOpacity, barStyle: saved.barStyle ?? def.barStyle, perTrack: {} };
  for (const id of trackIds) {
    merged.perTrack[id] = { ...defaultTrackSetting(), ...(saved.perTrack?.[id] || {}) };
  }
  return merged;
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 隱私模式忽略 */ }
}
