// Armá tu Surtido: paquete dibujado en canvas, con tus galletitas, tu nombre y tu estampado. Se descarga como PNG.
import { sound } from './sound.js';

const NAMES = ['Lorenzo', 'Mica', 'Tincho', 'La abuela', 'Profe Ana', 'Juli', 'El Colo', 'Sofi'];

export function initSurtido(canvas, form, base = 'assets/fotos/') {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const imgs = {};
  let pending = 0;
  for (const k of ['rumba', 'merengadas', 'mellizas']) {
    const i = new Image(); i.src = base + k + '-entera.webp'; pending++;
    i.onload = () => { imgs[k] = i; if (--pending === 0) draw(); };
  }

  const state = () => {
    const f = new FormData(form);
    return { name: (f.get('name') || '').toString().trim(), cookies: f.getAll('cookies'), color: f.get('color'), pattern: f.get('pattern') };
  };
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  };
  // silueta del paquete: almohadilla con bordes sellados
  function bagPath(c) {
    const x0 = 90, x1 = W - 90, y0 = 110, y1 = H - 110, b = 34;
    c.beginPath();
    c.moveTo(x0, y0);
    c.bezierCurveTo(W * .35, y0 - 14, W * .65, y0 - 14, x1, y0);
    c.bezierCurveTo(x1 + b, H * .35, x1 + b, H * .65, x1, y1);
    c.bezierCurveTo(W * .65, y1 + 14, W * .35, y1 + 14, x0, y1);
    c.bezierCurveTo(x0 - b, H * .65, x0 - b, H * .35, x0, y0);
    c.closePath();
  }
  function crimp(c, y, color) {
    c.fillStyle = color;
    c.fillRect(70, y - 34, W - 140, 68);
    c.fillStyle = 'rgba(0,0,0,.12)';
    for (let x = 74; x < W - 74; x += 16) c.fillRect(x, y - 34, 6, 68);
  }
  function pattern(c, kind, base) {
    let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const cols = ['#FFFFFF', '#E3202A', '#5DBB46', '#1B9DD9', '#F27FB2'].filter(x => x.toLowerCase() !== base.toLowerCase());
    c.save(); c.globalAlpha = .28;
    if (kind === 'confetti') for (let i = 0; i < 160; i++) {
      c.save(); c.translate(rnd() * W, rnd() * H); c.rotate(rnd() * 6); c.fillStyle = cols[i % cols.length];
      rnd() < .5 ? c.fillRect(-10, -4, 20, 8) : (c.beginPath(), c.arc(0, 0, 6, 0, 6.283), c.fill()); c.restore();
    }
    if (kind === 'globos') for (let i = 0; i < 18; i++) {
      const x = rnd() * W, y = rnd() * H; c.fillStyle = cols[i % cols.length];
      c.beginPath(); c.ellipse(x, y, 34, 42, 0, 0, 6.283); c.fill();
      c.strokeStyle = c.fillStyle; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y + 42); c.quadraticCurveTo(x + 14, y + 80, x - 4, y + 110); c.stroke();
    }
    if (kind === 'banderines') for (let row = 0; row < 5; row++) {
      const y = 220 + row * 210;
      c.strokeStyle = '#FFFFFF'; c.lineWidth = 3; c.beginPath(); c.moveTo(60, y); c.quadraticCurveTo(W / 2, y + 50, W - 60, y); c.stroke();
      for (let i = 0; i < 12; i++) {
        const x = 90 + i * 72, yy = y + Math.sin(i / 11 * Math.PI) * 25;
        c.fillStyle = cols[(i + row) % cols.length]; c.beginPath(); c.moveTo(x, yy); c.lineTo(x + 52, yy); c.lineTo(x + 26, yy + 56); c.fill();
      }
    }
    c.restore();
  }
  function logo(c, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s); c.translate(-120, -90);
    const p1 = new Path2D('M16 44 C56 22 96 22 120 38 C144 22 184 22 224 44 L218 150 C184 134 150 136 120 156 C90 136 56 134 22 150 Z');
    const p2 = new Path2D('M16 36 C56 14 96 14 120 30 C144 14 184 14 224 36 L218 142 C184 126 150 128 120 148 C90 128 56 126 22 142 Z');
    c.lineJoin = 'round'; c.lineWidth = 6; c.strokeStyle = '#FFD200';
    c.save(); c.translate(0, 6); c.fillStyle = '#8E0E14'; c.fill(p1); c.stroke(p1); c.restore();
    c.fillStyle = '#E3202A'; c.fill(p2); c.stroke(p2);
    c.save(); c.translate(122, 96); c.rotate(-7 * Math.PI / 180);
    c.fillStyle = '#fff'; c.font = '66px Yellowtail'; c.textAlign = 'center'; c.fillText('Bagley', 0, 8);
    c.restore(); c.restore();
  }
  function outlined(c, text, x, y, size, fill, stroke, font = 'Londrina Solid', weight = 900) {
    c.font = `${weight} ${size}px "${font}"`; c.textAlign = 'center'; c.lineJoin = 'round';
    c.lineWidth = size * .16; c.strokeStyle = stroke; c.strokeText(text, x, y);
    c.fillStyle = fill; c.fillText(text, x, y);
  }

  function draw() {
    const st = state();
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    bagPath(ctx); ctx.clip();
    // fondo + volumen de almohadilla
    ctx.fillStyle = st.color; ctx.fillRect(0, 0, W, H);
    pattern(ctx, st.pattern, st.color);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(.18, 'rgba(0,0,0,0)'); g.addColorStop(.42, 'rgba(255,255,255,.22)'); g.addColorStop(.6, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.32)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // galletitas elegidas
    const list = st.cookies.filter(k => imgs[k]);
    const spots = [[.3, .66, -14], [.7, .64, 12], [.5, .8, -4]];
    list.forEach((k, i) => {
      const im = imgs[k], [sx, sy, r] = spots[i % 3], w = W * (list.length === 1 ? .62 : .42);
      ctx.save(); ctx.translate(W * (list.length === 1 ? .5 : sx), H * (list.length === 1 ? .7 : sy)); ctx.rotate(r * Math.PI / 180);
      ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 16;
      ctx.drawImage(im, -w / 2, -w / 2 * im.height / im.width, w, w * im.height / im.width); ctx.restore();
    });

    logo(ctx, W / 2, 300, 1.25);
    outlined(ctx, 'SURTIDO', W / 2, 560, 190, '#E3202A', '#FFFFFF');
    ctx.save(); ctx.translate(W / 2, 640); ctx.rotate(-.05);
    outlined(ctx, st.name ? 'de ' + st.name : 'para compartir', 0, 0, 84, '#3A1A0F', st.color === '#FFD200' ? '#FFFFFF' : '#FFD200', 'Yellowtail', 400);
    ctx.restore();
    // sello de 160 años
    ctx.save(); ctx.translate(W - 210, 820); ctx.rotate(.18);
    ctx.fillStyle = '#FFD200'; ctx.strokeStyle = '#E3202A'; ctx.lineWidth = 8;
    ctx.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283, r = i % 2 ? 78 : 92; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E3202A'; ctx.textAlign = 'center'; ctx.font = '900 62px "Londrina Solid"'; ctx.fillText('160', 0, 14); ctx.font = '900 24px Nunito'; ctx.fillText('AÑOS', 0, 44);
    ctx.restore();
    ctx.font = '800 22px Nunito'; ctx.fillStyle = 'rgba(58,26,15,.7)'; ctx.textAlign = 'left';
    ctx.fillText('EDICIÓN ÚNICA · NO SE VENDE · CONTENIDO: AMOR', 130, H - 160);
    ctx.restore();

    // sellos de arriba y abajo
    crimp(ctx, 110, shade(st.color, -.12));
    crimp(ctx, H - 110, shade(st.color, -.12));
    // brillo plástico
    ctx.save(); bagPath(ctx); ctx.clip();
    ctx.globalAlpha = .35; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(W * .28, H * .3, 40, 260, -.15, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  form.addEventListener('input', draw);
  form.addEventListener('submit', e => e.preventDefault());
  document.getElementById('bag-random').addEventListener('click', () => {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    form.querySelector('#bag-name').value = pick(NAMES);
    const radios = n => [...form.querySelectorAll(`input[name="${n}"]`)];
    pick(radios('color')).checked = true; pick(radios('pattern')).checked = true;
    const cs = radios('cookies'); cs.forEach(c => (c.checked = Math.random() > .35)); if (!cs.some(c => c.checked)) cs[0].checked = true;
    sound.rattle(); draw();
  });
  document.getElementById('bag-download').addEventListener('click', () => {
    canvas.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = `surtido-${(state().name || 'bagley').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  });

  // inclinar con el mouse y sacudir: suenan las galletitas
  const stage = canvas.parentElement;
  let lastX = 0, lastT = 0;
  stage.addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    canvas.style.transform = `rotateY(${x * 22}deg) rotateX(${-y * 14}deg)`;
    const now = performance.now(), v = Math.abs(e.clientX - lastX) / Math.max(1, now - lastT);
    if (v > 2.2 && now - (stage._rat || 0) > 180) { stage._rat = now; sound.rattle(); canvas.animate([{ translate: '0 0' }, { translate: '6px -4px' }, { translate: '-6px 3px' }, { translate: '0 0' }], { duration: 180 }); }
    lastX = e.clientX; lastT = now;
  });
  stage.addEventListener('pointerleave', () => { canvas.style.transform = ''; });

  document.fonts.ready.then(draw);
  draw();
}
