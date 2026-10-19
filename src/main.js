import * as THREE from 'three';
import { createEnv } from './env.js';
import { createSky } from './sky.js';
import { createTerrain, heightAt, CAM_Z } from './terrain.js';
import { createGrass } from './grass.js';
import { createProps } from './props.js';
import { createBirds, createFireflies } from './life.js';
import { createLoader } from './loader.js';
import { createUI } from './ui.js';
import { clamp, lerp, smooth } from './noise.js';

const DURATION = 90;           // segundos que tarda el atardecer en volverse noche
const MIN_LOADER_MS = 2600;    // para que se vean los pajaritos aunque cargue rápido

const params = new URLSearchParams(location.search);
const loader = createLoader();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function boot() {
  const started = performance.now();
  const isMobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

  loader.progress(0.04, 'Despertando al sol…');
  await wait(30);

  const host = document.getElementById('app');
  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x0b1030);
  host.insertBefore(renderer.domElement, host.firstChild);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 4000);
  camera.rotation.order = 'YXZ';

  const env = createEnv();
  scene.fog = new THREE.FogExp2(env.fog, env.u.uFogDensity.value);
  scene.add(env.lights.sun, env.lights.moon, env.lights.hemi);

  loader.progress(0.12, 'Pintando el cielo…');
  await wait(30);
  const sky = createSky(env, pixelRatio);
  scene.add(sky.group);

  loader.progress(0.28, 'Moldeando las colinas…');
  await wait(30);
  scene.add(createTerrain(env));

  loader.progress(0.45, 'Plantando la hierba…');
  await wait(30);
  const grass = createGrass(env, isMobile ? { count: 40000, flowers: 450 } : { count: 100000, flowers: 1000 });
  scene.add(grass.group);

  loader.progress(0.65, 'Levantando el molino…');
  await wait(30);
  const props = createProps(scene);

  loader.progress(0.78, 'Llamando a los pájaros…');
  await wait(30);
  const birds = createBirds(env);
  scene.add(birds.group);
  const fireflies = createFireflies(env, isMobile ? 70 : 150, pixelRatio);
  scene.add(fireflies.points);

  // ---- estado de la animación ----
  let t = clamp(parseFloat(params.get('t')) || 0, 0, 1);
  let playing = !params.has('still');
  let scrubbing = false;
  let time = 0;

  const user = { yaw: 0, pitch: 0 };
  const view = { yaw: 0.22, pitch: 0.07, fov: 55 };
  let zoom = 1;
  const pointer = { x: 0, y: 0 };

  const ui = createUI({
    onToggle() {
      if (t >= 1) { t = 0; playing = true; } else playing = !playing;
    },
    onRestart() { t = 0; playing = true; },
    onNudge(d) { t = clamp(t + d, 0, 1); },
    onScrubStart() { scrubbing = true; },
    onScrubEnd() { scrubbing = false; if (t >= 1) playing = false; },
    onScrub(v) { t = v; },
  });

  // ---- cámara: guion automático + mirada libre con el puntero ----
  const dom = renderer.domElement;
  const pts = new Map();
  let lastPinch = 0;
  const pinch = () => { const a = [...pts.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };

  dom.addEventListener('pointerdown', (e) => {
    try { dom.setPointerCapture(e.pointerId); } catch (_) { /* sin captura */ }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) lastPinch = pinch();
    ui.hideHint();
  });
  dom.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) {
      const k = 0.0032 * (view.fov / 55);
      user.yaw = clamp(user.yaw - dx * k, -1.1, 1.1);
      user.pitch = clamp(user.pitch + dy * k, -0.25, 0.9);
    } else if (pts.size === 2) {
      const d = pinch();
      if (lastPinch) zoom = clamp(zoom * (lastPinch / d), 0.55, 1.3);
      lastPinch = d;
    }
  });
  const release = (e) => { pts.delete(e.pointerId); lastPinch = 0; };
  dom.addEventListener('pointerup', release);
  dom.addEventListener('pointercancel', release);
  dom.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom = clamp(zoom * Math.exp(e.deltaY * 0.001), 0.55, 1.3);
  }, { passive: false });
  dom.addEventListener('dblclick', () => { user.yaw = 0; user.pitch = 0; zoom = 1; });

  function resize() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
  }
  resize();
  new ResizeObserver(resize).observe(host);

  function director(dt) {
    const k = 1 - Math.exp(-dt * 5);
    const sway = reduced ? 0 : 1;
    // El guion: empieza mirando al sol y, al caer la noche, se gira hacia la luna y el cielo.
    const autoYaw = lerp(0.22, -0.30, smooth(0.08, 0.9, t));
    const autoPitch = lerp(0.07, 0.34, smooth(0.15, 0.95, t));
    view.yaw += (autoYaw + user.yaw + pointer.x * 0.04 * sway - view.yaw) * k;
    view.pitch += (autoPitch + user.pitch - pointer.y * 0.025 * sway - view.pitch) * k;

    const baseFov = camera.aspect < 1 ? lerp(55, 84, clamp((1 - camera.aspect) / 0.6, 0, 1)) : 55;
    view.fov += (baseFov * zoom - view.fov) * k;
    if (Math.abs(camera.fov - view.fov) > 0.01) { camera.fov = view.fov; }
    camera.updateProjectionMatrix();

    const cx = Math.sin(time * 0.11) * 0.4 * sway, cz = CAM_Z - 4 * t;
    camera.position.set(cx, heightAt(cx, cz) + 1.95 + Math.sin(time * 0.17) * 0.06 * sway, cz);
    camera.rotation.set(view.pitch, -view.yaw, Math.sin(time * 0.13) * 0.004 * sway);
  }

  // ---- calidad adaptable: baja la resolución si el equipo va justo ----
  let ema = 0.016, sinceCheck = 0;
  const adaptive = !navigator.webdriver && !params.has('still');
  function adapt(dt) {
    if (!adaptive) return;
    ema += (dt - ema) * 0.08;
    sinceCheck += dt;
    if (sinceCheck > 1.5) {
      sinceCheck = 0;
      if (ema > 0.036 && pixelRatio > 0.8) {
        pixelRatio = Math.max(0.75, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        sky.setPixelRatio(pixelRatio);
        fireflies.setPixelRatio(pixelRatio);
        resize();
      }
    }
  }

  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    time += dt;
    if (playing && !scrubbing) {
      t = Math.min(1, t + dt / DURATION);
      if (t >= 1) playing = false;
    }
    env.update(t, time);
    scene.fog.color.copy(env.fog);
    props.update(dt);
    birds.update(time, t * DURATION);
    director(dt);
    sky.update(camera);
    renderer.render(scene, camera);
    ui.update(t, playing);
    adapt(dt);
    requestAnimationFrame(frame);
  }

  loader.progress(0.9, 'Encendiendo las estrellas…');
  await wait(30);
  env.update(t, 0);
  director(1);
  sky.update(camera);
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);

  loader.progress(1, '¡Listo!');
  const remaining = params.has('fast') ? 0 : MIN_LOADER_MS - (performance.now() - started);
  if (remaining > 0) await wait(remaining);
  clock.start();
  requestAnimationFrame(frame);
  await loader.finish();

  window.atardecer = {
    get t() { return t; },
    set(v) { t = clamp(v, 0, 1); },
    pause() { playing = false; },
    play() { playing = true; },
  };
  document.documentElement.dataset.ready = '1';
}

boot().catch((err) => {
  console.error(err);
  const noGL = /webgl/i.test(String(err && err.message));
  loader.fail(noGL ? 'Tu navegador no pudo iniciar WebGL. Prueba con Chrome, Edge, Firefox o Safari actualizados.' : 'Algo falló al preparar la escena. Recarga la página.');
});
