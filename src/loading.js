// 遊戲感 LOADING 頁：旋轉黑膠 + 霓虹進度條 + 百分比。載好才 hide。
export function createLoadingScreen(hud) {
  injectStyle();
  const el = document.createElement('div');
  el.className = 'ld-screen';
  el.innerHTML = `
    <div class="ld-glow"></div>
    <div class="ld-disc"><div class="ld-hole"></div></div>
    <div class="ld-title" style="font-size:26px;letter-spacing:.06em">澎湖縣龍門國小</div>
    <div class="ld-title">畫 圈 對 決</div>
    <div class="ld-status" id="ldStatus">載入音樂中…</div>
    <div class="ld-barwrap"><div class="ld-bar" id="ldBar"></div></div>
    <div class="ld-pct" id="ldPct">0%</div>
    <div class="ld-tip">提示：畫圈方向要跟畫面指令一致，能量才會累積</div>`;
  hud.appendChild(el);

  const bar = el.querySelector('#ldBar');
  const pct = el.querySelector('#ldPct');
  const status = el.querySelector('#ldStatus');

  return {
    progress(p) {
      const v = Math.max(0, Math.min(1, p));
      bar.style.width = (v * 100) + '%';
      pct.textContent = Math.round(v * 100) + '%';
    },
    status(text) { status.textContent = text; },
    hide() { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); },
  };
}

function injectStyle() {
  if (document.getElementById('ld-style')) return;
  const s = document.createElement('style');
  s.id = 'ld-style';
  s.textContent = `
  .ld-screen{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:22px;background:radial-gradient(900px 500px at 50% 40%,#1c2036 0,#0b0b12 70%);color:#fff;pointer-events:auto;
    font-family:system-ui,"Segoe UI",sans-serif;transition:opacity .5s;}
  .ld-glow{position:absolute;width:420px;height:420px;border-radius:50%;
    background:radial-gradient(circle,#4ec3ff33,transparent 60%);filter:blur(20px);animation:ldpulse 2s ease-in-out infinite;}
  @keyframes ldpulse{0%,100%{transform:scale(.9);opacity:.6}50%{transform:scale(1.1);opacity:1}}
  .ld-disc{position:relative;width:180px;height:180px;border-radius:50%;
    background:repeating-radial-gradient(circle at 50% 50%,#0d0d0f 0 3px,#17171b 3px 6px);
    box-shadow:0 0 0 5px #05050799,0 0 50px #ff6b9d55,0 0 90px #4ec3ff44;animation:ldspin 1.4s linear infinite;}
  .ld-disc::after{content:"";position:absolute;inset:0;border-radius:50%;
    background:linear-gradient(135deg,#ffffff22 0,transparent 40% 60%,#ffffff14 100%);}
  .ld-hole{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;
    background:#0b0b12;box-shadow:inset 0 0 0 2px #ffffff66;}
  @keyframes ldspin{to{transform:rotate(360deg)}}
  .ld-title{font-size:38px;font-weight:900;letter-spacing:.15em;
    background:linear-gradient(90deg,#4ec3ff,#ff6b9d);-webkit-background-clip:text;background-clip:text;color:transparent;
    text-shadow:0 0 30px #4ec3ff44;}
  .ld-status{color:#aeb4d8;font-size:15px;letter-spacing:.05em;}
  .ld-barwrap{width:min(60vw,460px);height:14px;border-radius:999px;background:#ffffff14;overflow:hidden;box-shadow:inset 0 0 0 1px #ffffff22;}
  .ld-bar{width:0%;height:100%;border-radius:999px;background:linear-gradient(90deg,#4ec3ff,#ffd76b,#ff6b9d);
    box-shadow:0 0 16px #ff6b9d88;transition:width .2s ease;}
  .ld-pct{font-size:22px;font-weight:800;color:#ffd76b;text-shadow:0 0 14px #ffd76b66;}
  .ld-tip{position:absolute;bottom:32px;color:#8890b8;font-size:13px;}`;
  document.head.appendChild(s);
}
