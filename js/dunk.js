// Juego: mojar la galletita sin que se parta. Canvas 2D con olas en el líquido y absorción por franjas.
import { sound } from './sound.js';

const LIQUIDS = {
  leche: { color: '#F7F3EA', rate: .32 },
  cafe: { color: '#C99A6B', rate: .42 },
  mate: { color: '#BE9142', rate: .5 },
};
const COOKIES = { rumba: { aguante: 1, rotate: true }, merengadas: { aguante: .75, rotate: false }, mellizas: { aguante: 1.2, rotate: true } };
const MSG = [[15, '¿La mojaste o la saludaste?'], [45, 'Tímida, pero vale.'], [75, 'Punto justo. Así se moja.'], [95, 'Al límite. Respeto.'], [101, 'Leyenda del mojado.']];
const S = 40;

export function initDunk(canvas, base = 'assets/fotos/') {
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  let W = 0, H = 0, dpr = 1;
  let liquid = 'leche', kind = 'rumba';
  let best = 0; try { best = +localStorage.getItem('bagley-dunk') || 0; } catch (e) {}
  $('dunk-best').textContent = best + '%';

  const sprites = {};
  for (const k of Object.keys(COOKIES)) {
    const img = new Image(); img.src = base + k + '-entera.webp';
    img.onload = () => {
      const rot = COOKIES[k].rotate && img.width > img.height;
      const c = document.createElement('canvas');
      c.width = rot ? img.height : img.width; c.height = rot ? img.width : img.height;
      const x = c.getContext('2d');
      if (rot) { x.translate(c.width / 2, c.height / 2); x.rotate(-Math.PI / 2); x.drawImage(img, -img.width / 2, -img.height / 2); }
      else x.drawImage(img, 0, 0);
      sprites[k] = c;
      if (k === kind) reset();
    };
  }

  const ck = { x: 0, y: 0, a: 0, va: 0, vx: 0, w: 0, h: 0, cut: S, soak: new Float32Array(S), dunked: false, grabbed: false, ox: 0, oy: 0 };
  const falling = [], drops = [];
  const waveN = 48, wh = new Float32Array(waveN), wv = new Float32Array(waveN);
  let glass, level, pointer = { x: 0, y: 0 }, broke = 0;

  function layout() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio, 2); W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const gw = Math.min(W * .46, H * .42), gh = H * .5;
    glass = { x0: W * .44 - gw / 2, x1: W * .44 + gw / 2, y1: H * .95, y0: H * .95 - gh, wall: Math.max(6, gw * .035) };
    level = glass.y1 - gh * .62;
    sizeCookie();
  }
  function sizeCookie() {
    const sp = sprites[kind]; if (!sp) return;
    ck.h = H * (kind === 'merengadas' ? .26 : .4); ck.w = ck.h * sp.width / sp.height;
    if (ck.w > (glass.x1 - glass.x0) * .7) { ck.w = (glass.x1 - glass.x0) * .7; ck.h = ck.w * sp.height / sp.width; }
  }
  function rest() { return { x: W * .84 - ck.w * .2, y: H * .08 }; }
  function reset() {
    sizeCookie(); const p = rest();
    Object.assign(ck, { x: p.x, y: p.y, a: 0, va: 0, vx: 0, cut: S, dunked: false });
    ck.soak.fill(0); setGauge(0);
    $('dunk-msg').textContent = 'Agarrala y mojala.'; $('dunk-pct').textContent = '0%';
  }
  function setGauge(v) { $('dunk-gauge').style.width = Math.min(100, v * 100) + '%'; }

  const local = (px, py) => { const dx = px - ck.x, dy = py - ck.y, c = Math.cos(-ck.a), s = Math.sin(-ck.a); return [dx * c - dy * s, dx * s + dy * c]; };
  const world = (lx, ly) => { const c = Math.cos(ck.a), s = Math.sin(ck.a); return [ck.x + lx * c - ly * s, ck.y + lx * s + ly * c]; };
  const pos = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', e => {
    const p = pos(e); const [lx, ly] = local(p.x, p.y);
    if (Math.abs(lx) < ck.w / 2 + 14 && ly > -14 && ly < ck.h * ck.cut / S + 14) {
      ck.grabbed = true; ck.ox = p.x - ck.x; ck.oy = p.y - ck.y; pointer = p;
      canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing';
    }
  });
  canvas.addEventListener('pointermove', e => { pointer = pos(e); });
  const release = () => { ck.grabbed = false; canvas.style.cursor = ''; };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);

  document.querySelectorAll('[data-dunk-cookie]').forEach(b => b.addEventListener('click', () => {
    kind = b.dataset.dunkCookie;
    document.querySelectorAll('[data-dunk-cookie]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    reset();
  }));
  document.querySelectorAll('[data-dunk-liquid]').forEach(b => b.addEventListener('click', () => {
    liquid = b.dataset.dunkLiquid;
    document.querySelectorAll('[data-dunk-liquid]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));

  const surfY = x => { const i = Math.round((x - glass.x0) / (glass.x1 - glass.x0) * (waveN - 1)); return level + (i >= 0 && i < waveN ? wh[i] : 0); };
  const inGlass = x => x > glass.x0 + glass.wall && x < glass.x1 - glass.wall;

  function breakAt(k) {
    // el pedazo mojado se desprende y se hunde
    falling.push({ x0: k, sp: sprites[kind], w: ck.w, h: ck.h, soak: ck.soak.slice(), pos: world(0, ck.h * k / S), a: ck.a, vy: 0, va: (Math.random() - .5) * 2, life: 2.4 });
    ck.cut = k; broke = 1.4;
    sound.plop();
    $('dunk-msg').textContent = '¡Se te partió! Se fue al fondo de la taza.'; $('dunk-pct').textContent = '0%';
    const i = Math.round((ck.x - glass.x0) / (glass.x1 - glass.x0) * (waveN - 1)); if (i > 0 && i < waveN - 1) wv[i] += 14;
  }

  let last = performance.now();
  function step(now) {
    requestAnimationFrame(step);
    const r = canvas.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || !glass) { last = now; return; }
    const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
    const L = LIQUIDS[liquid], sp = sprites[kind];

    // movimiento de la galletita
    const px = ck.x;
    const target = ck.grabbed ? { x: pointer.x - ck.ox, y: pointer.y - ck.oy } : rest();
    ck.x += (target.x - ck.x) * (ck.grabbed ? .35 : .08);
    ck.y += (target.y - ck.y) * (ck.grabbed ? .35 : .08);
    // no atravesar las paredes del vaso por debajo del borde
    const bottomY = ck.y + ck.h * ck.cut / S;
    if (bottomY > glass.y0 + 4) {
      const half = ck.w / 2;
      if (ck.x > glass.x0 - half && ck.x < glass.x1 + half) {
        ck.x = Math.min(Math.max(ck.x, glass.x0 + glass.wall + half), glass.x1 - glass.wall - half);
      }
      ck.y = Math.min(ck.y, glass.y1 - glass.wall - ck.h * ck.cut / S);
    }
    ck.vx = (ck.x - px) / Math.max(dt, .001);
    // péndulo: se inclina con la velocidad horizontal
    const aT = Math.max(-.55, Math.min(.55, -ck.vx * .0012));
    ck.va += (aT - ck.a) * 30 * dt; ck.va *= .86; ck.a += ck.va * dt * 6;

    // absorción por franja
    let maxSoak = 0, submerged = false;
    for (let i = 0; i < ck.cut; i++) {
      const [wx, wy] = world(0, ck.h * (i + .5) / S);
      if (inGlass(wx) && wy > surfY(wx)) {
        ck.soak[i] += dt * L.rate / COOKIES[kind].aguante; submerged = true;
        if (!ck.wasIn) { const j = Math.round((wx - glass.x0) / (glass.x1 - glass.x0) * (waveN - 1)); if (j > 0 && j < waveN - 1) wv[j] += 10; sound.plop(); }
      }
      maxSoak = Math.max(maxSoak, ck.soak[i]);
    }
    if (submerged) { ck.dunked = true; setGauge(maxSoak); }
    // movimiento brusco en el líquido revuelve las olas
    if (submerged) { const j = Math.round((ck.x - glass.x0) / (glass.x1 - glass.x0) * (waveN - 1)); if (j > 0 && j < waveN - 1) wv[j] += ck.vx * dt * .15; }
    ck.wasIn = submerged;

    // ¿se parte?
    if (ck.cut === S || broke <= 0) {
      for (let i = 0; i < ck.cut; i++) {
        if (ck.soak[i] >= 1.15 || (ck.soak[i] >= 1 && Math.abs(ck.vx) > 500)) {
          let k = i; while (k > 0 && ck.soak[k - 1] >= .9) k--;
          if (k < 3) k = 3;
          breakAt(k); break;
        }
      }
    }
    if (broke > 0) { broke -= dt; if (broke <= 0) reset(); }

    // puntaje al sacarla
    if (!submerged && ck.dunked && ck.cut === S) {
      ck.dunked = false;
      let sum = 0; for (let i = 0; i < S; i++) sum += Math.min(1, ck.soak[i]);
      const score = Math.round(Math.min(1, sum / (S * .6)) * 100);
      $('dunk-pct').textContent = score + '%';
      $('dunk-msg').textContent = MSG.find(m => score < m[0])[1];
      if (score > best) { best = score; $('dunk-best').textContent = best + '%'; try { localStorage.setItem('bagley-dunk', best); } catch (e) {} }
      for (let k = 0; k < 6; k++) drops.push({ x: ck.x + (Math.random() - .5) * ck.w * .5, y: ck.y + ck.h - 4, vy: 0, d: Math.random() * .4 });
    }

    // olas
    for (let i = 0; i < waveN; i++) { wv[i] += -wh[i] * 60 * dt; wv[i] *= .96; }
    for (let i = 1; i < waveN - 1; i++) wv[i] += (wh[i - 1] + wh[i + 1] - 2 * wh[i]) * 40 * dt;
    for (let i = 0; i < waveN; i++) wh[i] += wv[i] * dt * 8;

    // ---------- dibujo
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // sombra de la taza
    ctx.fillStyle = 'rgba(0,30,60,.25)'; ctx.beginPath(); ctx.ellipse((glass.x0 + glass.x1) / 2, glass.y1 + 4, (glass.x1 - glass.x0) * .6, 12, 0, 0, 6.283); ctx.fill();
    // fondo del vaso
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    roundBottom(ctx, glass.x0, glass.y0, glass.x1, glass.y1, 26); ctx.fill();

    if (sp) {
      for (let f = falling.length - 1; f >= 0; f--) {
        const p = falling[f]; p.life -= dt;
        if (p.life <= 0) { falling.splice(f, 1); continue; }
        const inside = p.pos[1] > level;
        p.vy += (inside ? 120 : 900) * dt; p.vy *= inside ? .9 : 1;
        p.pos[1] = Math.min(p.pos[1] + p.vy * dt, glass.y1 - 20); p.a += p.va * dt;
        ctx.globalAlpha = Math.min(1, p.life);
        drawCookie(p.sp, p.w, p.h, p.soak, p.x0, S, p.pos[0], p.pos[1], p.a, -p.h * p.x0 / S);
        ctx.globalAlpha = 1;
      }
      drawCookie(sp, ck.w, ck.h, ck.soak, 0, ck.cut, ck.x, ck.y, ck.a, 0);
    }

    // líquido por encima de lo sumergido
    ctx.save();
    roundBottom(ctx, glass.x0 + glass.wall, glass.y0, glass.x1 - glass.wall, glass.y1 - glass.wall, 22); ctx.clip();
    ctx.beginPath();
    for (let i = 0; i < waveN; i++) { const x = glass.x0 + (glass.x1 - glass.x0) * i / (waveN - 1); i ? ctx.lineTo(x, level + wh[i]) : ctx.moveTo(x, level + wh[i]); }
    ctx.lineTo(glass.x1, glass.y1); ctx.lineTo(glass.x0, glass.y1); ctx.closePath();
    ctx.fillStyle = L.color; ctx.globalAlpha = .9; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i < waveN; i++) { const x = glass.x0 + (glass.x1 - glass.x0) * i / (waveN - 1); i ? ctx.lineTo(x, level + wh[i]) : ctx.moveTo(x, level + wh[i]); }
    ctx.stroke();
    ctx.restore();

    // vidrio: contorno y reflejo
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = glass.wall;
    roundBottom(ctx, glass.x0 + glass.wall / 2, glass.y0, glass.x1 - glass.wall / 2, glass.y1 - glass.wall / 2, 24); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 6; ctx.beginPath();
    ctx.moveTo(glass.x0 + glass.wall * 2.4, glass.y0 + 20); ctx.lineTo(glass.x0 + glass.wall * 2.4, glass.y1 - 50); ctx.stroke();

    // gotas
    ctx.fillStyle = L.color;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; if ((d.d -= dt) > 0) continue;
      d.vy += 900 * dt; d.y += d.vy * dt;
      ctx.beginPath(); ctx.ellipse(d.x, d.y, 3, 5, 0, 0, 6.283); ctx.fill();
      if (d.y > H) drops.splice(i, 1);
    }
  }

  // la galletita con las franjas mojadas más oscuras; from/to en franjas, oy corre el origen local
  const tmp = document.createElement('canvas'), tctx = tmp.getContext('2d');
  function drawCookie(sp, w, h, soak, from, to, x, y, a, oy) {
    const tw = Math.ceil(w), th = Math.ceil(h);
    if (tmp.width !== tw || tmp.height !== th) { tmp.width = tw; tmp.height = th; }
    tctx.clearRect(0, 0, tw, th);
    tctx.drawImage(sp, 0, 0, tw, th);
    tctx.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < S; i++) if (soak[i] > .01) { tctx.fillStyle = `rgba(60,30,10,${Math.min(.55, soak[i] * .5)})`; tctx.fillRect(0, th * i / S, tw, th / S + 1); }
    tctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.rect(-w / 2 - 2, oy + h * from / S, w + 4, h * (to - from) / S); ctx.clip();
    // borde partido: dientes en el corte
    ctx.drawImage(tmp, -w / 2, oy, w, h);
    ctx.restore();
  }
  function roundBottom(c, x0, y0, x1, y1, r) {
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, y1 - r); c.quadraticCurveTo(x0, y1, x0 + r, y1); c.lineTo(x1 - r, y1); c.quadraticCurveTo(x1, y1, x1, y1 - r); c.lineTo(x1, y0);
  }

  new ResizeObserver(layout).observe(canvas);
  layout(); requestAnimationFrame(step);
}
