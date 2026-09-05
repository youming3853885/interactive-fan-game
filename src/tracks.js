// 內建 4 首 MV。檔案放 public/mv/（ASCII 檔名避免網址編碼問題），顯示名用中文。
const base = import.meta.env.BASE_URL; // GitHub Pages 為 /interactive-fan-game/

export const BUILTIN_TRACKS = [
  { id: 'canon-rock', name: 'Canon Rock', src: `${base}mv/canon-rock.mp4` },
  { id: 'super-run', name: '卜學亮《超跑情人夢》', src: `${base}mv/super-run.mp4` },
  { id: 'bumblebee', name: '大黃蜂的飛行', src: `${base}mv/flight-of-bumblebee.mp4` },
  { id: 'initial-d', name: '頭文字D INITIAL D', src: `${base}mv/initial-d.mp4` },
];
