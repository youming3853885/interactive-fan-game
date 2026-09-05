// 設定：全域鏡頭透明度 + 每首歌（開始/停止時間、音量、MV透明度）。存 localStorage。

const KEY = 'ifg-settings-v1';

// 每首歌預設：start 0、end 0(=播到自然結尾)、volume 70、mvOpacity 100。
export function defaultTrackSetting() {
  return { start: 0, end: 0, volume: 70, mvOpacity: 100 };
}

export function defaultSettings(trackIds) {
  const perTrack = {};
  for (const id of trackIds) perTrack[id] = defaultTrackSetting();
  return { cameraOpacity: 60, barStyle: 1, perTrack };
}

// 純函數：影片播放時間到了段尾要不要跳回起點。回傳要 seek 的時間，或 null（不動）。
// end<=0 代表沒設段尾（播到自然結尾由 loop 屬性接手）。
export function loopSeekTime(current, start, end) {
  if (end > 0 && current >= end) return start;
  return null;
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
