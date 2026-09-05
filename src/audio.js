// 共用 AudioContext + 把 <audio>/<video> 接上 AnalyserNode 取即時頻譜。
let ac;
export function getAudioContext() {
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

const attached = new WeakMap();

// 對同一個媒體元素只能建一次 source；建後必須接到 destination 否則會靜音。
export function attachAnalyser(mediaEl) {
  if (attached.has(mediaEl)) return attached.get(mediaEl);
  const a = getAudioContext();
  const src = a.createMediaElementSource(mediaEl);
  const analyser = a.createAnalyser();
  analyser.fftSize = 128;              // → 64 個頻段
  analyser.smoothingTimeConstant = 0.8; // 平滑，柱子不會抖太兇
  src.connect(analyser);
  analyser.connect(a.destination);
  attached.set(mediaEl, analyser);
  return analyser;
}
