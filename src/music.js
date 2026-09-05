// 底部一角的旋轉唱盤：點一下播放/暫停+換曲，右邊可上傳 MP3。
// 佔位曲目先留空清單，使用者上傳後加入。純氣氛，與遊戲邏輯無耦合。
export function createMusicWidget(hud) {
  const tracks = []; // { name, url }
  let idx = 0;
  const audio = new Audio();
  audio.loop = true;

  const wrap = document.createElement('div');
  wrap.style.cssText =
    'position:absolute;left:16px;bottom:16px;display:flex;align-items:center;gap:10px;color:#fff;';

  const disc = document.createElement('div');
  disc.textContent = '💿';
  disc.title = '點一下播放/暫停・切換曲目';
  disc.style.cssText =
    'font-size:48px;cursor:pointer;transition:transform .1s linear;user-select:none;';
  let spin = 0;
  function tick() {
    if (!audio.paused) { spin = (spin + 6) % 360; disc.style.transform = `rotate(${spin}deg)`; }
    requestAnimationFrame(tick);
  }
  tick();

  const label = document.createElement('span');
  label.textContent = '（無曲目，請上傳 MP3）';

  disc.addEventListener('click', () => {
    if (!tracks.length) return;
    if (audio.paused) { audio.play(); }
    else {
      // 暫停時再點 → 換下一首
      idx = (idx + 1) % tracks.length;
      loadTrack();
      audio.play();
    }
  });
  disc.addEventListener('dblclick', () => audio.pause());

  function loadTrack() {
    audio.src = tracks[idx].url;
    label.textContent = `♪ ${tracks[idx].name}`;
  }

  const upload = document.createElement('input');
  upload.type = 'file';
  upload.accept = 'audio/*';
  upload.multiple = true;
  upload.style.color = '#fff';
  upload.addEventListener('change', () => {
    for (const f of upload.files) tracks.push({ name: f.name, url: URL.createObjectURL(f) });
    if (tracks.length && !audio.src) { idx = 0; loadTrack(); }
  });

  wrap.append(disc, label, upload);
  hud.appendChild(wrap);
}
