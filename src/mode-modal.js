// 開始遊戲後的模式選擇彈窗：霓虹卡片，單人 / 雙人。onPick('single'|'dual')。
export function createModeModal(hud, onPick) {
  const style = document.createElement('style');
  style.textContent = `
  .mm-back{position:absolute;inset:0;display:none;align-items:center;justify-content:center;gap:40px;
    background:#05060dcc;backdrop-filter:blur(4px);z-index:40;pointer-events:auto;}
  .mm-card{position:relative;width:min(38vw,320px);aspect-ratio:3/4;border-radius:20px;cursor:pointer;color:#fff;
    display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:8px;padding-bottom:26px;
    background:#0e1430 center/cover no-repeat;border:2px solid #ffffff2a;transition:.18s;font-family:system-ui,sans-serif;overflow:hidden;}
  .mm-card::before{content:"";position:absolute;inset:0;border-radius:18px;
    background:linear-gradient(to top,#05060def 0,#05060d55 40%,transparent 75%);}
  .mm-card:hover{transform:translateY(-6px) scale(1.04);}
  .mm-card .t,.mm-card .d{position:relative;z-index:1;text-shadow:0 2px 10px #000c;}
  .mm-card .t{font-size:30px;font-weight:900;letter-spacing:.05em;}
  .mm-card .d{font-size:14px;color:#dfe4ff;}
  .mm-card.single{border-color:#ffd76b;box-shadow:0 0 40px #ffd76b44;}
  .mm-card.single:hover{box-shadow:0 0 60px #ffd76b88;}
  .mm-card.dual{border-color:#2b7bff;box-shadow:0 0 40px #2b7bff44;}
  .mm-card.dual:hover{box-shadow:0 0 60px #2b7bff88;}
  .mm-title{position:absolute;top:14%;left:0;right:0;text-align:center;color:#fff;font-size:26px;font-weight:800;letter-spacing:.1em;}
  .mm-x{position:absolute;top:18px;right:22px;background:transparent;border:none;color:#fff;font-size:26px;cursor:pointer;}`;
  document.head.appendChild(style);

  const back = document.createElement('div');
  back.className = 'mm-back';
  back.innerHTML = `
    <div class="mm-title">選擇模式</div>
    <button class="mm-x">✕</button>
    <div class="mm-card single" data-mode="single"><div class="t">單人</div><div class="d">一人雙手 · 挑戰評級</div></div>
    <div class="mm-card dual" data-mode="dual"><div class="t">雙人</div><div class="d">左右對戰 · 比分數</div></div>`;
  hud.appendChild(back);
  const base = import.meta.env.BASE_URL;
  back.querySelector('.mm-card.single').style.backgroundImage = `url(${base}modes/single.jpg)`;
  back.querySelector('.mm-card.dual').style.backgroundImage = `url(${base}modes/dual.jpg)`;

  const close = () => { back.style.display = 'none'; };
  back.querySelector('.mm-x').addEventListener('click', close);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  back.querySelectorAll('.mm-card').forEach((c) =>
    c.addEventListener('click', () => { close(); onPick(c.dataset.mode); }));

  return { show() { back.style.display = 'flex'; }, hide: close };
}
