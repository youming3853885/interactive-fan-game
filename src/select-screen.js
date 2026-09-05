// 開場「選音樂」畫面。show(tracks) 依當前曲目（含上傳）重建按鈕，點選 → onPick(index)。
export function createSelectScreen(hud, onPick) {
  const screen = document.createElement('div');
  screen.style.cssText =
    'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;' +
    'gap:24px;background:#0b0b12d9;pointer-events:auto;';

  const title = document.createElement('div');
  title.textContent = '🎵 選擇音樂';
  title.style.cssText = 'color:#fff;font-size:40px;font-weight:bold;';

  const hint = document.createElement('div');
  hint.textContent = '選一首歌開始（沒有 Arduino 也能玩）';
  hint.style.cssText = 'color:#cfd3ff;font-size:16px;';

  const grid = document.createElement('div');
  grid.style.cssText =
    'display:grid;grid-template-columns:repeat(2,minmax(220px,1fr));gap:16px;max-width:640px;';

  screen.append(title, hint, grid);
  hud.appendChild(screen);

  return {
    show(tracks) {
      grid.replaceChildren();
      tracks.forEach((t, i) => {
        const b = document.createElement('button');
        b.textContent = t.name;
        b.style.cssText =
          'padding:18px 20px;font-size:18px;border-radius:12px;border:1px solid #ffffff33;' +
          'background:#1b1e2e;color:#fff;cursor:pointer;';
        b.addEventListener('mouseenter', () => (b.style.background = '#2a2f4a'));
        b.addEventListener('mouseleave', () => (b.style.background = '#1b1e2e'));
        b.addEventListener('click', () => onPick(i));
        grid.appendChild(b);
      });
      screen.style.display = 'flex';
    },
    hide() { screen.style.display = 'none'; },
  };
}
