import * as THREE from 'three';
import { ENV_UNIFORMS, NOISE } from './glsl.js';
import { mulberry32, fbm2 } from './noise.js';

const SKY_R = 1500;
const STAR_R = 900;
const MOON_R = 700;

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const skyFrag = /* glsl */ `
${ENV_UNIFORMS}
${NOISE}
uniform vec3 uZenith;
uniform vec3 uUpper;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uCloudDark;
uniform vec3 uCloudLit;
uniform float uGlowAmt;
uniform float uSunVis;
uniform float uMoonAmt;
uniform float uCloudAmt;
varying vec3 vDir;

void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);

  vec3 col = mix(uHorizon, uUpper, smoothstep(0.0, 0.30, h));
  col = mix(col, uZenith, smoothstep(0.22, 0.95, h));

  // Resplandor del sol: ancho y cálido cerca del horizonte, más cerrado alrededor del disco.
  float sd = max(dot(d, uSunDir), 0.0);
  float low = 1.0 - smoothstep(0.0, 0.45, h);
  vec3 glow = uGlow * uGlowAmt;
  col += glow * (pow(sd, 2.5) * 0.30 * (0.4 + low) + pow(sd, 12.0) * 0.55 + pow(sd, 90.0) * 0.9);

  // Disco solar: se vuelve rojizo al bajar.
  float lowSun = 1.0 - smoothstep(0.0, 0.3, uSunDir.y);
  vec3 sunC = mix(vec3(1.0, 0.93, 0.78), vec3(1.0, 0.52, 0.22), lowSun);
  float disc = smoothstep(0.9986, 0.99885, sd);
  col = mix(col, sunC * 1.15, disc * uSunVis);
  col += sunC * pow(sd, 380.0) * 0.45 * uSunVis;

  // Nubes alargadas, iluminadas desde el lado del sol.
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.14);
    vec2 wind = vec2(uTime * 0.012, uTime * 0.004);
    vec2 q = uv * vec2(0.30, 0.65) + wind + 3.0;
    float c1 = fbm5(q);
    float c2 = fbm5(q + uSunDir.xz * 0.10);
    float cover = smoothstep(0.43, 0.68, c1);
    cover *= 1.0 - 0.8 * smoothstep(0.9975, 0.9988, sd);   // el disco solar asoma entre las nubes
    float lit = clamp(0.55 + (c1 - c2) * 6.0, 0.0, 1.0);
    lit = clamp(lit + pow(sd, 3.0) * 0.45, 0.0, 1.0);
    vec3 cc = mix(uCloudDark, uCloudLit, lit);
    float fade = smoothstep(0.0, 0.10, d.y) * (1.0 - smoothstep(0.75, 1.0, d.y) * 0.4);
    col = mix(col, cc, cover * fade * uCloudAmt);
  }

  // Halo azulado alrededor de la luna.
  float md = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.30, 0.42, 0.80) * (pow(md, 20.0) * 0.14 + pow(md, 260.0) * 0.45) * uMoonAmt;

  col += (hash21(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const starVert = /* glsl */ `
attribute float aSize;
attribute float aThresh;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uNight;
uniform float uPx;
varying vec3 vCol;
varying float vA;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
  float tw = 0.78 + 0.22 * sin(uTime * (1.1 + aPhase * 2.2) + aPhase * 60.0);
  float vis = smoothstep(aThresh, aThresh + 0.18, uNight);
  float h = normalize(wp.xyz - cameraPosition).y;
  vA = vis * tw * smoothstep(0.0, 0.10, h);
  vCol = aColor;
  // Cuadrados de píxel entero, como las estrellas del juego.
  gl_PointSize = max(1.0, floor(aSize * uPx * (0.9 + 0.2 * tw) + 0.5));
}`;

const starFrag = /* glsl */ `
varying vec3 vCol;
varying float vA;
void main() {
  if (vA < 0.004) discard;
  gl_FragColor = vec4(vCol, vA);
  #include <colorspace_fragment>
}`;

function makeStars(rng) {
  const MAIN = 2600, BAND = 1500, total = MAIN + BAND;
  const pos = new Float32Array(total * 3);
  const size = new Float32Array(total), thresh = new Float32Array(total), phase = new Float32Array(total);
  const color = new Float32Array(total * 3);

  const n = new THREE.Vector3(0.35, 0.8, 0.5).normalize();
  const u = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 0, 1)).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  const gauss = () => (rng() + rng() + rng() + rng() - 2) * 0.9;

  const tints = [[1, 1, 1], [0.74, 0.85, 1], [1, 0.88, 0.7]];
  for (let i = 0; i < total; i++) {
    const p = new THREE.Vector3();
    const band = i >= MAIN;
    if (!band) {
      const y = -0.05 + rng() * 1.05, r = Math.sqrt(1 - y * y), a = rng() * Math.PI * 2;
      p.set(r * Math.cos(a), y, r * Math.sin(a));
    } else {
      do {
        const a = rng() * Math.PI * 2;
        p.copy(u).multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a)).addScaledVector(n, gauss() * 0.11).normalize();
      } while (p.y < -0.05);
    }
    pos.set([p.x * STAR_R, p.y * STAR_R, p.z * STAR_R], i * 3);

    let s, th, bright;
    if (!band) {
      const big = Math.pow(rng(), 6);
      s = 1.5 + big * 2.7;
      th = 0.04 + (1 - big) * 0.45 + rng() * 0.1;
      bright = 0.7 + big * 0.5;
    } else {
      s = 1.2 + rng() * 1.0;
      th = 0.5 + rng() * 0.4;
      bright = 0.42;
    }
    size[i] = s; thresh[i] = th; phase[i] = rng();
    const tint = band ? tints[1] : tints[rng() < 0.62 ? 0 : rng() < 0.55 ? 1 : 2];
    color.set([tint[0] * bright, tint[1] * bright, tint[2] * bright], i * 3);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aThresh', new THREE.BufferAttribute(thresh, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  return g;
}

// Luna cuadrada de 16x16 píxeles dibujada en código (no usa texturas de ningún juego).
function makeMoonTexture() {
  const N = 16, S = 16;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = N * S;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(2024);
  const LIGHT = '#f0f2fa', MID = '#cfd5e6', DARK = '#a7afca', DEEP = '#8a93b4';
  const craters = [
    { x: 5.2, y: 5.0, r: 3.2 }, { x: 11.4, y: 4.2, r: 2.2 },
    { x: 10.2, y: 11.2, r: 3.4 }, { x: 3.8, y: 12.0, r: 2.0 }, { x: 13.2, y: 8.0, r: 1.3 },
  ];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let c = LIGHT;
      const m = fbm2(x * 0.32 + 4, y * 0.32 + 9, 3);
      if (m > 0.55) c = MID;
      if (m > 0.66) c = DARK;
      if (rng() < 0.08) c = MID;
      for (const k of craters) {
        const d = Math.hypot(x + 0.5 - k.x, y + 0.5 - k.y);
        if (d < k.r * 0.55) c = DEEP;
        else if (d < k.r) c = DARK;
        else if (d < k.r + 0.9 && c === LIGHT) c = MID;
      }
      ctx.fillStyle = c;
      ctx.fillRect(x * S, y * S, S, S);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSky(env, pixelRatio) {
  const group = new THREE.Group();   // sigue a la cámara: el cielo no tiene paralaje
  group.frustumCulled = false;

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      ...env.u,
      uZenith: { value: env.zenith }, uUpper: { value: env.upper }, uHorizon: { value: env.horizon },
      uGlow: { value: env.glow }, uCloudDark: { value: env.cloudDark }, uCloudLit: { value: env.cloudLit },
      uGlowAmt: { value: 1 }, uSunVis: { value: 1 }, uMoonAmt: { value: 0 }, uCloudAmt: { value: 0.9 },
    },
    vertexShader: skyVert,
    fragmentShader: skyFrag,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 48, 24), skyMat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  const rng = mulberry32(99);
  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: env.u.uTime, uNight: env.u.uNight, uPx: { value: pixelRatio } },
    vertexShader: starVert,
    fragmentShader: starFrag,
  });
  const stars = new THREE.Points(makeStars(rng), starMat);
  stars.renderOrder = -9;
  stars.frustumCulled = false;
  group.add(stars);

  const moonMat = new THREE.MeshBasicMaterial({
    map: makeMoonTexture(), transparent: true, depthWrite: false, fog: false, toneMapped: false,
  });
  const moonSize = 2 * MOON_R * Math.tan((9 * Math.PI) / 360);   // ~9° de ancho
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(moonSize, moonSize), moonMat);
  moon.renderOrder = -8;
  moon.frustumCulled = false;
  group.add(moon);

  const axis = new THREE.Vector3(0.3, 1, 0.2).normalize();

  return {
    group,
    setPixelRatio(pr) { starMat.uniforms.uPx.value = pr; },
    update(camera) {
      group.position.copy(camera.position);
      const U = skyMat.uniforms;
      U.uGlowAmt.value = env.glowAmt;
      U.uSunVis.value = env.sunVis;
      U.uMoonAmt.value = env.moonAmt;
      U.uCloudAmt.value = 0.95 - 0.5 * env.night;
      // El cielo gira despacio sobre un eje inclinado, como en el juego.
      stars.quaternion.setFromAxisAngle(axis, env.t * 0.45);
      moon.position.copy(env.moonDir).multiplyScalar(MOON_R);
      moon.lookAt(camera.position);
      moonMat.opacity = env.moonAmt;
      moon.visible = env.moonAmt > 0.002;
    },
  };
}
