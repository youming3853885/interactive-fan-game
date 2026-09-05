import { loopSeekTime, defaultTrackSetting } from './settings.js';

// 控制背景 MV <video>：內建曲目 + 上傳，套用每首歌的 開始/停止/音量/透明度，
// 底部旋轉唱盤點一下播放/暫停，播放中再點換下一首。
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
    label.textContent = `♪ ${t.name}`;
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

  // ---- 唱盤 UI ----
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'position:absolute;left:16px;bottom:16px;display:flex;align-items:center;gap:10px;color:#fff;';

  const disc = document.createElement('div');
  disc.textContent = '💿';
  disc.title = '點一下播放/暫停・播放中再點換下一首';
  disc.style.cssText = 'font-size:48px;cursor:pointer;user-select:none;';
  let spin = 0;
  function tick() {
    if (!videoEl.paused && !videoEl.ended) {
      spin = (spin + 4) % 360;
      disc.style.transform = `rotate(${spin}deg)`;
    }
    requestAnimationFrame(tick);
  }
  tick();

  const label = document.createElement('span');

  disc.addEventListener('click', () => {
    if (!tracks.length) return;
    if (videoEl.paused) {
      if (!videoEl.src) loadTrack(0, true);
      else videoEl.play().catch(() => {});
    } else {
      loadTrack((idx + 1) % tracks.length, true); // 換下一首
    }
  });
  disc.addEventListener('dblclick', () => videoEl.pause());

  const upload = document.createElement('input');
  upload.type = 'file';
  upload.accept = 'video/*,audio/*';
  upload.multiple = true;
  upload.style.color = '#fff';
  upload.addEventListener('change', () => {
    for (const f of upload.files) {
      const id = `upload-${f.name}`;
      tracks.push({ id, name: f.name, src: URL.createObjectURL(f) });
      if (!settings.perTrack[id]) settings.perTrack[id] = defaultTrackSetting();
    }
  });

  wrap.append(disc, label, upload);
  hud.appendChild(wrap);

  applyCameraOpacity();
  loadTrack(0, false); // 預載第一首（不自動播，等使用者點）

  // 供設定畫面即時套用變更
  return {
    tracks,
    root: wrap,
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
