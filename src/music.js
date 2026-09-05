import { defaultTrackSetting } from './settings.js';

// 背景 MV <video> 的無介面播放控制器：載入/播放內建曲目、套用每首歌的
// 開始/停止/音量/透明度、鏡頭透明度。實際起播由遊戲流程呼叫 playTrack。
export function createMusicWidget(hud, videoEl, cameraEl, settings, builtinTracks) {
  const tracks = [...builtinTracks]; // { id, name, src }
  let idx = 0;

  function trackSetting(t) {
    return settings.perTrack[t.id] || (settings.perTrack[t.id] = defaultTrackSetting());
  }

  function applyCameraOpacity() {
    cameraEl.style.opacity = String(settings.cameraOpacity / 100);
  }

  function loadTrack(i, autoplay) {
    idx = i;
    const t = tracks[idx];
    const cfg = trackSetting(t);
    videoEl.src = t.src; // 從頭播；遊玩時間由選歌時的 2分鐘/全曲決定
    videoEl.volume = cfg.volume / 100;
    videoEl.style.opacity = String(cfg.mvOpacity / 100);
    if (autoplay) videoEl.play().catch(() => {});
  }

  applyCameraOpacity();
  loadTrack(0, false); // 預載第一首（不自動播，等遊戲開始）

  return {
    tracks,
    prep(i) { loadTrack(i, false); }, // 只載入緩衝、不自動播（給 ready 期間預熱）
    playTrack(i) { loadTrack(i, true); },
    applySettings() {
      applyCameraOpacity();
      const t = tracks[idx];
      const cfg = trackSetting(t);
      videoEl.volume = cfg.volume / 100;
      videoEl.style.opacity = String(cfg.mvOpacity / 100);
    },
  };
}
