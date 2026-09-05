// 內建 4 首 MV。檔案放 public/（ASCII 檔名），顯示名/封面用中文素材。
const base = import.meta.env.BASE_URL; // GitHub Pages 為 /interactive-fan-game/

export const BUILTIN_TRACKS = [
  { id: 'canon-rock', name: 'Canon Rock', sub: '搖滾電吉他', bpm: 90,
    src: `${base}mv/canon-rock.mp4`, cover: `${base}covers/canon-rock.png` },
  { id: 'super-run', name: '超跑情人夢', sub: '卜學亮', bpm: 120, start: 5,
    src: `${base}mv/super-run.mp4`, cover: `${base}covers/super-run.jpg` },
  { id: 'initial-d', name: '頭文字D', sub: 'INITIAL D · Eurobeat', bpm: 150,
    src: `${base}mv/initial-d.mp4`, cover: `${base}covers/initial-d.jpg` },
  { id: 'bumblebee', name: '大黃蜂的飛行', sub: '古典 · 快板', bpm: 165,
    src: `${base}mv/flight-of-bumblebee.mp4`, cover: `${base}covers/flight-of-bumblebee.jpg` },
];

// 難度隨 BPM 成正比（越快越難），回傳 1~5 星數；bpm 缺值回 0。
export function bpmToStars(bpm) {
  if (!bpm) return 0;
  if (bpm <= 95) return 2;
  if (bpm <= 125) return 3;
  if (bpm <= 152) return 4;
  return 5;
}

export function starString(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}
