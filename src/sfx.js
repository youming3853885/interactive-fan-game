// 勁舞團式介面音效：WebAudio 即時合成，免素材檔。
import { getAudioContext } from './audio.js';

function blip(freq, dur, type = 'square', vol = 0.14) {
  try {
    const a = getAudioContext();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(a.destination);
    const t = a.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur);
  } catch { /* 尚未有使用者手勢時忽略 */ }
}

export const sfx = {
  move(d) { blip(d > 0 ? 820 : 640, 0.07, 'square', 0.13); setTimeout(() => blip(d > 0 ? 1240 : 980, 0.06, 'square', 0.08), 38); },
  hover() { blip(1250, 0.028, 'sine', 0.05); },
  toggle(on) { blip(on ? 760 : 360, 0.09, 'sawtooth', 0.11); },
  confirm() { [523, 659, 784, 1047].forEach((f, k) => setTimeout(() => blip(f, 0.12, 'triangle', 0.14), k * 65)); },
  comboBurst(tier) {
    const base = 440 * Math.pow(1.12, tier);
    [0, 80, 160].forEach((d, k) => setTimeout(() => blip(base * (1 + k * 0.25), 0.12, 'square', 0.16), d));
  },
  // 合拍打點：畫對且合拍每拍一聲；strong=combo 高時更亮更脆
  hit(strong) {
    blip(strong ? 1568 : 1175, 0.05, 'square', 0.12);
    blip(strong ? 2349 : 1760, 0.04, 'sine', 0.06);
  },
  scoreTick() { blip(1046, 0.03, 'triangle', 0.06); },   // 得分連擊輕脆聲
  countTick(last) { blip(last ? 1320 : 880, 0.07, 'square', last ? 0.16 : 0.11); }, // 倒數滴答，最後一聲更高
  fanfare(win) {
    const seq = win ? [523, 659, 784, 1047, 1319] : [523, 494, 440];
    seq.forEach((f, k) => setTimeout(() => blip(f, 0.2, 'triangle', 0.16), k * 120));
  },
  // 語音判定：優先播 public/voice/{word}.wav（可換成自己錄的真人聲），沒有才退回 TTS。
  voice(text) {
    const key = String(text).toLowerCase();
    const clip = voiceClips[key];
    if (clip && clip.readyState >= 2) {
      try {
        const n = clip.cloneNode(); n.volume = 0.95;
        n.playbackRate = 1.0 + (Math.random() * 0.12 - 0.04); // 微變速，較活
        n.play().catch(() => ttsSpeak(text));
        return;
      } catch { /* 落到 TTS */ }
    }
    ttsSpeak(text);
  },
};

// 預載語音檔（放 public/voice/；優先 .mp3（自己錄/AI 生的真人聲），沒有退 .wav，再沒有退 TTS）。
const voiceClips = {};
try {
  const base = import.meta.env.BASE_URL;
  for (const w of ['good', 'great', 'perfect', 'combo']) {
    const a = new Audio();
    a.preload = 'auto'; a.volume = 0.95;
    a.src = base + `voice/${w}.mp3`;
    a.addEventListener('error', function onErr() { a.removeEventListener('error', onErr); a.src = base + `voice/${w}.wav`; }, { once: true });
    voiceClips[w] = a;
  }
} catch { /* 忽略 */ }

function ttsSpeak(text) {
  try {
    const s = window.speechSynthesis; if (!s) return;
    const u = new SpeechSynthesisUtterance(text + '!');
    const v = pickNaturalVoice(s);
    if (v) u.voice = v;
    u.lang = 'en-US';
    u.rate = 1.02 + (Math.random() * 0.1 - 0.03);
    u.pitch = 1.25 + (Math.random() * 0.3 - 0.12);
    u.volume = 1;
    s.cancel(); s.speak(u);
  } catch { /* 忽略 */ }
}

let _naturalVoice;
function pickNaturalVoice(s) {
  if (_naturalVoice !== undefined) return _naturalVoice;
  const vs = s.getVoices() || [];
  if (!vs.length) return null; // 尚未載入，下次再挑
  // 優先挑「神經/自然」嗓音，其次一般英語
  const prefs = [/natural/i, /neural/i, /google us english/i, /samantha/i, /aria|jenny|guy/i, /google/i, /en[-_]us/i, /en[-_]/i];
  for (const re of prefs) {
    const v = vs.find((x) => re.test(x.name) || re.test(x.lang));
    if (v) { _naturalVoice = v; return v; }
  }
  _naturalVoice = vs[0]; return _naturalVoice;
}
try { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => { _naturalVoice = undefined; }; } catch { /* 忽略 */ }
