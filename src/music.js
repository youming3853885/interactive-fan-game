import { loopSeekTime, defaultTrackSetting } from './settings.js';

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
    videoEl.src = t.src;
    videoEl.volume = cfg.volume / 100;
    videoEl.style.opacity = String(cfg.mvOpacity / 100);
    const seekTo = cfg.start || 0; // 需等 metadata 才能 seek
    videoEl.addEventListener('loadedmetadata', () => { videoEl.currentTime = seekTo; }, { once: true });
    if (autoplay) videoEl.play().catch(() => {});
  }

  // 段尾跳回段首（每首歌可設 start/end 剪出片段循環）
  videoEl.addEventListener('timeupdate', () => {
    const cfg = trackSetting(tracks[idx]);
    const seek = loopSeekTime(videoEl.currentTime, cfg.start || 0, cfg.end || 0);
    if (seek !== null) videoEl.currentTime = seek;
  });

  applyCameraOpacity();
  loadTrack(0, false); // 預載第一首（不自動播，等遊戲開始）

  return {
    tracks,
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
