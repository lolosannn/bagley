// Orquesta todo: loader, scroll suave, secciones e interacciones chicas.
import { sound } from './sound.js';
import { initCrack } from './crack.js';
import { initDunk } from './dunk.js';
import { initSurtido } from './surtido.js';
import { initPinata } from './pinata.js';
import { initHero } from './hero.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------- loader ---------- */
const TOTAL = 4;
let done = 0, shown = 0;
const t0 = performance.now();
const tick = () => { done = Math.min(TOTAL, done + 1); };
function loaderLoop() {
  const minP = Math.min(1, (performance.now() - t0) / 1800);
  const target = Math.min(done / TOTAL, minP);
  shown += (target - shown) * .12;
  $('#loader-bar').style.width = shown * 100 + '%';
  $('#loader-year').textContent = Math.round(1864 + shown * 160);
  if (shown > .995 && done >= TOTAL) return finishLoader();
  requestAnimationFrame(loaderLoop);
}
function finishLoader() {
  $('#loader-year').textContent = '2024';
  const l = $('#loader');
  l.classList.add('open');
  setTimeout(() => { l.classList.add('done'); document.body.classList.remove('is-loading'); document.body.classList.add('ready'); }, 650);
}
requestAnimationFrame(loaderLoop);
setTimeout(() => { done = TOTAL; }, 9000); // si algo tarda demasiado, igual se entra

/* ---------- banderines ---------- */
$$('[data-bunting]').forEach(b => {
  const n = Math.ceil(innerWidth / 45) + 2;
  for (let i = 0; i < n; i++) b.appendChild(document.createElement('i'));
});
// los banderines cerca del mouse se mueven con su velocidad (posiciones cacheadas, sin medir en cada movimiento)
const flags = $$('[data-bunting] i');
let flagX = [];
const measureFlags = () => { flagX = flags.map(i => { const r = i.getBoundingClientRect(); return r.left + r.width / 2; }); };
measureFlags(); addEventListener('resize', measureFlags);
let lastMX = 0, flagQueued = false, flagV = 0, flagAt = 0;
addEventListener('pointermove', e => {
  flagV = Math.max(-20, Math.min(20, (e.clientX - lastMX) * .6)); lastMX = e.clientX; flagAt = e.clientX;
  if (flagQueued) return; flagQueued = true;
  requestAnimationFrame(() => { flagQueued = false; flags.forEach((i, k) => { if (Math.abs(flagX[k] - flagAt) < 160) i.style.setProperty('--sw', flagV); }); });
}, { passive: true });

/* ---------- scroll suave ---------- */
let lenis = null;
function startLenis() {
  if (reduce || !window.Lenis) return;
  lenis = new window.Lenis({ lerp: .1, smoothWheel: true });
  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const el = document.querySelector(a.getAttribute('href')); if (!el) return;
    e.preventDefault(); lenis.scrollTo(el, { offset: 0, duration: 1.4 });
  }));
}
if (document.readyState === 'complete') startLenis(); else addEventListener('load', startLenis);

/* ---------- nav: se esconde al bajar ---------- */
let lastY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY; $('#nav').classList.toggle('hide', y > lastY && y > 200); lastY = y;
}, { passive: true });

/* ---------- sonido ---------- */
$('#sound').addEventListener('click', e => {
  const on = sound.toggle();
  e.currentTarget.setAttribute('aria-pressed', String(on));
  e.currentTarget.setAttribute('aria-label', on ? 'Silenciar' : 'Activar sonido');
});

/* ---------- cursor con etiqueta ---------- */
if (matchMedia('(pointer: fine)').matches) {
  const c = $('#cursor'), label = c.querySelector('span');
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    const t = e.target.closest && e.target.closest('[data-cursor]');
    c.classList.toggle('label', !!t); if (t) label.textContent = t.dataset.cursor;
  });
  const loop = () => { cx += (x - cx) * .25; cy += (y - cy) * .25; c.style.transform = `translate(${cx}px, ${cy}px)`; requestAnimationFrame(loop); };
  loop();
  // botones magnéticos
  $$('[data-magnet]').forEach(b => {
    b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px, ${(e.clientY - r.top - r.height / 2) * .35}px)`; });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
}

/* ---------- manifiesto: las palabras se van llenando ---------- */
const mani = $('#mani-text');
mani.innerHTML = mani.textContent.split(' ').map(w => `<span class="w">${w}</span>`).join(' ');
const words = [...mani.querySelectorAll('.w')];
const maniSec = $('#manifiesto');
function maniUpdate() {
  const r = mani.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (innerHeight * .85 - r.top) / (r.height + innerHeight * .4)));
  const n = Math.round(p * words.length);
  words.forEach((w, i) => w.classList.toggle('on', i < n));
  const sr = maniSec.getBoundingClientRect();
  if (sr.top < innerHeight * .6 && sr.bottom > 0) $$('[data-pop]').forEach(s => s.classList.add('on'));
}
addEventListener('scroll', maniUpdate, { passive: true }); maniUpdate();

/* ---------- contadores ---------- */
const statsIO = new IntersectionObserver((es) => es.forEach(e => {
  if (!e.isIntersecting) return; statsIO.unobserve(e.target);
  const el = e.target, to = +el.dataset.count, from = to > 1000 ? 1800 : 0, t1 = performance.now();
  const run = now => { const k = Math.min(1, (now - t1) / 1400); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(run); };
  reduce ? (el.textContent = to) : requestAnimationFrame(run);
}), { threshold: .6 });
$$('[data-count]').forEach(el => statsIO.observe(el));

/* ---------- álbum de figuritas ---------- */
const album = $('#historia'), track = $('#album-track');
function albumUpdate() {
  const r = album.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
  const dist = Math.max(0, track.scrollWidth - innerWidth);
  track.style.transform = `translate3d(${-p * dist}px, 0, 0)`;
}
addEventListener('scroll', albumUpdate, { passive: true }); addEventListener('resize', albumUpdate); albumUpdate();
const figus = $$('.figu');
figus.forEach(f => {
  const inner = f.querySelector('.figu-inner');
  f.addEventListener('pointermove', e => {
    const r = f.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    inner.style.setProperty('--ry', `${(x - .5) * 24}deg`); inner.style.setProperty('--rx', `${(.5 - y) * 18}deg`);
    inner.style.setProperty('--mx', x * 100 + '%'); inner.style.setProperty('--my', y * 100 + '%'); inner.style.setProperty('--hx', x * 100 + '%'); inner.style.setProperty('--holo', 1);
  });
  f.addEventListener('pointerleave', () => { ['--rx', '--ry'].forEach(p => inner.style.setProperty(p, '0deg')); inner.style.setProperty('--holo', 0); });
  f.addEventListener('click', () => {
    f.classList.toggle('stuck'); sound.paper();
    const n = figus.filter(x => x.classList.contains('stuck')).length;
    $('#album-count').textContent = n; $('#album-bar').style.width = n / figus.length * 100 + '%';
    if (n === figus.length) rain('rumba', 40);
  });
});

/* ---------- lluvia de galletitas (easter egg y álbum completo) ---------- */
const rainCanvas = $('#rain'), rctx = rainCanvas.getContext('2d');
const rainImgs = {};
['rumba', 'merengadas', 'mellizas'].forEach(k => { const i = new Image(); i.src = `assets/fotos/${k}-entera.webp`; rainImgs[k] = i; });
let drops = [], raining = false;
function rain(kind, n = 50) {
  const d = Math.min(devicePixelRatio, 2);
  rainCanvas.width = innerWidth * d; rainCanvas.height = innerHeight * d;
  for (let i = 0; i < n; i++) drops.push({ k: kind === 'mix' ? ['rumba', 'merengadas', 'mellizas'][i % 3] : kind, x: Math.random() * innerWidth, y: -100 - Math.random() * innerHeight, v: 300 + Math.random() * 400, a: Math.random() * 6, va: (Math.random() - .5) * 5, s: 60 + Math.random() * 70 });
  if (!raining) { raining = true; let last = performance.now(); const loop = now => {
    const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
    rctx.setTransform(d, 0, 0, d, 0, 0); rctx.clearRect(0, 0, innerWidth, innerHeight);
    drops = drops.filter(p => p.y < innerHeight + 150);
    for (const p of drops) { p.y += p.v * dt; p.a += p.va * dt; const im = rainImgs[p.k]; if (!im.complete) continue; const h = p.s * im.height / im.width; rctx.save(); rctx.translate(p.x, p.y); rctx.rotate(p.a); rctx.drawImage(im, -p.s / 2, -h / 2, p.s, h); rctx.restore(); }
    if (drops.length) requestAnimationFrame(loop); else { raining = false; rctx.clearRect(0, 0, innerWidth, innerHeight); }
  }; requestAnimationFrame(loop); }
  sound.rattle();
}
let typed = '';
addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  typed = (typed + e.key.toLowerCase()).slice(-12);
  for (const k of ['rumba', 'merengadas', 'mellizas', 'bagley']) if (typed.endsWith(k)) { rain(k === 'bagley' ? 'mix' : k, 60); typed = ''; }
});

/* ---------- módulos grandes ---------- */
document.fonts.ready.then(tick);
initCrack($$('.scene')).then(tick, tick);
initDunk($('#dunk-canvas'));
initSurtido($('#bag-canvas'), $('#surtido-form'));
initPinata($('#pinata-canvas'), $('#pinata-btn'));
tick();

initHero($('#inicio'), $('#hero-canvas')).then(tick);
