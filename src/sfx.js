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
};
