// 選歌試聽的體積光：canvas(mix-blend screen)。光束+浮塵粒子(被光照到變亮)+光落點。
export function createLights(hud) {
  const lc = document.createElement('canvas');
  lc.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none;mix-blend-mode:screen;';
  hud.appendChild(lc);
  const lx = lc.getContext('2d');
  const resize = () => { lc.width = innerWidth * devicePixelRatio; lc.height = innerHeight * devicePixelRatio; };
  resize(); addEventListener('resize', resize);

  const BEAMS = [
    { x: 0.12, c: [110, 175, 255] }, { x: 0.31, c: [170, 110, 255] }, { x: 0.5, c: [255, 120, 210] },
    { x: 0.69, c: [110, 175, 255] }, { x: 0.88, c: [170, 110, 255] },
  ];
  const DUST = Array.from({ length: 150 }, (_, k) => ({ x: (k * 0.137) % 1, y: (k * 0.311) % 1, z: 0.4 + (k % 6) / 10, ph: k }));
  let t = 0, inten = 0, playing = false;
  const ang = (i) => Math.sin(t * 0.6 + i * 1.3) * 0.28;

  function frame() {
    t += 0.016; inten += ((playing ? 1 : 0) - inten) * 0.05;
    const W = lc.width, H = lc.height;
    lx.clearRect(0, 0, W, H);
    if (inten > 0.01) {
      lx.globalCompositeOperation = 'lighter';
      BEAMS.forEach((b, i) => {
        const ax = b.x * W, a = ang(i), topW = 0.02 * W, botW = 0.14 * W, len = 1.25 * H;
        lx.save(); lx.translate(ax, -0.05 * H); lx.rotate(a);
        const g = lx.createLinearGradient(0, 0, 0, len);
        g.addColorStop(0, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},${0.45 * inten})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lx.fillStyle = g; lx.filter = 'blur(14px)';
        lx.beginPath(); lx.moveTo(-topW, 0); lx.lineTo(topW, 0); lx.lineTo(botW, len); lx.lineTo(-botW, len); lx.closePath(); lx.fill();
        lx.restore();
        const bx = ax + Math.sin(a) * len;
        const pg = lx.createRadialGradient(bx, H * 0.85, 0, bx, H * 0.85, 0.22 * H);
        pg.addColorStop(0, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},${0.3 * inten})`);
        pg.addColorStop(1, 'rgba(0,0,0,0)');
        lx.filter = 'none'; lx.fillStyle = pg; lx.fillRect(0, 0, W, H);
      });
      DUST.forEach((d) => {
        d.y += 0.0006 / d.z; d.x += Math.sin(t * 0.5 + d.ph) * 0.0002; if (d.y > 1) d.y = 0;
        const px = d.x * W, py = d.y * H;
        let bright = 0.04;
        BEAMS.forEach((b, i) => { const axisX = b.x * W + Math.tan(ang(i)) * py; bright += Math.max(0, 1 - Math.abs(px - axisX) / (0.09 * W)) * 0.9; });
        lx.fillStyle = `rgba(200,225,255,${Math.min(1, bright) * inten})`;
        lx.beginPath(); lx.arc(px, py, (1.5 + d.z * 1.5) * devicePixelRatio, 0, 7); lx.fill();
      });
    }
    requestAnimationFrame(frame);
  }
  frame();
  return { setPlaying(v) { playing = v; } };
}
