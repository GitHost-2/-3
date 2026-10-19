// Estado del cielo y la luz según la hora (t = 0 atardecer dorado … 1 noche cerrada).
// Un solo objeto `env` alimenta shaders y luces de three.js para que todo cambie a la vez.
import * as THREE from 'three';
import { smooth, clamp } from './noise.js';

export const SUN_AZ = 0.35;      // azimut del sol (rad, + = derecha de la vista inicial)
const D2R = Math.PI / 180;

const hex = (keys) => keys.map((k) => {
  const o = { t: k.t };
  for (const name of Object.keys(k)) {
    if (name === 't') continue;
    o[name] = typeof k[name] === 'string' ? new THREE.Color(k[name]) : k[name];
  }
  return o;
});

// Intensidades "estilo clásico" (1 = luz blanca normal); las luces de three se multiplican por PI.
const KEYS = hex([
  { t: 0.00, zenith: '#27478c', upper: '#7467a6', horizon: '#ffb468', glow: '#ff8d3c', glowAmt: 1.00, cloudDark: '#93628f', cloudLit: '#ffcb86', hemiSky: '#9aa2d0', hemiGround: '#8a6240', hemiI: 0.85, sun: '#ffb36e', sunI: 1.15, moonI: 0.00, fog: '#cf8d72' },
  { t: 0.15, zenith: '#1f3374', upper: '#7a4c86', horizon: '#ff7440', glow: '#ff5624', glowAmt: 1.00, cloudDark: '#6c3d6e', cloudLit: '#ff8a50', hemiSky: '#8a6aa0', hemiGround: '#6a4030', hemiI: 0.70, sun: '#ff7d3e', sunI: 0.80, moonI: 0.00, fog: '#a3607a' },
  { t: 0.30, zenith: '#141f55', upper: '#40306f', horizon: '#d85a80', glow: '#ff5c70', glowAmt: 0.55, cloudDark: '#3a2a62', cloudLit: '#e0658a', hemiSky: '#4c4a90', hemiGround: '#3a2a45', hemiI: 0.50, sun: '#ff5a50', sunI: 0.12, moonI: 0.10, fog: '#5a3a6c' },
  { t: 0.48, zenith: '#0a1238', upper: '#1c2058', horizon: '#5d3a7c', glow: '#7a3d72', glowAmt: 0.22, cloudDark: '#1c1f4d', cloudLit: '#5a4580', hemiSky: '#324488', hemiGround: '#1c2038', hemiI: 0.44, sun: '#000000', sunI: 0.00, moonI: 0.20, fog: '#2a2a5c' },
  { t: 0.72, zenith: '#050b25', upper: '#0b1438', horizon: '#16204a', glow: '#1a2a5a', glowAmt: 0.05, cloudDark: '#0c1330', cloudLit: '#26376a', hemiSky: '#2c3c80', hemiGround: '#141a30', hemiI: 0.42, sun: '#000000', sunI: 0.00, moonI: 0.26, fog: '#10183c' },
  { t: 1.00, zenith: '#030618', upper: '#070e2a', horizon: '#0f1838', glow: '#101c44', glowAmt: 0.00, cloudDark: '#070c24', cloudLit: '#1c2a58', hemiSky: '#2c3c80', hemiGround: '#121830', hemiI: 0.42, sun: '#000000', sunI: 0.00, moonI: 0.30, fog: '#0b1230' },
]);

const COLOR_KEYS = ['zenith', 'upper', 'horizon', 'glow', 'cloudDark', 'cloudLit', 'hemiSky', 'hemiGround', 'sun', 'fog'];
const NUM_KEYS = ['glowAmt', 'hemiI', 'sunI', 'moonI'];

export function createEnv() {
  const env = {
    t: 0,
    time: 0,
    sunDir: new THREE.Vector3(),
    moonDir: new THREE.Vector3(),
    night: 0,       // 0 = cielo claro, 1 = estrellas a pleno
    sunVis: 0,      // 1 mientras el sol esté sobre el horizonte
    moonAmt: 0,
    glowAmt: 0,
    zenith: new THREE.Color(), upper: new THREE.Color(), horizon: new THREE.Color(),
    glow: new THREE.Color(), cloudDark: new THREE.Color(), cloudLit: new THREE.Color(),
    fog: new THREE.Color(),
    moonColor: new THREE.Color('#93acff'),
  };

  env.u = {
    uSunDir: { value: env.sunDir },
    uMoonDir: { value: env.moonDir },
    uSunCol: { value: new THREE.Vector3() },
    uMoonCol: { value: new THREE.Vector3() },
    uAmbSky: { value: new THREE.Vector3() },
    uAmbGround: { value: new THREE.Vector3() },
    uFogColor: { value: env.fog },
    uFogDensity: { value: 0.0042 },
    uTime: { value: 0 },
    uNight: { value: 0 },
  };

  const sunLight = new THREE.DirectionalLight(0xffffff, 1);
  const moonLight = new THREE.DirectionalLight(env.moonColor, 0);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  env.lights = { sun: sunLight, moon: moonLight, hemi };

  const hemiSky = new THREE.Color(), hemiGround = new THREE.Color(), sunColor = new THREE.Color();

  env.update = function (t, time) {
    t = clamp(t, 0, 1);
    env.t = t; env.time = time;

    let i = 0;
    while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    let u = clamp((t - a.t) / (b.t - a.t), 0, 1);
    u = u * u * (3 - 2 * u);

    for (const k of COLOR_KEYS) {
      const dst = k === 'fog' ? env.fog : k === 'hemiSky' ? hemiSky : k === 'hemiGround' ? hemiGround : k === 'sun' ? sunColor : env[k];
      dst.copy(a[k]).lerp(b[k], u);
    }
    const n = {};
    for (const k of NUM_KEYS) n[k] = a[k] + (b[k] - a[k]) * u;

    // Posiciones: el sol baja hacia el horizonte; la luna sale por la izquierda y sube.
    const sunElev = (9 - 56 * t) * D2R;
    const sunAz = SUN_AZ;
    env.sunDir.set(Math.sin(sunAz) * Math.cos(sunElev), Math.sin(sunElev), -Math.cos(sunAz) * Math.cos(sunElev)).normalize();

    const moonEase = 1 - Math.pow(1 - t, 2);
    const moonElev = (-16 + 50 * moonEase) * D2R;
    const moonAz = -0.30 + 0.20 * t;
    env.moonDir.set(Math.sin(moonAz) * Math.cos(moonElev), Math.sin(moonElev), -Math.cos(moonAz) * Math.cos(moonElev)).normalize();

    env.night = smooth(0.18, 0.55, t);
    env.sunVis = smooth(-0.1, 0.04, env.sunDir.y);
    env.moonAmt = smooth(-0.05, 0.2, env.moonDir.y) * smooth(0.12, 0.5, t);
    env.glowAmt = n.glowAmt;

    const sunI = n.sunI * env.sunVis;
    const moonI = n.moonI * smooth(-0.05, 0.15, env.moonDir.y);

    const U = env.u;
    U.uSunCol.value.set(sunColor.r * sunI, sunColor.g * sunI, sunColor.b * sunI);
    U.uMoonCol.value.set(env.moonColor.r * moonI, env.moonColor.g * moonI, env.moonColor.b * moonI);
    U.uAmbSky.value.set(hemiSky.r * n.hemiI, hemiSky.g * n.hemiI, hemiSky.b * n.hemiI);
    U.uAmbGround.value.set(hemiGround.r * n.hemiI, hemiGround.g * n.hemiI, hemiGround.b * n.hemiI);
    U.uTime.value = time;
    U.uNight.value = env.night;

    sunLight.color.copy(sunColor);
    sunLight.intensity = sunI * Math.PI;
    sunLight.position.copy(env.sunDir).multiplyScalar(200);
    moonLight.intensity = moonI * Math.PI;
    moonLight.position.copy(env.moonDir).multiplyScalar(200);
    hemi.color.copy(hemiSky);
    hemi.groundColor.copy(hemiGround);
    hemi.intensity = n.hemiI * Math.PI;
  };

  env.update(0, 0);
  return env;
}

export function clockLabel(t) {
  const minutes = Math.round(19 * 60 + 30 + t * 210);
  const h = Math.floor(minutes / 60) % 24, m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function phaseLabel(t) {
  if (t < 0.22) return 'Atardecer';
  if (t < 0.5) return 'Anochecer';
  return 'Noche';
}
