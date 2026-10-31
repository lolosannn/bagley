import * as THREE from 'three';

/* ================================================================
   Ruido y utilidades
   ================================================================ */
const fract = v => v - Math.floor(v);
const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) { let s = 0, a = .5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= .5; } return s; }
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
let seedState = 1;
const rnd = () => (seedState = (seedState * 16807) % 2147483647) / 2147483647;

/* ================================================================
   Funciones de distancia con signo (negativo = adentro)
   ================================================================ */
const sdCircle = (x, y, r) => Math.hypot(x, y) - r;
function sdRoundRect(x, y, hw, hh, r) {
  const qx = Math.abs(x) - hw + r, qy = Math.abs(y) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
// borde festoneado: lóbulos redondos hacia afuera y valles marcados
function scallopRect(hw, hh, r, s, A) {
  return (x, y) => {
    const d = sdRoundRect(x, y, hw, hh, r);
    const ax = Math.abs(x), ay = Math.abs(y);
    const p = (hh - ay) < (hw - ax) ? x : y;
    const lobe = Math.abs(Math.cos(Math.PI * p / s));
    return d - A * Math.pow(lobe, .7);
  };
}
function scallopCircle(R, n, A) {
  return (x, y) => sdCircle(x, y, R) - A * Math.pow(Math.abs(Math.cos(n * Math.atan2(y, x) / 2)), .7);
}
const sub = (a, b) => (x, y) => Math.max(a(x, y), -b(x, y));
const uni = (...fs) => (x, y) => { let m = Infinity; for (const f of fs) m = Math.min(m, f(x, y)); return m; };
const inset = (f, k) => (x, y) => f(x, y) + k;

/* ================================================================
   Relieve: se dibuja en un canvas (blanco = sobresale) y se muestrea
   ================================================================ */
function makeRelief(bounds, draw, px = 1024, blur = 2.2) {
  const [minx, maxx, miny, maxy] = bounds;
  const W = maxx - minx, H = maxy - miny;
  const cw = px, ch = Math.round(px * H / W), s = cw / W;
  // se dibuja nítido y se desenfoca una sola vez (desenfocar cada trazo por separado congelaba el navegador)
  const raw = document.createElement('canvas'); raw.width = cw; raw.height = ch;
  const rctx = raw.getContext('2d');
  rctx.fillStyle = '#000'; rctx.fillRect(0, 0, cw, ch);
  const P = (x, y) => [(x - minx) * s, (maxy - y) * s];
  const S = v => v * s;
  rctx.fillStyle = rctx.strokeStyle = '#fff';
  rctx.lineCap = rctx.lineJoin = 'round';
  draw(rctx, P, S);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(raw, 0, 0);
  ctx.filter = 'none';
  const data = ctx.getImageData(0, 0, cw, ch).data;
  const h = new Float32Array(cw * ch);
  for (let i = 0; i < h.length; i++) h[i] = data[i * 4] / 255;
  const sample = (x, y) => {
    const fx = clamp((x - minx) * s, 0, cw - 1.001), fy = clamp((maxy - y) * s, 0, ch - 1.001);
    const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, i = iy * cw + ix;
    return lerp(lerp(h[i], h[i + 1], tx), lerp(h[i + cw], h[i + cw + 1], tx), ty);
  };
  return { sample, h, cw, ch, s };
}

// mapa de normales a partir del relieve + poros de masa horneada
// poros: un mosaico de ruido de 256 px calculado una vez por escala y repetido
const PORE_T = 256, poreCache = {};
function poreTile(scale) {
  if (poreCache[scale]) return poreCache[scale];
  const t = new Float32Array(PORE_T * PORE_T);
  for (let y = 0; y < PORE_T; y++) for (let x = 0; x < PORE_T; x++) t[y * PORE_T + x] = fbm(x / scale, y / scale) + .5 * vnoise(x / (scale * .35), y / (scale * .35));
  return (poreCache[scale] = t);
}
function makeNormalMap(relief, strength, poreAmt, poreScale) {
  const { h, cw, ch } = relief;
  const hh = new Float32Array(h.length);
  const tile = poreTile(poreScale);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = y * cw + x;
    // repetición en espejo: sin costuras visibles entre mosaicos
    const tx = x & 511, ty = y & 511;
    hh[i] = h[i] * strength + poreAmt * tile[(ty < 256 ? ty : 511 - ty) * PORE_T + (tx < 256 ? tx : 511 - tx)];
  }
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(cw, ch); const d = img.data;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const xl = Math.max(x - 1, 0), xr = Math.min(x + 1, cw - 1), yu = Math.max(y - 1, 0), yd = Math.min(y + 1, ch - 1);
    const dx = hh[y * cw + xr] - hh[y * cw + xl];
    const dy = hh[yu * cw + x] - hh[yd * cw + x];
    let nx = -dx, ny = -dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const k = (y * cw + x) * 4;
    d[k] = (nx * .5 + .5) * 255; d[k + 1] = (ny * .5 + .5) * 255; d[k + 2] = (nz * .5 + .5) * 255; d[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8;
  return t;
}

// textura de color fina: puntitos de horneado, azúcar, harina
function makeSpeckle(seed, dark, light, density = 9000) {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1024, 1024);
  seedState = seed;
  for (let i = 0; i < density; i++) {
    const x = rnd() * 1024, y = rnd() * 1024, r = .4 + rnd() * 1.6;
    ctx.fillStyle = rnd() < .7 ? dark : light;
    ctx.globalAlpha = .08 + rnd() * .22;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/* ================================================================
   Malla de una mitad (cara superior o inferior) a partir de la SDF.
   Grilla densa; los vértices de afuera se "pegan" al contorno, así
   la silueta queda limpia (festones, agujeros y mordiscos incluidos).
   ================================================================ */
function buildHalf(sdf, o) {
  const [minx, maxx, miny, maxy] = o.bounds;
  const step = Math.max(maxx - minx, maxy - miny) / o.res;
  const nx = Math.ceil((maxx - minx) / step) + 1, ny = Math.ceil((maxy - miny) / step) + 1;
  const N = nx * ny;
  const pos = new Float32Array(N * 3), uv = new Float32Array(N * 2), col = new Float32Array(N * 3);
  const inside = new Uint8Array(N), used = new Uint8Array(N);
  const e = 1e-3;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    let x = minx + i * step, y = miny + j * step, d = sdf(x, y), z = 0, t = 0;
    if (d <= 0) {
      inside[k] = 1; t = -d;
      z = o.height(x, y, t);
    } else if (d < step * 1.6) {
      for (let it = 0; it < 4 && Math.abs(d) > 1e-5; it++) {
        const gx = (sdf(x + e, y) - sdf(x - e, y)) / (2 * e), gy = (sdf(x, y + e) - sdf(x, y - e)) / (2 * e);
        const gl = Math.hypot(gx, gy) || 1;
        x -= gx / gl * d; y -= gy / gl * d; d = sdf(x, y);
      }
      z = 0;
    }
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z * o.sign;
    uv[k * 2] = (x - minx) / (maxx - minx); uv[k * 2 + 1] = (y - miny) / (maxy - miny);
    const c = o.color(x, y, t);
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  const idx = [];
  const push = (a, b, c) => {
    if (!(inside[a] || inside[b] || inside[c])) return;
    if (o.sign > 0) idx.push(a, b, c); else idx.push(a, c, b);
    used[a] = used[b] = used[c] = 1;
  };
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    // diagonal alternada para que el borde no quede serruchado
    if ((i + j) & 1) { push(a, b, d); push(a, d, c); } else { push(a, b, c); push(b, d, c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ================================================================
   Las seis galletitas
   ================================================================ */
const C = h => new THREE.Color(h);

// ---------- Sonrisas: redonda, manteca pálida, cara calada, mermelada roja
const sonrisasOuter = (x, y) => sdCircle(x, y, 1) + .012 * (vnoise(Math.atan2(y, x) * 4 + 10, 3) - .5);
const sonrisasFace = uni(
  (x, y) => sdRoundRect(x + .27, y - .2, .1, .125, .06),
  (x, y) => sdRoundRect(x - .27, y - .2, .1, .125, .06),
  (x, y) => Math.max(sdCircle(x, y + .02, .44), -sdCircle(x, y - .2, .5)) - .005
);

// ---------- Rumba: cuadrada festoneada, chocolate mate, guarda de rayitas y personaje
const rumbaOuter = scallopRect(1.0, .85, .1, .1, .035);
const rumbaEyes = uni((x, y) => sdCircle(x + .12, y - .1, .042), (x, y) => sdCircle(x - .12, y - .1, .042));

// ---------- Chocolinas: rectangular festoneada, cacao oscuro, filigrana
const chocoOuter = scallopRect(1.25, .6, .08, .05, .022);

// ---------- Opera: oblea rectangular con cuadriculado y escudo
const operaOuter = (x, y) => sdRoundRect(x, y, 1.35, .62, .035);

// ---------- Merengadas: redonda festoneada con merengue rosa
const merenOuter = scallopCircle(.95, 30, .03);

// ---------- Mellizas: rectangular festoneada dorada con crema blanca
const mellizasOuter = scallopRect(1.2, .8, .1, .1, .035);

function dashedRoundRect(ctx, P, S, hw, hh, r, dash, gap, w) {
  const [x0, y0] = P(-hw, hh);
  ctx.lineWidth = S(w); ctx.setLineDash([S(dash), S(gap)]);
  ctx.beginPath(); ctx.roundRect(x0, y0, S(hw * 2), S(hh * 2), S(r)); ctx.stroke(); ctx.setLineDash([]);
}

const ALL_PRODUCTS = [
  {
    id: 'sonrisas', name: 'Sonrisas', tag: 'La que te sonríe de vuelta',
    desc: 'Masa de manteca, cara calada y relleno sabor frambuesa que se asoma por los ojos y la sonrisa.',
    bg: ['#F46AA6', '#C42A6E'], ink: '#FFFFFF', script: true,
    layers: [
      { kind: 'cookie', sdf: sonrisasOuter, H: .085, R: .085, relief: 'sonrisasBack' },
      { kind: 'fill', sdf: inset(sonrisasOuter, .045), H: .028, color: '#C4122F', rough: .28, coat: .7, wobble: .02 },
      { kind: 'cookie', sdf: sub(sonrisasOuter, sonrisasFace), H: .085, R: .085, relief: 'sonrisas' },
    ],
    dough: { base: '#F6DA86', edge: '#E9BF5E', raised: '#F9E29A', bottom: '#EDC86A', rough: .72, sheen: .5, speckDark: '#C8913A', speckLight: '#FFF6D8' },
  },
  {
    id: 'rumba', name: 'Rumba', tag: 'La del recreo',
    desc: 'Dos tapitas sabor chocolate festoneadas, con su personaje en relieve y relleno sabor coco.',
    bg: ['#FFD200', '#E3A800'], ink: '#5B2E17',
    layers: [
      { kind: 'cookie', sdf: rumbaOuter, H: .07, R: .05, relief: 'plainChoco' },
      { kind: 'fill', sdf: inset((x, y) => sdRoundRect(x, y, .98, .83, .12), .06), H: .055, color: '#F7F2E8', rough: .55, coat: .1, wobble: .025 },
      { kind: 'cookie', sdf: sub(rumbaOuter, rumbaEyes), H: .07, R: .05, relief: 'rumba' },
    ],
    dough: { base: '#6A3A24', edge: '#4E2716', raised: '#7B4630', bottom: '#57301D', rough: .9, sheen: .35, speckDark: '#2E140A', speckLight: '#9A6A50' },
  },
  {
    id: 'chocolinas', name: 'Chocolinas', tag: 'La de la chocotorta',
    desc: 'Finitas, de chocolate, con borde festoneado. Nacieron para mojarse en café con leche y apilarse.',
    bg: ['#6A37A8', '#3F1C72'], ink: '#FFD200', script: true,
    layers: [{ kind: 'cookie', sdf: chocoOuter, H: .065, R: .045, relief: 'chocolinas' }],
    dough: { base: '#4A2618', edge: '#36190E', raised: '#5A3020', bottom: '#3C1D11', rough: .85, sheen: .3, speckDark: '#1E0C05', speckLight: '#7A4A35' },
  },
  {
    id: 'opera', name: 'Opera', tag: 'La del crunch',
    desc: 'Obleas crocantes en capas con relleno sabor naranja. Se parten justo por la mitad, o eso dicen.',
    bg: ['#E9ECF1', '#AEB5C0'], ink: '#1B2A6B', script: true,
    layers: [
      { kind: 'cookie', sdf: operaOuter, H: .045, R: .018, relief: 'operaBack', wafer: true },
      { kind: 'fill', sdf: inset(operaOuter, .012), H: .026, color: '#FBE6BE', rough: .7, coat: 0, wobble: .006 },
      { kind: 'cookie', sdf: operaOuter, H: .045, R: .018, relief: 'operaBack', wafer: true },
      { kind: 'fill', sdf: inset(operaOuter, .012), H: .026, color: '#FBE6BE', rough: .7, coat: 0, wobble: .006 },
      { kind: 'cookie', sdf: operaOuter, H: .045, R: .018, relief: 'opera', wafer: true },
    ],
    dough: { base: '#F5DD98', edge: '#E8C46F', raised: '#F8E6AE', bottom: '#EFD185', rough: .82, sheen: .6, speckDark: '#D2A752', speckLight: '#FFF8E2' },
  },
  {
    id: 'merengadas', name: 'Merengadas', tag: 'La del merengue rosa',
    desc: 'Dos galletitas festoneadas y en el medio una nube de merengue rosa, alta y esponjosa.',
    bg: ['#4DB6EA', '#1C80C2'], ink: '#F7A6C8', script: true,
    layers: [
      { kind: 'cookie', sdf: merenOuter, H: .06, R: .05, relief: 'plainGold' },
      { kind: 'fill', sdf: inset(sdCircle.bind(null), 0), sdfFn: (x, y) => sdCircle(x, y, .9), H: .2, color: '#F59BC3', rough: .85, coat: 0, wobble: .05, foam: true },
      { kind: 'cookie', sdf: merenOuter, H: .06, R: .05, relief: 'merengadas' },
    ],
    dough: { base: '#EDBE6C', edge: '#D59A45', raised: '#F3CD82', bottom: '#DCA653', rough: .78, sheen: .45, speckDark: '#B5772C', speckLight: '#FFF0CC' },
  },
  {
    id: 'mellizas', name: 'Mellizas', tag: 'Las inseparables',
    desc: 'Dos tapitas doradas y festoneadas, unidas por una capa de crema blanca. Siempre de a dos.',
    bg: ['#E3202A', '#A50F17'], ink: '#FFD200', script: true,
    layers: [
      { kind: 'cookie', sdf: mellizasOuter, H: .065, R: .05, relief: 'plainGold' },
      { kind: 'fill', sdf: inset((x, y) => sdRoundRect(x, y, 1.18, .78, .14), .07), H: .05, color: '#FDF9EF', rough: .5, coat: .15, wobble: .02 },
      { kind: 'cookie', sdf: mellizasOuter, H: .065, R: .05, relief: 'mellizas' },
    ],
    dough: { base: '#ECC071', edge: '#D49A48', raised: '#F4D08A', bottom: '#DDA95A', rough: .78, sheen: .45, speckDark: '#B07530', speckLight: '#FFF1CF' },
  },
];
// la sdf de Merengadas usa la función directa
ALL_PRODUCTS[4].layers[1].sdf = ALL_PRODUCTS[4].layers[1].sdfFn;
// en la web van solo estas tres
const PRODUCTS = ['rumba', 'merengadas', 'mellizas'].map(id => ALL_PRODUCTS.find(p => p.id === id));

/* ---------- dibujos del relieve ---------- */
const RELIEFS = {
  sonrisas(ctx, P, S) {
    // guarda de garabatos ondulados cerca del borde, como en la galletita real
    ctx.lineWidth = S(.03);
    seedState = 11;
    for (let k = 0; k < 13; k++) {
      const a0 = k / 13 * Math.PI * 2 + rnd() * .2, len = .32 + rnd() * .12;
      ctx.beginPath();
      for (let s = 0; s <= 24; s++) {
        const a = a0 + len * s / 24, r = .8 + .035 * Math.sin(s * 1.3 + k);
        const [px, py] = P(Math.cos(a) * r, Math.sin(a) * r);
        s ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    // cachetes y cejas suaves
    ctx.lineWidth = S(.022);
    for (const sx of [-1, 1]) {
      ctx.beginPath(); const [cx, cy] = P(sx * .42, -.08); ctx.arc(cx, cy, S(.06), 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); const [bx, by] = P(sx * .27, .4); ctx.ellipse(bx, by, S(.1), S(.03), sx * .2, Math.PI, 0); ctx.stroke();
    }
  },
  sonrisasBack(ctx, P, S) { ctx.lineWidth = S(.02); const [cx, cy] = P(0, 0); ctx.beginPath(); ctx.arc(cx, cy, S(.84), 0, 6.283); ctx.stroke(); },
  rumba(ctx, P, S) {
    // guarda de rayitas siguiendo el contorno
    dashedRoundRect(ctx, P, S, .84, .69, .1, .07, .045, .032);
    // marco central
    ctx.lineWidth = S(.028);
    const [fx, fy] = P(-.5, .42); ctx.beginPath(); ctx.roundRect(fx, fy, S(1), S(.84), S(.08)); ctx.stroke();
    // personaje: cara con cejas, nariz y sonrisa (los ojos son agujeros)
    ctx.lineWidth = S(.03);
    ctx.beginPath(); let [x1, y1] = P(-.22, .24); let [x2, y2] = P(-.04, .2); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath(); [x1, y1] = P(.22, .24); [x2, y2] = P(.04, .2); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath(); const [mx, my] = P(0, -.02); ctx.arc(mx, my, S(.16), .2, Math.PI - .2); ctx.stroke();
    ctx.beginPath(); [x1, y1] = P(0, .06); [x2, y2] = P(-.03, -.02); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    // brazos y piernas de la figura que baila
    ctx.lineWidth = S(.026);
    const lines = [[-.36, -.2, -.2, -.34], [.36, -.2, .2, -.34], [-.2, -.34, -.3, -.32], [.2, -.34, .32, -.3]];
    for (const [a, b, c, d] of lines) { ctx.beginPath(); [x1, y1] = P(a, b); [x2, y2] = P(c, d); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  },
  plainChoco(ctx, P, S) { dashedRoundRect(ctx, P, S, .84, .69, .1, .07, .045, .02); },
  chocolinas(ctx, P, S) {
    dashedRoundRect(ctx, P, S, 1.1, .46, .06, .05, .035, .026);
    // filigrana de hojitas y espirales
    ctx.lineWidth = S(.018);
    for (let gx = -.9; gx <= .91; gx += .3) for (let gy = -.2; gy <= .21; gy += .4) {
      const flip = Math.round((gx + gy) * 10) % 2 ? 1 : -1;
      const [cx, cy] = P(gx, gy);
      ctx.beginPath(); ctx.arc(cx, cy, S(.07), 0, Math.PI * 1.5 * flip, flip < 0); ctx.stroke();
      for (const a of [0, 2.1, 4.2]) {
        const [lx, ly] = P(gx + Math.cos(a) * .1, gy + Math.sin(a) * .1);
        ctx.beginPath(); ctx.ellipse(lx, ly, S(.045), S(.018), -a, 0, 6.283); ctx.fill();
      }
    }
    ctx.font = `400 ${S(.2)}px Yellowtail`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  },
  opera(ctx, P, S) {
    // cuadriculado de oblea
    ctx.lineWidth = S(.02);
    for (let x = -1.32; x <= 1.33; x += .11) { ctx.beginPath(); const [a, b] = P(x, .6); const [c, d] = P(x, -.6); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
    for (let y = -.6; y <= .61; y += .11) { ctx.beginPath(); const [a, b] = P(-1.33, y); const [c, d] = P(1.33, y); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
    // escudo ovalado con el nombre, liso adentro
    const [cx, cy] = P(0, 0);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(cx, cy, S(.42), S(.24), 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.lineWidth = S(.035); ctx.beginPath(); ctx.ellipse(cx, cy, S(.42), S(.24), 0, 0, 6.283); ctx.stroke();
    ctx.font = `400 ${S(.26)}px Yellowtail`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Opera', cx, cy + S(.01));
  },
  operaBack(ctx, P, S) {
    ctx.lineWidth = S(.02);
    for (let x = -1.32; x <= 1.33; x += .11) { ctx.beginPath(); const [a, b] = P(x, .6); const [c, d] = P(x, -.6); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
    for (let y = -.6; y <= .61; y += .11) { ctx.beginPath(); const [a, b] = P(-1.33, y); const [c, d] = P(1.33, y); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
  },
  merengadas(ctx, P, S) {
    const [cx, cy] = P(0, 0);
    ctx.lineWidth = S(.026); ctx.beginPath(); ctx.arc(cx, cy, S(.8), 0, 6.283); ctx.stroke();
    for (let k = 0; k < 40; k++) { const a = k / 40 * 6.283; const [x, y] = P(Math.cos(a) * .72, Math.sin(a) * .72); ctx.beginPath(); ctx.arc(x, y, S(.02), 0, 6.283); ctx.fill(); }
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * 6.283; const [x, y] = P(Math.cos(a) * .32, Math.sin(a) * .32);
      ctx.beginPath(); ctx.ellipse(x, y, S(.17), S(.06), -a, 0, 6.283); ctx.fill();
    }
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, cy, S(.12), 0, 6.283); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.lineWidth = S(.03); ctx.beginPath(); ctx.arc(cx, cy, S(.12), 0, 6.283); ctx.stroke();
  },
  plainGold(ctx, P, S) { const [cx, cy] = P(0, 0); ctx.lineWidth = S(.02); ctx.globalAlpha = .5; ctx.beginPath(); ctx.arc(cx, cy, S(.5), 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; },
  mellizas(ctx, P, S) {
    dashedRoundRect(ctx, P, S, 1.02, .62, .1, .02, .045, .04);
    ctx.lineWidth = S(.026);
    const [x0, y0] = P(-.86, .46); ctx.beginPath(); ctx.roundRect(x0, y0, S(1.72), S(.92), S(.1)); ctx.stroke();
    const [cx, cy] = P(0, -.02);
    ctx.font = `400 ${S(.42)}px Yellowtail`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.12); ctx.fillText('Mellizas', 0, 0); ctx.restore();
  },
};

/* ================================================================
   Armado de cada galletita (capas, materiales, mordiscos)
   ================================================================ */
const RES = matchMedia('(max-width: 760px)').matches ? 120 : 180;

class Cookie {
  constructor(spec) {
    this.spec = spec;
    this.root = new THREE.Group();
    this.inner = new THREE.Group();
    this.root.add(this.inner);
    this.bites = [];
    this.explode = 0;
    this.layers = [];
    const d = spec.dough;
    const ext = .12;
    let bx = 0, by = 0;
    for (let x = -1.6; x <= 1.6; x += .02) for (let y = -1.2; y <= 1.2; y += .02) if (spec.layers[0].sdf(x, y) < 0) { bx = Math.max(bx, Math.abs(x)); by = Math.max(by, Math.abs(y)); }
    this.bounds = [-bx - ext, bx + ext, -by - ext, by + ext];
    this.reliefCache = {};
    this.speck = makeSpeckle(spec.id.length * 977 + 3, d.speckDark, d.speckLight);
    this.matsByRelief = {};

    let z = 0; const zs = [];
    for (const L of spec.layers) { const t = L.H * 2; zs.push(z + t / 2); z += t; }
    const total = z;
    spec.layers.forEach((L, i) => {
      const layer = { spec: L, baseZ: zs[i] - total / 2, meshes: [] };
      if (L.kind === 'cookie') {
        const relief = this.getRelief(L.relief);
        const flat = this.getRelief(L.wafer ? 'operaBack' : 'none');
        layer.relief = relief; layer.flat = flat;
        layer.topMat = this.cookieMat(relief, L.wafer ? .55 : .9);
        layer.botMat = this.cookieMat(flat, L.wafer ? .55 : .9);
      } else {
        layer.mat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff, roughness: L.rough, clearcoat: L.coat, clearcoatRoughness: .25,
          sheen: L.foam ? .8 : .2, sheenColor: C('#ffffff'), sheenRoughness: .6,
          normalMap: L.foam ? this.foamNormal() : null, normalScale: new THREE.Vector2(.9, .9),
        });
      }
      this.layers.push(layer);
    });
    this.rebuild();
  }
  getRelief(name) {
    if (!this.reliefCache[name]) {
      const draw = RELIEFS[name] || (() => {});
      this.reliefCache[name] = makeRelief(this.bounds, draw);
    }
    return this.reliefCache[name];
  }
  foamNormal() {
    const r = makeRelief(this.bounds, (ctx, P, S) => {
      seedState = 77;
      for (let i = 0; i < 2600; i++) { const x = (rnd() * 2 - 1) * 1.1, y = (rnd() * 2 - 1) * 1.1; const [px, py] = P(x, y); ctx.globalAlpha = .3 + rnd() * .7; ctx.beginPath(); ctx.arc(px, py, S(.008 + rnd() * .02), 0, 6.283); ctx.fill(); }
    }, 1024, 1.2);
    return makeNormalMap(r, 2.2, .2, 18);
  }
  cookieMat(relief, poreAmt) {
    const d = this.spec.dough;
    const key = relief === this.reliefCache.none ? 'flat' : Object.keys(this.reliefCache).find(k => this.reliefCache[k] === relief);
    if (this.matsByRelief[key + poreAmt]) return this.matsByRelief[key + poreAmt];
    const m = new THREE.MeshPhysicalMaterial({
      vertexColors: true, map: this.speck,
      normalMap: makeNormalMap(relief, 3.2, poreAmt * .45, 7), normalScale: new THREE.Vector2(1, 1),
      roughness: d.rough, sheen: d.sheen, sheenColor: C(d.speckLight), sheenRoughness: .8,
    });
    return (this.matsByRelief[key + poreAmt] = m);
  }
  currentSdf(base) {
    if (!this.bites.length) return base;
    const bites = this.bites;
    return (x, y) => {
      let m = Infinity;
      for (const b of bites) for (const t of b.teeth) m = Math.min(m, Math.hypot(x - t[0], y - t[1]) - t[2]);
      return Math.max(base(x, y), -m);
    };
  }
  rebuild() {
    const d = this.spec.dough;
    const base = C(d.base), edge = C(d.edge), raised = C(d.raised), bottom = C(d.bottom);
    const tmp = new THREE.Color();
    for (const layer of this.layers) {
      for (const m of layer.meshes) { m.geometry.dispose(); this.inner.remove(m); }
      layer.meshes = [];
      const L = layer.spec;
      const sdf = this.currentSdf(L.sdf);
      if (L.kind === 'cookie') {
        const R = L.R, H = L.H, rel = layer.relief;
        const prof = t => { const u = Math.min(t / R, 1); return Math.sqrt(1 - (1 - u) * (1 - u)); };
        const top = buildHalf(sdf, {
          bounds: this.bounds, res: RES, sign: 1,
          height: (x, y, t) => H * prof(t) + .028 * rel.sample(x, y) * smooth(R * .4, R * 1.6, t) + .006 * (fbm(x * 9, y * 9) - .5) + .012 * smooth(0, .9, t),
          color: (x, y, t) => {
            const ek = 1 - smooth(0, R * 3, t);
            tmp.copy(base).lerp(edge, ek * .9).lerp(raised, rel.sample(x, y) * .55);
            const n = .9 + .2 * fbm(x * 2.5 + 5, y * 2.5);
            return tmp.multiplyScalar(n).clone();
          },
        });
        const bot = buildHalf(sdf, {
          bounds: this.bounds, res: RES, sign: -1,
          height: (x, y, t) => H * prof(t) * .92 + .004 * (fbm(x * 7 + 3, y * 7) - .5),
          color: (x, y, t) => { const ek = 1 - smooth(0, R * 2, t); tmp.copy(bottom).lerp(edge, ek * .7); return tmp.multiplyScalar(.88 + .2 * fbm(x * 3, y * 3 + 9)).clone(); },
        });
        const mt = new THREE.Mesh(top, layer.topMat), mb = new THREE.Mesh(bot, layer.botMat);
        layer.meshes.push(mt, mb);
      } else {
        const H = L.H, w = L.wobble;
        const fs = (x, y) => sdf(x, y) - w * (fbm(x * 3 + 1, y * 3) - .45);
        const fc = C(L.color);
        const half = sign => buildHalf(fs, {
          bounds: this.bounds, res: Math.round(RES * .7), sign,
          height: (x, y, t) => { const u = Math.min(t / H, 1); return H * Math.sqrt(1 - (1 - u) * (1 - u)) + (L.foam ? .03 * fbm(x * 6, y * 6) * smooth(0, .1, t) : 0); },
          color: (x, y, t) => { tmp.copy(fc).multiplyScalar(.94 + .1 * fbm(x * 4, y * 4)); if (L.foam && hash(Math.round(x * 60), Math.round(y * 60)) > .965) tmp.set('#ffffff'); return tmp.clone(); },
        });
        layer.mat.vertexColors = true;
        layer.meshes.push(new THREE.Mesh(half(1), layer.mat), new THREE.Mesh(half(-1), layer.mat));
      }
      for (const m of layer.meshes) { m.castShadow = true; m.receiveShadow = true; this.inner.add(m); }
    }
    this.applyExplode();
  }
  applyExplode() {
    const n = this.layers.length, mid = (n - 1) / 2;
    this.layers.forEach((layer, i) => {
      const z = layer.baseZ + (i - mid) * this.explode * (n > 3 ? .28 : .5);
      for (const m of layer.meshes) m.position.z = z;
    });
  }
  setExplode(v) { this.explode = v; this.applyExplode(); }
  // mordisco: un arco grande + dientes chicos sobre su borde
  bite(lx, ly) {
    const top = this.layers[this.layers.length - 1].spec.sdf;
    const sdf = this.currentSdf(top);
    let dx = lx, dy = ly; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    let px = lx, py = ly;
    for (let i = 0; i < 300 && sdf(px, py) < 0; i++) { px += dx * .01; py += dy * .01; }
    const rb = .3 + Math.random() * .06;
    const cx = px + dx * rb * .45, cy = py + dy * rb * .45;
    const teeth = [[cx, cy, rb]];
    const ang = Math.atan2(-dy, -dx);
    for (let k = -3; k <= 3; k++) {
      const a = ang + k * .32;
      teeth.push([cx + Math.cos(a) * rb * .98, cy + Math.sin(a) * rb * .98, rb * (.14 + Math.random() * .05)]);
    }
    this.bites.push({ teeth });
    this.rebuild();
    return { x: px, y: py };
  }
  remaining() {
    const top = this.currentSdf(this.layers[this.layers.length - 1].spec.sdf), base = this.layers[this.layers.length - 1].spec.sdf;
    let a = 0, b = 0;
    for (let x = -1.5; x <= 1.5; x += .05) for (let y = -1.1; y <= 1.1; y += .05) { if (base(x, y) < 0) { b++; if (top(x, y) < 0) a++; } }
    return b ? a / b : 1;
  }
  resetBites() { this.bites = []; this.rebuild(); }
}


export { Cookie, PRODUCTS, C, clamp, lerp };
