// Hero: mientras bajás caen galletitas y se apilan hasta tapar la pantalla; si subís, se van sacando.
// Sin choques en vivo: cada galletita tiene su lugar calculado de antemano (de abajo hacia arriba),
// cae hasta ahí con un rebotecito y queda fija. Así la pila nunca tiembla.
import { sound } from './sound.js';

const KINDS = ['rumba', 'merengadas', 'mellizas'];
const FALL = .55; // segundos de caída

export function initHero(section, canvas, base = 'assets/fotos/') {
  const ctx = canvas.getContext('2d');
  const imgs = {};
  const ready = Promise.all(KINDS.map(k => new Promise(res => {
    const i = new Image(); i.src = base + k + '-entera.webp';
    i.onload = () => { imgs[k] = i; res(); redrawStatic(); }; i.onerror = res;
  })));

  let W = 0, H = 0, dpr = 1, R = 50;
  let slots = [];       // lugares finales, en orden de llenado
  let shown = [];       // galletitas en pantalla: { slot, t0 } (t0 < 0: ya aterrizó)
  const baked = document.createElement('canvas'), bctx = baked.getContext('2d');

  // lugares: filas de abajo hacia arriba, con desorden; el orden dentro de cada fila es aleatorio
  function layout() {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    slots = [];
    const dx = R * 1.75, dy = R * 1.3;
    for (let row = 0, y = H - R * .7; y > -R * 1.2; row++, y -= dy) {
      const rowSlots = [];
      for (let x = (row % 2 ? dx / 2 : 0) - R * .3; x < W + R; x += dx) {
        rowSlots.push({ x: x + (rnd() - .5) * R * .6, y: y + (rnd() - .5) * R * .5, a: (rnd() - .5) * 1.6, k: KINDS[Math.floor(rnd() * 3)], s: .9 + rnd() * .25 });
      }
      for (let i = rowSlots.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rowSlots[i], rowSlots[j]] = [rowSlots[j], rowSlots[i]]; }
      slots.push(...rowSlots);
    }
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio, 2); W = r.width; H = r.height;
    canvas.width = baked.width = Math.round(W * dpr); canvas.height = baked.height = Math.round(H * dpr);
    R = Math.max(30, Math.min(60, W / 24));
    layout();
    shown = shown.filter(c => c.slot < slots.length).map(c => ({ slot: c.slot, t0: -1 }));
    redrawStatic();
  }

  function drawCookie(c, s, y) {
    const im = imgs[s.k]; if (!im) return;
    const w = R * 2.5 * s.s, h = w * im.height / im.width;
    c.save(); c.translate(s.x, y); c.rotate(s.a);
    c.drawImage(im, -w / 2, -h / 2, w, h);
    c.restore();
  }
  // las que ya aterrizaron se dibujan una sola vez en una capa fija
  function redrawStatic() {
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0); bctx.clearRect(0, 0, W, H);
    for (const c of shown) if (c.t0 < 0) drawCookie(bctx, slots[c.slot], slots[c.slot].y);
  }

  new ResizeObserver(resize).observe(canvas); resize();

  let lastRattle = 0;
  function step(now) {
    requestAnimationFrame(step);
    const sr = section.getBoundingClientRect();
    if (sr.bottom < 0 || sr.top > innerHeight) return;
    const progress = Math.min(1, Math.max(0, -sr.top / (sr.height - innerHeight)));
    const t = now / 1000;

    // cuántas tienen que estar: unas pocas de entrada, la pantalla llena al 85% del recorrido
    const target = Math.round(8 + (slots.length - 8) * Math.min(1, progress / .85));
    let added = 0;
    while (shown.length < target && added < 4) { shown.push({ slot: shown.length, t0: t + added * .06 }); added++; }
    if (added && now - lastRattle > 220) { lastRattle = now; sound.rattle(); }
    if (shown.length > target + 2) { shown.length = target; redrawStatic(); }

    // las que terminaron de caer pasan a la capa fija
    for (const c of shown) if (c.t0 >= 0 && t - c.t0 >= FALL) { c.t0 = -1; drawCookie(bctx, slots[c.slot], slots[c.slot].y); }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baked, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const c of shown) {
      if (c.t0 < 0) continue;
      const s = slots[c.slot], u = Math.max(0, (t - c.t0) / FALL);
      // caída acelerada con un rebote chico al final
      const fall = u < .8 ? Math.pow(u / .8, 2) : 1 - Math.sin((u - .8) / .2 * Math.PI) * .04;
      const y0 = -R * 2;
      drawCookie(ctx, s, y0 + (s.y - y0) * fall);
    }
    section.style.setProperty('--fill', Math.min(1, progress / .85).toFixed(3));
  }
  requestAnimationFrame(step);
  return ready;
}
