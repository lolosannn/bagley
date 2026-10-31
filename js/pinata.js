// Footer: piñata. Galletitas con física simple (círculos) que caen, rebotan y se empujan con el mouse.
import { sound } from './sound.js';

export function initPinata(canvas, button, base = 'assets/fotos/') {
  const ctx = canvas.getContext('2d');
  const kinds = ['rumba', 'merengadas', 'mellizas'];
  const imgs = {};
  kinds.forEach(k => { const i = new Image(); i.src = base + k + '-entera.webp'; i.onload = () => (imgs[k] = i); });
  const confetti = [];
  const COLS = ['#FFD200', '#FFFFFF', '#5DBB46', '#1B9DD9', '#F27FB2'];
  let W = 0, H = 0, dpr = 1, bodies = [], started = false, mouse = { x: -999, y: -999, vx: 0, vy: 0 };

  function resize() { const r = canvas.getBoundingClientRect(); dpr = Math.min(devicePixelRatio, 2); W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; }
  new ResizeObserver(resize).observe(canvas); resize();

  function spawn(n, x = W / 2, y = -60, burst = false) {
    const R = Math.max(34, Math.min(70, W / 16));
    for (let i = 0; i < n && bodies.length < 70; i++) {
      bodies.push({
        k: kinds[(bodies.length + i) % 3], r: R * (.75 + Math.random() * .4),
        x: x + (Math.random() - .5) * (burst ? 60 : W * .8), y: y - Math.random() * (burst ? 40 : 600),
        vx: burst ? (Math.random() - .5) * 900 : (Math.random() - .5) * 60, vy: burst ? -300 - Math.random() * 600 : 0,
        a: Math.random() * 6, va: (Math.random() - .5) * 4,
      });
    }
  }
  function burst() {
    const x = W / 2, y = H * .32;
    spawn(14, x, y, true);
    for (let i = 0; i < 90; i++) confetti.push({ x, y, vx: (Math.random() - .5) * 1100, vy: -200 - Math.random() * 700, a: Math.random() * 6, c: COLS[i % COLS.length], life: 3 });
    sound.crack();
  }
  button.addEventListener('click', burst);
  canvas.addEventListener('pointerdown', e => { const r = canvas.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; for (const b of bodies) { const d = Math.hypot(b.x - x, b.y - y); if (d < b.r * 2.5) { b.vy -= 700; b.vx += (b.x - x) * 6; } } sound.pop(); });
  addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; mouse.vx = x - mouse.x; mouse.vy = y - mouse.y; mouse.x = x; mouse.y = y; });

  new IntersectionObserver(es => { if (es[0].isIntersecting && !started) { started = true; spawn(22); } }, { threshold: .35 }).observe(canvas);

  let last = performance.now();
  function step(now) {
    requestAnimationFrame(step);
    const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
    const r = canvas.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    const floor = H - 8;
    for (const b of bodies) {
      b.vy += 1600 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.va * dt;
      const md = Math.hypot(b.x - mouse.x, b.y - mouse.y);
      if (md < b.r + 30) { b.vx += mouse.vx * 12; b.vy += mouse.vy * 12 - 60; }
      if (b.y > floor - b.r) { b.y = floor - b.r; b.vy *= -.35; b.vx *= .9; b.va = b.vx / b.r; }
      if (b.x < b.r) { b.x = b.r; b.vx *= -.5; } if (b.x > W - b.r) { b.x = W - b.r; b.vx *= -.5; }
    }
    mouse.vx *= .5; mouse.vy *= .5;
    for (let it = 0; it < 3; it++) for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], c = bodies[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), m = a.r + c.r;
      if (d > 0 && d < m) { const o = (m - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * o; a.y -= ny * o; c.x += nx * o; c.y += ny * o; const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny; if (rv < 0) { const k = rv * .6; a.vx += nx * k; a.vy += ny * k; c.vx -= nx * k; c.vy -= ny * k; } }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    for (const b of bodies) {
      const im = imgs[b.k]; if (!im) continue;
      const w = b.r * 2.3, h = w * im.height / im.width;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.shadowColor = 'rgba(80,0,0,.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
      ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i]; c.life -= dt; if (c.life <= 0) { confetti.splice(i, 1); continue; }
      c.vy += 900 * dt; c.vx *= .98; c.x += c.vx * dt; c.y += c.vy * dt; c.a += dt * 8;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a); ctx.globalAlpha = Math.min(1, c.life); ctx.fillStyle = c.c; ctx.fillRect(-6, -3, 12, 6); ctx.restore();
    }
  }
  requestAnimationFrame(step);
}
