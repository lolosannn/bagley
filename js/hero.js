// Hero: mientras bajás caen galletitas y se apilan hasta tapar la pantalla; si subís, se van sacando.
// Acá no se tocan: empujarlas con el mouse queda para la piñata del final.
import { sound } from './sound.js';

const KINDS = ['rumba', 'merengadas', 'mellizas'];

export function initHero(section, canvas, base = 'assets/fotos/') {
  const ctx = canvas.getContext('2d');
  const imgs = {};
  const ready = Promise.all(KINDS.map(k => new Promise(res => {
    const i = new Image(); i.src = base + k + '-entera.webp';
    i.onload = () => { imgs[k] = i; res(); }; i.onerror = res;
  })));

  let W = 0, H = 0, dpr = 1, R = 50, maxN = 100;
  const bodies = [];
  let seq = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio, 2); W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    R = Math.max(30, Math.min(60, W / 24));
    // suficientes para cubrir toda la pantalla (los sprites son más grandes que su círculo de choque)
    maxN = Math.ceil(W * H / (R * R * 2.35)) + 8;
  }
  new ResizeObserver(resize).observe(canvas); resize();

  function spawn() {
    const k = KINDS[seq++ % 3];
    bodies.push({ k, r: R * (.85 + Math.random() * .3), x: R + Math.random() * (W - 2 * R), y: -R - Math.random() * 160, vx: (Math.random() - .5) * 120, vy: 200 + Math.random() * 200, a: Math.random() * 6.28, va: (Math.random() - .5) * 6 });
  }

  let progress = 0, last = performance.now(), lastRattle = 0;
  function step(now) {
    requestAnimationFrame(step);
    const sr = section.getBoundingClientRect();
    if (sr.bottom < 0 || sr.top > innerHeight) { last = now; return; }
    progress = Math.min(1, Math.max(0, -sr.top / (sr.height - innerHeight)));
    const dt = Math.min((now - last) / 1000, 1 / 30); last = now;

    // cuántas tiene que haber según el scroll: unas pocas de entrada, todas al 85%
    const target = Math.round(10 + (maxN - 10) * Math.min(1, progress / .85));
    let spawned = 0;
    while (bodies.length < target && spawned < 5) { spawn(); spawned++; }
    if (spawned && now - lastRattle > 220) { lastRattle = now; sound.rattle(); }
    while (bodies.length > target + 3) bodies.pop();

    // física
    const floor = H;
    for (const b of bodies) {
      b.vy += 2000 * dt; b.vx *= .995;
      b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.va * dt;
      if (b.y > floor - b.r) { b.y = floor - b.r; b.vy *= -.15; b.vx *= .6; b.va *= .5; }
      if (b.x < b.r) { b.x = b.r; b.vx *= -.4; }
      if (b.x > W - b.r) { b.x = W - b.r; b.vx *= -.4; }
    }
    const n = bodies.length;
    for (let it = 0; it < 3; it++) for (let i = 0; i < n; i++) {
      const a = bodies[i];
      for (let j = i + 1; j < n; j++) {
        const c = bodies[j], dx = c.x - a.x, dy = c.y - a.y, m = a.r + c.r;
        if (dx > m || dx < -m || dy > m || dy < -m) continue;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < m) {
          const o = (m - d) / 2, nx = dx / d, ny = dy / d;
          a.x -= nx * o; a.y -= ny * o; c.x += nx * o; c.y += ny * o;
          const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (rv < 0) { const k = rv * .55; a.vx += nx * k; a.vy += ny * k; c.vx -= nx * k; c.vy -= ny * k; }
          a.va *= .85; c.va *= .85; a.vx *= .92; c.vx *= .92;
        }
      }
    }

    // dibujo
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const b of bodies) {
      const im = imgs[b.k]; if (!im) continue;
      const w = b.r * 2.5, h = w * im.height / im.width;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
      ctx.drawImage(im, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    section.style.setProperty('--fill', Math.min(1, progress / .85).toFixed(3));
  }
  requestAnimationFrame(step);
  return ready;
}
