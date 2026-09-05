import { sfx } from './sfx.js';
import { attachAnalyser } from './audio.js';
import { bpmToStars, starString } from './tracks.js';

// 音樂遊戲風選歌畫面：中央旋轉黑膠 + 唱針、左右封面、切歌箭頭、BPM+難度、試聽、開始。
export function createSelectScreen(hud, onPick) {
  injectStyle();

  const screen = document.createElement('div');
  screen.className = 'ss-screen';
  screen.innerHTML = `
    <div class="ss-eq" id="ssEq"></div>
    <div class="ss-top"><div class="ss-kicker">選 擇 歌 曲</div><div class="ss-idx" id="ssIdx"></div></div>
    <div class="ss-stage">
      <button class="ss-chev" data-d="-1">‹</button>
      <div class="ss-side" id="ssPrev"></div>
      <div class="ss-disc-wrap" id="ssWrap">
        <div class="ss-disc" id="ssDisc"><div class="ss-label" id="ssLabel"></div><div class="ss-hole"></div></div>
        <div class="ss-tonearm"><div class="ss-arm"><div class="ss-head"></div></div><div class="ss-pivot"></div></div>
      </div>
      <div class="ss-side" id="ssNext"></div>
      <button class="ss-chev" data-d="1">›</button>
    </div>
    <div class="ss-meta">
      <div class="ss-title" id="ssTitle"></div>
      <div class="ss-sub" id="ssSub"></div>
      <div class="ss-info"><span id="ssBpm"></span><span class="ss-stars" id="ssStars"></span></div>
    </div>
    <div class="ss-controls">
      <button class="ss-btn ss-preview" id="ssPreview">▶ 試聽</button>
      <button class="ss-btn ss-start" id="ssStart">開始遊戲</button>
    </div>
    <div class="ss-dots" id="ssDots"></div>`;
  screen.style.display = 'none';
  hud.appendChild(screen);

  const preview = document.createElement('audio');
  hud.appendChild(preview);

  const $ = (id) => screen.querySelector('#' + id);

  // ---- 底部波形：音樂遊戲風。中央低頻、向兩側擴散對稱，含峰值頂蓋(peak-hold) ----
  const EQ_BARS = 64;
  $('ssEq').innerHTML = Array.from({ length: EQ_BARS }).map(() => '<i><b></b><s></s></i>').join('');
  const eqBars = Array.from($('ssEq').querySelectorAll('i')).map((el) => ({
    fill: el.querySelector('b'), cap: el.querySelector('s'),
  }));
  const peaks = new Float32Array(EQ_BARS);
  const half = (EQ_BARS - 1) / 2;
  let analyser = null;
  let freq = null;
  function eqLoop() {
    if (analyser) {
      analyser.getByteFrequencyData(freq);
      const usable = Math.floor(freq.length * 0.7);
      for (let k = 0; k < EQ_BARS; k++) {
        const frac = Math.abs(k - half) / half;          // 中央=低頻(0)，兩側=高頻(1)
        const v = freq[Math.floor(frac * usable)] / 255; // 0~1
        peaks[k] = Math.max(v, peaks[k] - 0.02);          // 峰值頂蓋緩降
        eqBars[k].fill.style.height = (4 + v * 96) + '%';
        eqBars[k].cap.style.bottom = (4 + peaks[k] * 96) + '%';
      }
    }
    requestAnimationFrame(eqLoop);
  }
  eqLoop();

  let tracks = [];
  let i = 0;
  let playing = false;

  const bg = (t) => (t.cover ? `url("${t.cover}")` : 'linear-gradient(135deg,#4ec3ff,#ff6b9d)');

  function render() {
    if (!tracks.length) return;
    const t = tracks[i];
    $('ssLabel').style.backgroundImage = bg(t);
    $('ssPrev').style.backgroundImage = bg(tracks[(i - 1 + tracks.length) % tracks.length]);
    $('ssNext').style.backgroundImage = bg(tracks[(i + 1) % tracks.length]);
    $('ssTitle').textContent = t.name;
    $('ssSub').textContent = t.sub || '';
    $('ssIdx').textContent = `${i + 1} / ${tracks.length}`;
    $('ssBpm').textContent = t.bpm ? `♪ ${t.bpm} BPM` : '';
    const stars = bpmToStars(t.bpm);
    $('ssStars').textContent = stars ? `難度 ${starString(stars)}` : '';
    $('ssDots').innerHTML = tracks.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
    if (playing) startPreview();
  }

  function startPreview() {
    if (!analyser) {
      analyser = attachAnalyser(preview);
      freq = new Uint8Array(analyser.frequencyBinCount);
    }
    preview.src = tracks[i].src;
    const s = tracks[i].start || 0; // 例如超跑情人夢從第 5 秒起
    if (s) preview.addEventListener('loadedmetadata', () => { preview.currentTime = s; }, { once: true });
    preview.play().catch(() => {});
  }
  function stopPreview() {
    playing = false;
    preview.pause();
    $('ssDisc').classList.remove('playing');
    $('ssWrap').classList.remove('playing');
    $('ssPreview').textContent = '▶ 試聽';
  }

  function move(d) { i = (i + d + tracks.length) % tracks.length; sfx.move(d); render(); }

  screen.querySelectorAll('.ss-chev').forEach((b) => {
    b.addEventListener('mouseenter', () => sfx.hover());
    b.addEventListener('click', () => move(Number(b.dataset.d)));
  });
  $('ssPreview').addEventListener('click', () => {
    playing = !playing;
    sfx.toggle(playing);
    $('ssDisc').classList.toggle('playing', playing);
    $('ssWrap').classList.toggle('playing', playing);
    $('ssPreview').textContent = playing ? '⏸ 停止試聽' : '▶ 試聽';
    if (playing) startPreview(); else preview.pause();
  });
  $('ssStart').addEventListener('mouseenter', () => sfx.hover());
  $('ssStart').addEventListener('click', () => { sfx.confirm(); stopPreview(); onPick(i); });

  const onKey = (e) => {
    if (screen.style.display === 'none') return;
    if (e.key === 'ArrowLeft') move(-1);
    if (e.key === 'ArrowRight') move(1);
    if (e.key === 'Enter') { sfx.confirm(); stopPreview(); onPick(i); }
  };
  addEventListener('keydown', onKey);

  return {
    show(list) { tracks = list; i = 0; render(); screen.style.display = 'flex'; },
    hide() { stopPreview(); screen.style.display = 'none'; },
  };
}

function injectStyle() {
  if (document.getElementById('ss-style')) return;
  const s = document.createElement('style');
  s.id = 'ss-style';
  s.textContent = `
  .ss-screen{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:0;background:radial-gradient(1200px 600px at 50% -10%,#1c2036 0,transparent 60%),
    radial-gradient(900px 500px at 50% 120%,#241a2e 0,transparent 60%),#0b0b12;pointer-events:auto;color:#fff;
    font-family:system-ui,"Segoe UI",sans-serif;z-index:5;}
  .ss-eq{position:absolute;inset:auto 0 0 0;height:16vh;display:flex;gap:4px;align-items:flex-end;justify-content:center;opacity:.5;pointer-events:none;z-index:0;}
  .ss-top,.ss-stage,.ss-meta,.ss-controls,.ss-dots{position:relative;z-index:1;}
  .ss-eq i{position:relative;width:8px;height:100%;}
  .ss-eq i b{position:absolute;left:0;right:0;bottom:0;height:4%;border-radius:4px 4px 0 0;
    background:linear-gradient(to top,#4ec3ff,#ff6b9d);box-shadow:0 0 10px #4ec3ff77,0 0 4px #ff6b9d88;transition:height .05s linear;}
  .ss-eq i s{position:absolute;left:0;right:0;bottom:4%;height:3px;border-radius:2px;background:#fff;box-shadow:0 0 8px #fff,0 0 4px #ffd76b;transition:bottom .08s linear;}
  .ss-top{position:absolute;top:26px;text-align:center;}
  .ss-kicker{letter-spacing:.4em;font-size:13px;color:#aeb4d8;}
  .ss-idx{margin-top:6px;font-size:14px;color:#8890b8;}
  .ss-stage{display:flex;align-items:center;justify-content:center;gap:min(5vw,70px);}
  .ss-side{width:150px;height:150px;border-radius:50%;background-size:cover;background-position:center;
    filter:brightness(.82);transform:scale(.92);box-shadow:0 10px 40px #000a;flex:0 0 auto;border:3px solid #ffffff22;}
  .ss-disc-wrap{position:relative;width:min(46vh,420px);aspect-ratio:1;}
  .ss-disc{position:absolute;inset:0;border-radius:50%;
    background:repeating-radial-gradient(circle at 50% 50%,#0d0d0f 0 2px,#17171b 2px 4px);
    box-shadow:0 0 0 6px #05050799,0 24px 70px #000c,0 0 60px #4ec3ff33;display:flex;align-items:center;justify-content:center;
    animation:ssspin 4s linear infinite;animation-play-state:paused;}
  .ss-disc.playing{animation-play-state:running;}
  @keyframes ssspin{to{transform:rotate(360deg)}}
  .ss-disc::after{content:"";position:absolute;inset:0;border-radius:50%;
    background:linear-gradient(135deg,#ffffff22 0,transparent 30% 70%,#ffffff14 100%);}
  .ss-label{width:56%;height:56%;border-radius:50%;position:relative;z-index:2;background-size:cover;background-position:center;
    box-shadow:inset 0 0 0 4px #00000055,0 0 0 2px #ffffff22;}
  .ss-hole{position:absolute;z-index:3;width:16px;height:16px;border-radius:50%;background:#0b0b12;box-shadow:inset 0 0 0 2px #ffffff55;}
  .ss-tonearm{position:absolute;top:-6%;right:-8%;width:44%;height:60%;z-index:6;transform-origin:100% 0;
    transform:rotate(20deg);transition:transform .55s cubic-bezier(.4,1.4,.5,1);}
  .ss-disc-wrap.playing .ss-tonearm{transform:rotate(4deg);}
  .ss-pivot{position:absolute;top:0;right:0;width:34px;height:34px;border-radius:50%;
    background:radial-gradient(circle at 35% 30%,#eaeef6,#8b93a6 60%,#4b5162);box-shadow:0 4px 12px #000a,inset 0 0 0 2px #ffffff55;}
  .ss-arm{position:absolute;top:14px;right:15px;width:9px;height:82%;
    background:linear-gradient(90deg,#aeb6c8,#e9edf5 45%,#8b93a6);border-radius:6px;transform-origin:top center;
    transform:rotate(34deg);box-shadow:0 3px 10px #0008;}
  .ss-head{position:absolute;bottom:-10px;left:-5px;width:22px;height:16px;border-radius:4px;
    background:linear-gradient(#33384a,#1c2030);box-shadow:0 3px 8px #0009;}
  .ss-meta{text-align:center;margin-top:26px;}
  .ss-title{font-size:34px;font-weight:800;letter-spacing:.02em;}
  .ss-sub{margin-top:6px;color:#aeb4d8;font-size:15px;}
  .ss-info{margin-top:10px;display:flex;gap:18px;justify-content:center;font-size:16px;}
  .ss-info #ssBpm{color:#4ec3ff;font-weight:700;}
  .ss-stars{color:#ffd76b;letter-spacing:2px;}
  .ss-controls{margin-top:22px;display:flex;gap:14px;align-items:center;justify-content:center;}
  .ss-btn{border:none;cursor:pointer;border-radius:999px;font-weight:700;font-size:16px;padding:12px 22px;}
  .ss-preview{background:#ffffff14;color:#fff;border:1px solid #ffffff2e;}
  .ss-preview:hover{background:#ffffff22;}
  .ss-start{background:linear-gradient(135deg,#4ec3ff,#ff6b9d);color:#0b0b12;font-size:18px;padding:14px 40px;box-shadow:0 8px 30px #ff6b9d55;}
  .ss-start:hover{filter:brightness(1.08);transform:translateY(-1px);}
  .ss-chev{width:64px;height:64px;border-radius:50%;border:1px solid #ffffff33;background:#ffffff0d;color:#fff;
    font-size:30px;cursor:pointer;flex:0 0 auto;transition:.15s;backdrop-filter:blur(4px);}
  .ss-chev:hover{background:#4ec3ff;color:#0b0b12;transform:scale(1.08);box-shadow:0 0 24px #4ec3ff88;}
  .ss-dots{margin-top:22px;display:flex;gap:10px;}
  .ss-dots i{width:9px;height:9px;border-radius:50%;background:#ffffff33;}
  .ss-dots i.on{background:#ffd76b;box-shadow:0 0 12px #ffd76b;}`;
  document.head.appendChild(s);
}
