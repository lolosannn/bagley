// Hero: Rumba 3D gigante que se deja morder, con Merengadas y Mellizas orbitando entre confetti.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Cookie, PRODUCTS, C } from './cookie3d.js';
import { sound } from './sound.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function initHero(canvas, { onProgress = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .6;

  const camera = new THREE.PerspectiveCamera(32, 1, .1, 100);
  camera.position.set(0, .2, 9);

  const key = new THREE.DirectionalLight(0xfff1dc, 2.6); key.position.set(3, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd6c0, 2); rim.position.set(-5, 3, -4); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a1a1a, .6));

  // ---- galletitas: se arman de a una para que el loader avance
  const byId = id => PRODUCTS.find(p => p.id === id);
  const build = async id => { const c = new Cookie(byId(id)); scene.add(c.root); onProgress(); await new Promise(r => setTimeout(r, 0)); return c; };
  const main = await build('rumba');
  const sides = [await build('merengadas'), await build('mellizas')];

  // ---- confetti 3D
  const COLORS = ['#FFD200', '#FFFFFF', '#5DBB46', '#1B9DD9', '#F27FB2', '#FFD200'];
  const N = innerWidth < 760 ? 70 : 140;
  const conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(.09, .2), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: .5, metalness: .1 }), N);
  const confData = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    confData.push({ x: (Math.random() - .5) * 14, y: (Math.random() - .5) * 9, z: -4 + Math.random() * 7, vy: .25 + Math.random() * .5, r: Math.random() * 6, vr: (Math.random() - .5) * 4, s: .6 + Math.random() * .8 });
    conf.setColorAt(i, C(COLORS[i % COLORS.length]));
  }
  scene.add(conf);

  // ---- migas
  const CR = 200;
  const crumbMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: .9 }), CR);
  crumbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const crumbs = Array.from({ length: CR }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), s: 0 }));
  for (let i = 0; i < CR; i++) crumbMesh.setColorAt(i, new THREE.Color());
  scene.add(crumbMesh);
  let head = 0;
  function emitCrumbs(world, color, n = 30) {
    const c = C(color);
    for (let k = 0; k < n; k++) {
      const cr = crumbs[head]; crumbMesh.setColorAt(head, c.clone().multiplyScalar(.8 + Math.random() * .4)); head = (head + 1) % CR;
      cr.life = 2.5 + Math.random();
      cr.p.copy(world);
      cr.v.set((Math.random() - .5) * 4, Math.random() * 3.5, 1 + Math.random() * 2);
      cr.s = .015 + Math.random() ** 2 * .06;
    }
    crumbMesh.instanceColor.needsUpdate = true;
  }

  // ---- interacción
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const spin = { yaw: 0, v: 0 };
  let down = null, bites = 0, progress = 0, visible = true;
  const counter = document.getElementById('bite-count');
  addEventListener('pointermove', e => { mouse.tx = e.clientX / innerWidth * 2 - 1; mouse.ty = e.clientY / innerHeight * 2 - 1; });
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, lx: e.clientX, moved: 0 }; });
  addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down.lx; down.lx = e.clientX; down.moved += Math.abs(dx);
    if (down.moved > 6) { spin.v = dx * .01; spin.yaw += dx * .01; }
  });
  addEventListener('pointerup', e => { if (down && down.moved < 6 && e.target === canvas) bite(e); down = null; });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function bite(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const all = [main, ...sides];
    const hit = ray.intersectObjects(all.map(c => c.inner), true)[0];
    if (!hit) return;
    const ck = all.find(c => c.inner.children.includes(hit.object));
    const local = ck.inner.worldToLocal(hit.point.clone());
    const edge = ck.bite(local.x, local.y);
    emitCrumbs(ck.inner.localToWorld(new THREE.Vector3(edge.x, edge.y, 0)), ck.spec.dough.edge);
    sound.crunch();
    bites++;
    const left = ck.remaining();
    if (left < .15) {
      ck.pop = 1;
      setTimeout(() => { ck.resetBites(); ck.pop = 0; ck.root.scale.setScalar(.001); }, 380);
      counter.textContent = '¡Te la comiste toda! Ahí va otra';
    } else {
      counter.textContent = `${bites} ${bites === 1 ? 'mordisco' : 'mordiscos'} · queda ${Math.round(left * 100)}%`;
    }
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 760 ? 44 : 32;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  const clock = new THREE.Clock();
  const mobile = () => innerWidth < 760;
  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 1 / 30), t = clock.elapsedTime;
    mouse.x += (mouse.tx - mouse.x) * .06; mouse.y += (mouse.ty - mouse.y) * .06;
    if (!down) { spin.v *= .95; spin.yaw += spin.v; spin.yaw *= .985; }
    const m = mobile();

    // principal
    const s0 = (m ? .95 : 1.25);
    const grow = main.pop ? .001 : 1;
    const cur = main.root.scale.x; main.root.scale.setScalar(cur + (s0 * grow - cur) * (main.pop ? .3 : .08));
    main.root.position.set(mouse.x * .15, (m ? -1.1 : -1.25) + Math.sin(t * 1.2) * .08 + progress * 2.5, 0);
    main.root.rotation.set(-.42 + mouse.y * .25 + progress * 1.2, mouse.x * .5 + spin.yaw + (reduce ? 0 : Math.sin(t * .5) * .15), mouse.x * -.08);

    // orbitan
    sides.forEach((c, i) => {
      const a = t * (reduce ? 0 : .25) + i * Math.PI;
      const ss = (m ? .55 : .7);
      const g = c.pop ? .001 : 1; const cs = c.root.scale.x; c.root.scale.setScalar(cs + (ss * g - cs) * (c.pop ? .3 : .06));
      c.root.position.set(Math.cos(a) * (m ? 2 : 3.6) - mouse.x * .4, -1.1 + Math.sin(a * 2) * .5 + progress * 3.5, Math.sin(a) * 1.6 - 1);
      c.root.rotation.set(-.6 + Math.sin(t + i) * .2, a * 1.5, .3 * Math.sin(t * .7 + i));
    });

    // confetti
    for (let i = 0; i < N; i++) {
      const d = confData[i];
      if (!reduce) { d.y -= d.vy * dt; d.r += d.vr * dt; }
      if (d.y < -5) { d.y = 5; d.x = (Math.random() - .5) * 14; }
      dummy.position.set(d.x + Math.sin(t + i) * .2 - mouse.x * (d.z + 4) * .08, d.y + progress * 4, d.z);
      dummy.rotation.set(d.r, d.r * .7, d.r * .3);
      dummy.scale.setScalar(d.s);
      dummy.updateMatrix(); conf.setMatrixAt(i, dummy.matrix);
    }
    conf.instanceMatrix.needsUpdate = true;

    // migas
    for (let i = 0; i < CR; i++) {
      const cr = crumbs[i];
      if (cr.life > 0) {
        cr.life -= dt; cr.v.y -= 9.8 * dt; cr.p.addScaledVector(cr.v, dt);
        cr.r.x += dt * 8; cr.r.y += dt * 6;
        dummy.position.copy(cr.p); dummy.rotation.copy(cr.r); dummy.scale.setScalar(cr.s * Math.min(1, cr.life));
      } else dummy.scale.setScalar(0);
      dummy.updateMatrix(); crumbMesh.setMatrixAt(i, dummy.matrix);
    }
    crumbMesh.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
  }
  frame();

  return {
    setProgress(p) { progress = p; visible = p < 1; },
  };
}
