import * as THREE from 'three';
import { createEnv, NIGHT_T } from './env.js';
import { createSky } from './sky.js';
import { createTerrain, heightAt, CAM_Z } from './terrain.js';
import { createGrass } from './grass.js';
import { createProps } from './props.js';
import { createFireflies } from './fireflies.js';
import { createCats, CATS_TOTAL } from './cats.js';
import { createTornado, TORNADO_LEN } from './tornado.js';
import { createFinale } from './finale.js';
import { loadPhotos } from './photos.js';
import { clamp, lerp, smooth } from './noise.js';

// ---------------------------------------------------------------------------
// Guion: todo es función del tiempo T (segundos desde que arranca la historia).
// ---------------------------------------------------------------------------
const TL = {
  // [empieza a aparecer, ya visible, empieza a irse, ya no está]
  b1: [1.0, 3.2, 7.4, 9.6],
  b2a: [10.8, 12.8, 22.4, 24.4],
  b2b: [14.6, 17.0, 22.4, 24.4],
  blackout: [25.5, 29.5],     // el negro se disuelve y aparece la noche
  moon: [32.0, 37.0],         // el texto sale por detrás de la luna
  moonOut: [46.0, 48.0],
  lookDown: [47.0, 53.0],     // la cámara baja hacia el campo
  cats: 50.5,                 // entran los gatitos
  scroll1: [70.0, 74.8],      // la página baja hacia el tornado
  tornado: 73.0,
  scroll2: [113.5, 118.0],    // y luego hacia el final
  finalLines: [119.0, 124.0, 129.0],
  heart: 133.5,
  replay: 138.0,
};

const seg = (T, a, b) => clamp((T - a) / (b - a), 0, 1);
const easeIO = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const window4 = (T, [a, b, c, d]) => smooth(a, b, T) * (1 - smooth(c, d, T));

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- pantalla de carga negra ----
const loader = {
  root: $('loader'), bar: $('lbar'), step: $('lstep'),
  progress(p, label) { this.bar.style.transform = `scaleX(${clamp(p, 0, 1)})`; if (label) this.step.textContent = label; },
  finish() { this.root.classList.add('done'); return wait(950).then(() => this.root.remove()); },
  fail(msg) { this.root.classList.add('failed'); this.step.textContent = msg; },
};

// ---- texto del DOM que aparece y desaparece con desenfoque suave ----
function showText(el, e, rise = 10) {
  e = Math.round(clamp(e, 0, 1) * 500) / 500;
  if (el._e === e) return;
  el._e = e;
  el.style.opacity = String(e);
  el.style.filter = e >= 1 ? 'none' : `blur(${((1 - e) * 8).toFixed(1)}px)`;
  el.style.transform = e >= 1 ? 'none' : `translateY(${((1 - e) * rise).toFixed(1)}px)`;
  el.style.letterSpacing = `${(0.01 + (1 - e) * 0.05).toFixed(3)}em`;
}

async function boot() {
  const isMobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

  loader.progress(0.05, 'un momento…');
  await wait(30);
  await Promise.all([
    document.fonts.load('italic 400 64px "Cormorant Garamond"'),
    document.fonts.load('italic 300 64px "Cormorant Garamond"'),
    document.fonts.load('italic 500 64px "Cormorant Garamond"'),
    document.fonts.load('700 64px "Pixelify Sans"'),
  ]).catch(() => {});

  const host = $('app');
  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000);
  renderer.autoClear = false;
  host.insertBefore(renderer.domElement, host.firstChild);

  // ---------------- escena 1: la noche en el campo ----------------
  const env = createEnv();
  const night = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(55, 1, 0.1, 4000), i: 0 };
  night.camera.rotation.order = 'YXZ';
  night.scene.fog = new THREE.FogExp2(env.fog, env.u.uFogDensity.value);
  night.scene.add(env.lights.sun, env.lights.moon, env.lights.hemi);
  env.update(NIGHT_T, 0);

  loader.progress(0.15);
  await wait(20);
  const sky = createSky(env, pixelRatio);
  night.scene.add(sky.group);
  night.scene.add(createTerrain(env));

  loader.progress(0.35);
  await wait(20);
  night.scene.add(createGrass(env, isMobile ? { count: 40000, flowers: 450 } : { count: 100000, flowers: 1000 }).group);
  const props = createProps(night.scene);
  const fireflies = createFireflies(env, isMobile ? 70 : 150, pixelRatio);
  night.scene.add(fireflies.points);

  loader.progress(0.55);
  await wait(20);
  const cats = createCats(night.scene);

  // ---------------- escena 2: el tornado de fotos ----------------
  loader.progress(0.7);
  const photos = await loadPhotos();
  const tornado = { ...createTornado(photos, pixelRatio), i: 1 };

  // ---------------- escena 3: el final ----------------
  const finale = { ...createFinale(pixelRatio), i: 2 };
  const sections = [night, tornado, finale];

  // ---------------- tamaño ----------------
  let W = 1, H = 1;
  function resize() {
    W = Math.max(1, host.clientWidth); H = Math.max(1, host.clientHeight);
    renderer.setSize(W, H, false);
    const aspect = W / H;
    night.camera.aspect = aspect;
    night.camera.fov = aspect < 1 ? lerp(55, 84, clamp((1 - aspect) / 0.6, 0, 1)) : 55;
    night.camera.updateProjectionMatrix();
    cats.layout(aspect, night.camera.fov);
    tornado.layout(aspect);
    finale.layout(aspect);
  }
  resize();
  new ResizeObserver(resize).observe(host);

  // Cada sección ocupa una pantalla; S dice cuánto se ha desplazado la página (0, 1 o 2).
  function renderSections(S) {
    renderer.setScissorTest(true);
    for (const sec of sections) {
      const top = (sec.i - S) * H;
      if (top >= H || top + H <= 0) continue;
      const vTop = Math.max(0, top), vBot = Math.min(H, top + H);
      renderer.setViewport(0, -top, W, H);
      renderer.setScissor(0, H - vBot, W, vBot - vTop);
      renderer.clear();
      renderer.render(sec.scene, sec.camera);
    }
    renderer.setScissorTest(false);
  }

  // ---------------- cámara de la noche ----------------
  const view = { yaw: -0.19, pitch: 0.28 };
  function directNight(T, dt, time) {
    const k = 1 - Math.exp(-dt * 5);
    const look = easeIO(seg(T, TL.lookDown[0], TL.lookDown[1]));
    view.yaw += (lerp(-0.19, -0.04, look) - view.yaw) * k;
    view.pitch += (lerp(0.28, -0.25, look) - view.pitch) * k;
    const cx = Math.sin(time * 0.11) * 0.4;
    night.camera.position.set(cx, heightAt(cx, CAM_Z) + 1.95 + Math.sin(time * 0.17) * 0.06, CAM_Z);
    night.camera.rotation.set(view.pitch, -view.yaw, Math.sin(time * 0.13) * 0.004);
  }

  // ---------------- estado de la historia ----------------
  let T = Math.max(0, parseFloat(params.get('at')) || 0);
  const still = params.has('still');
  let time = 0;
  let lastS = -1;
  const els = {
    blackout: $('blackout'), b1: $('b1'), b2a: $('b2a'), b2b: $('b2b'),
    f: [$('f1'), $('f2'), $('f3')], heart: $('fheart'), replay: $('replay'), app: host,
  };
  els.replay.addEventListener('click', () => { T = 0; time = 0; els.replay.classList.remove('on'); els.heart.classList.remove('on'); });

  function applyStory(dt) {
    // Negro y frases
    const black = 1 - smooth(TL.blackout[0], TL.blackout[1], T);
    els.blackout.style.opacity = black.toFixed(3);
    els.blackout.hidden = black <= 0.001;
    showText(els.b1, window4(T, TL.b1));
    showText(els.b2a, window4(T, TL.b2a));
    showText(els.b2b, window4(T, TL.b2b));

    // Desplazamiento de la página
    const S = easeIO(seg(T, TL.scroll1[0], TL.scroll1[1])) + easeIO(seg(T, TL.scroll2[0], TL.scroll2[1]));
    if (S !== lastS) { els.app.style.setProperty('--s', S.toFixed(4)); lastS = S; }

    // Mensaje final
    TL.finalLines.forEach((t0, i) => showText(els.f[i], smooth(t0, t0 + 2.6, T), 14));
    const heartE = smooth(TL.heart, TL.heart + 2, T);
    els.heart.style.opacity = heartE.toFixed(3);
    els.heart.classList.toggle('on', heartE > 0.99);
    els.replay.classList.toggle('on', T > TL.replay);

    // Escena de la noche (con el texto de la luna y los gatitos)
    if (S < 1 && black < 0.999) {
      env.update(NIGHT_T + Math.min(T, 120) * 0.0004, time);
      night.scene.fog.color.copy(env.fog);
      props.update(dt);
      directNight(T, dt, time);
      sky.moonText.reveal = seg(T, TL.moon[0], TL.moon[1]);
      sky.moonText.alpha = 1 - smooth(TL.moonOut[0], TL.moonOut[1], T);
      sky.update(night.camera);
      cats.update(T - TL.cats, time);
    }
    if (S > 0 && S < 2) tornado.update(T - TL.tornado, time, dt);
    if (S > 1) finale.update(time);
    return { S, black };
  }

  // ---- precarga de GPU: se dibuja cada escena una vez antes de empezar ----
  loader.progress(0.85);
  await wait(20);
  applyStory(0.016);
  tornado.update(8, 0, 0.016);
  finale.update(0);
  for (const s of [night, tornado, finale]) {
    if (renderer.compileAsync) await renderer.compileAsync(s.scene, s.camera);
  }
  cats.update(9, 0);
  for (let i = 0; i < 3; i++) renderSections(i);
  night.scene.fog.color.copy(env.fog);

  loader.progress(1);
  await wait(400);
  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    time += dt;
    if (!still) T += dt;
    const { S, black } = applyStory(dt);
    if (black < 0.999 || S > 0.0001) renderSections(S);
    requestAnimationFrame(frame);
  }
  clock.start();
  requestAnimationFrame(frame);
  await loader.finish();

  // Para pruebas: saltar a un instante de la historia.
  window.story = { get T() { return T; }, set T(v) { T = v; }, TL, CATS_TOTAL, TORNADO_LEN };
  document.documentElement.dataset.ready = '1';
}

boot().catch((err) => {
  console.error(err);
  const noGL = /webgl/i.test(String(err && err.message));
  loader.fail(noGL ? 'Tu navegador no pudo iniciar WebGL. Prueba con Chrome, Edge, Firefox o Safari actualizados.' : 'Algo falló al preparar la escena. Recarga la página.');
});
