// 內建 4 首 MV。檔案放 public/（ASCII 檔名），顯示名/封面用中文素材。
const base = import.meta.env.BASE_URL; // GitHub Pages 為 /interactive-fan-game/

export const BUILTIN_TRACKS = [
  { id: 'canon-rock', name: 'Canon Rock', sub: '搖滾電吉他', bpm: 90,
    src: `${base}mv/canon-rock.mp4`, cover: `${base}covers/canon-rock.jpg` },
  { id: 'super-run', name: '超跑情人夢', sub: '卜學亮', bpm: 120, start: 5,
    src: `${base}mv/super-run.mp4`, cover: `${base}covers/super-run.jpg` },
  { id: 'initial-d', name: '頭文字D', sub: 'INITIAL D · Eurobeat', bpm: 150,
    src: `${base}mv/initial-d.mp4`, cover: `${base}covers/initial-d.jpg` },
  { id: 'bumblebee', name: '大黃蜂的飛行', sub: '古典 · 快板', bpm: 165,
    src: `${base}mv/flight-of-bumblebee.mp4`, cover: `${base}covers/flight-of-bumblebee.jpg` },
  { id: 'dragon-boat', name: '彩龍船', sub: '龍門國小國樂團', bpm: 140,
    src: `${base}mv/dragon-boat.mp4`, cover: `${base}covers/dragon-boat.jpg` },
  { id: 'golden-snake', name: '金蛇狂舞', sub: '龍門國小國樂團', bpm: 168,
    src: `${base}mv/golden-snake.mp4`, cover: `${base}covers/golden-snake.jpg` },
];

// 每首推導副歌短片路徑（public/mv/{id}-chorus.mp4）
for (const t of BUILTIN_TRACKS) t.chorusSrc = `${base}mv/${t.id}-chorus.mp4`;

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

// 選歌時長模式 → 播放來源與本局長度。
// roundSec 為 null 表示「開播後由 MV loadedmetadata 的 duration 決定」（沿用現行邏輯）。
export function pickPlayback(track, lenMode) {
  if (lenMode === 'chorus') return { src: track.chorusSrc, roundSec: 60 };
  return { src: track.src, roundSec: null };
}
