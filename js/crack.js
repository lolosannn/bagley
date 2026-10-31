// Galletitera: la foto entera tiembla, hace crack y se cambia por sus pedazos, que se separan con el scroll.
import { sound } from './sound.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = t => 1 - Math.pow(1 - t, 3);
const CR = .22, F0 = -.38;

export async function initCrack(sections, base = 'assets/fotos/') {
  const PARTS = await fetch(base + 'partes.json').then(r => r.json());
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', e => { mouse.tx = e.clientX / innerWidth - .5; mouse.ty = e.clientY / innerHeight - .5; });
  const scenes = [];

  sections.forEach(sec => {
    const name = sec.dataset.cookie, items = PARTS[name], stage = sec.querySelector('.stage');
    const pieces = items.filter(t => t.kind === 'piece');
    let cx = 0, cy = 0, A = 0;
    for (const p of pieces) { cx += (p.x + p.w / 2) * p.area; cy += (p.y + p.h / 2) * p.area; A += p.area; }
    cx /= A; cy /= A;
    let seed = name.length * 97;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    const mk = (src, cls) => { const img = new Image(); img.src = base + src; img.alt = ''; img.decoding = 'async'; img.loading = 'lazy'; img.className = cls; stage.appendChild(img); return img; };
    const layers = items.map((t, i) => {
      const img = mk(t.file, t.kind);
      Object.assign(img.style, { left: t.x * 100 + '%', top: t.y * 100 + '%', width: t.w * 100 + '%' });
      return { img, kind: t.kind, dx: t.x + t.w / 2 - cx, dy: t.y + t.h / 2 - cy, depth: t.kind === 'piece' ? .6 + i * .15 : 1.2 + rnd() * 1.5, spin: (rnd() - .5) * (t.kind === 'piece' ? 10 : 120) };
    });
    const crumbsSrc = items.filter(t => t.kind === 'crumb');
    for (let k = 0; k < 26 && crumbsSrc.length; k++) {
      const s = crumbsSrc[k % crumbsSrc.length], img = mk(s.file, 'crumb');
      const a = rnd() * Math.PI * 2, r = .08 + rnd() * .1, sc = .4 + rnd() * .8;
      Object.assign(img.style, { left: (cx + Math.cos(a) * r * .3) * 100 + '%', top: (cy + Math.sin(a) * r * .3) * 100 + '%', width: s.w * 100 * sc + '%' });
      layers.push({ img, kind: 'extra', dx: Math.cos(a) * r * 2.4, dy: Math.sin(a) * r * 2.4, depth: 1 + rnd() * 2, spin: (rnd() - .5) * 400 });
    }

    // la entera ocupa la misma superficie que los pedazos juntos
    let bx0 = 1, by0 = 1, bx1 = 0, by1 = 0;
    for (const t of pieces) {
      const ox = (t.x + t.w / 2 - cx) * F0, oy = (t.y + t.h / 2 - cy) * F0;
      bx0 = Math.min(bx0, t.x + ox); by0 = Math.min(by0, t.y + oy); bx1 = Math.max(bx1, t.x + t.w + ox); by1 = Math.max(by1, t.y + t.h + oy);
    }
    const whole = mk(name + '-entera.webp', 'piece whole');
    whole.loading = 'eager';
    const place = () => {
      const asp = whole.naturalWidth / whole.naturalHeight || 1.4;
      const ww = Math.min(.8, Math.sqrt(.78 * (bx1 - bx0) * (by1 - by0) * asp)), wh = ww / asp;
      Object.assign(whole.style, { width: ww * 100 + '%', left: ((bx0 + bx1) / 2 - ww / 2) * 100 + '%', top: ((by0 + by1) / 2 - wh / 2) * 100 + '%' });
    };
    whole.onload = place; if (whole.complete) place();

    const meters = [...sec.querySelectorAll('.meter')].map(m => ({ bar: m.querySelector('b'), num: m.querySelector('span'), v: +m.dataset.v }));
    scenes.push({ sec, stage, layers, meters, whole, cracked: false });
  });

  function frame() {
    requestAnimationFrame(frame);
    mouse.x += (mouse.tx - mouse.x) * .08; mouse.y += (mouse.ty - mouse.y) * .08;
    for (const s of scenes) {
      const r = s.sec.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const p = reduce ? 1 : Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
      if (p >= CR && !s.cracked) {
        s.cracked = true; sound.crack();
        s.stage.animate([{ transform: 'scale(1.07)' }, { transform: 'scale(1)' }], { duration: 280, easing: 'ease-out' });
      }
      if (p < CR) s.cracked = false;
      const shakeAmt = p > .14 && p < CR ? Math.pow((p - .14) / (CR - .14), 2) : 0;
      const shake = Math.sin(p * 1400) * shakeAmt * 9;
      const broken = p >= CR;
      const open = ease(Math.min(1, Math.max(0, (p - CR) / .68)));
      const bob = Math.sin(performance.now() / 700) * 6;
      const W = s.stage.clientWidth;
      s.whole.style.opacity = broken ? 0 : 1;
      s.whole.style.transform = `translate3d(${(mouse.x * 30 + shake).toFixed(1)}px, ${(mouse.y * 22 + bob).toFixed(1)}px, 0) rotate(${(mouse.x * 4 + shake * .4).toFixed(2)}deg) scale(${(1 + shakeAmt * .04).toFixed(3)})`;
      for (const L of s.layers) {
        let x, y, rot, op = 1;
        if (L.kind === 'piece') {
          const f = F0 + open * .78;
          x = L.dx * f * W; y = L.dy * f * W; rot = L.spin * open;
        } else {
          const f = open * (L.kind === 'extra' ? 1 : 1.6);
          x = L.dx * f * W; y = L.dy * f * W + open * open * 40 * L.depth; rot = L.spin * open;
          op = Math.min(1, .3 + open * 4);
        }
        x += mouse.x * 40 * L.depth; y += mouse.y * 30 * L.depth;
        L.img.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
        L.img.style.opacity = broken ? op : 0;
      }
      for (const m of s.meters) { const v = Math.round(m.v * Math.min(1, open * 1.2)); m.bar.style.width = v + '%'; m.num.textContent = v + '%'; }
    }
  }
  frame();
}
