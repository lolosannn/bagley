// Sonidos sintetizados con WebAudio: nada de archivos. Apagados hasta que el visitante los activa.
let ctx = null, on = false;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function noiseBurst(t0, dur, freq, q, gain) {
  const a = ac(), len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t0);
}
function tone(t0, f0, f1, dur, gain, type = 'sine') {
  const a = ac(), o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur);
}

export const sound = {
  get on() { return on; },
  toggle() { on = !on; if (on) { ac(); this.pop(); } return on; },
  crunch() {
    if (!on) return; const t = ac().currentTime;
    for (let i = 0; i < 5; i++) noiseBurst(t + i * .035 + Math.random() * .02, .06, 1800 + Math.random() * 2500, 1.2, .5);
  },
  crack() {
    if (!on) return; const t = ac().currentTime;
    noiseBurst(t, .12, 2600, .8, .9); noiseBurst(t + .05, .2, 900, .7, .5);
  },
  plop() { if (!on) return; tone(ac().currentTime, 520, 140, .18, .35); },
  pop() { if (!on) return; tone(ac().currentTime, 300, 900, .12, .2, 'triangle'); },
  paper() { if (!on) return; const t = ac().currentTime; noiseBurst(t, .25, 4000, .5, .25); },
  rattle() { if (!on) return; const t = ac().currentTime; for (let i = 0; i < 6; i++) noiseBurst(t + i * .03, .03, 1200 + Math.random() * 800, 2, .25); },
};
