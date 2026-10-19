// Pájaros 3D de bloques con aleteo propio, y luciérnagas para la noche.
import * as THREE from 'three';
import { ENV_UNIFORMS } from './glsl.js';
import { mulberry32, smooth, lerp } from './noise.js';
import { heightAt } from './terrain.js';

const BODY = new THREE.BoxGeometry(0.34, 0.3, 1.0);
const HEAD = new THREE.BoxGeometry(0.26, 0.26, 0.3);
const BEAK = new THREE.BoxGeometry(0.1, 0.08, 0.24);
const TAIL = new THREE.BoxGeometry(0.3, 0.04, 0.55);
const WING_IN = new THREE.BoxGeometry(1.0, 0.05, 0.72).translate(0.5, 0, 0);
const WING_OUT = new THREE.BoxGeometry(0.95, 0.04, 0.5).translate(0.475, 0, 0.05);

function makeBird(bodyMat, beakMat, rng) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(BODY, bodyMat));
  const head = new THREE.Mesh(HEAD, bodyMat); head.position.set(0, 0.1, -0.6);
  const beak = new THREE.Mesh(BEAK, beakMat); beak.position.set(0, 0.06, -0.86);
  const tail = new THREE.Mesh(TAIL, bodyMat); tail.position.set(0, 0.0, 0.7);
  g.add(head, beak, tail);

  const wings = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.14, 0.08, -0.05);
    pivot.scale.x = side;
    pivot.add(new THREE.Mesh(WING_IN, bodyMat));
    const tip = new THREE.Group();
    tip.position.x = 1.0;
    tip.add(new THREE.Mesh(WING_OUT, bodyMat));
    pivot.add(tip);
    g.add(pivot);
    wings.push({ pivot, tip, side });
  }
  return { group: g, wings, phase: rng() * 6.28, rate: 6.5 + rng() * 2.5, glideAt: rng() * 6.28 };
}

function flap(b, time) {
  // Rachas de aleteo alternadas con planeo.
  const gate = smooth(-0.35, 0.35, Math.sin(time * 0.55 + b.glideAt));
  const f = Math.sin(time * b.rate + b.phase);
  const lag = Math.sin(time * b.rate + b.phase - 1.0);
  const inner = lerp(0.2, 0.12 + 0.66 * f, gate);
  const outer = lerp(0.15, 0.5 * lag, gate);
  for (const w of b.wings) {
    w.pivot.rotation.z = w.side * inner;   // el ala izquierda está espejada
    w.tip.rotation.z = outer;
  }
  b.group.position.y = Math.sin(time * b.rate * 2 + b.phase) * 0.05 * gate;
}

export function createBirds(env) {
  const root = new THREE.Group();
  const rng = mulberry32(7);

  const dark = new THREE.MeshStandardMaterial({ color: '#1d1830', roughness: 1, flatShading: true, transparent: true });
  const cream = new THREE.MeshStandardMaterial({ color: '#f1e9db', roughness: 1, flatShading: true, transparent: true });
  const beakMat = new THREE.MeshStandardMaterial({ color: '#e8883a', roughness: 1, flatShading: true, transparent: true });
  const mats = [dark, cream, beakMat];

  const flocks = [];
  function flock({ offsets, mat, scale, x0, speed, dir, y, z, start = 0 }) {
    const g = new THREE.Group();
    g.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.scale.setScalar(scale);
    const birds = offsets.map(([x, yy, zz]) => {
      const b = makeBird(mat, beakMat, rng);
      b.group.userData.base = [x, yy, zz];
      b.group.position.set(x, yy, zz);
      g.add(b.group);
      return b;
    });
    root.add(g);
    flocks.push({ g, birds, x0, speed, dir, y, z, start });
  }

  // Bandada en V cruzando el sol.
  const v = [[0, 0, 0]];
  for (let i = 1; i <= 4; i++) v.push([-3.6 * i, 0.3 * i, 3.3 * i], [3.6 * i, 0.5 * i, 3.3 * i]);
  flock({ offsets: v, mat: dark, scale: 2.1, x0: -10, speed: 6, dir: 1, y: 21, z: -100 });

  // La pareja: dos pájaros claros que vuelan juntos hacia la izquierda.
  flock({ offsets: [[0, 0, 0], [3.2, 0.9, 1.6]], mat: cream, scale: 2.0, x0: 150, speed: 6.5, dir: -1, y: 34, z: -150 });

  // Bandada lejana.
  const small = [[0, 0, 0], [-3, 0.2, 2.8], [3, 0.4, 2.8], [-6, 0.4, 5.6], [6, 0.6, 5.6]];
  flock({ offsets: small, mat: dark, scale: 2.6, x0: -190, speed: 5, dir: 1, y: 58, z: -230 });

  return {
    group: root,
    update(time, T) {
      const fade = 1 - smooth(0.34, 0.55, env.t);
      for (const m of mats) m.opacity = fade;
      root.visible = fade > 0.01;
      if (!root.visible) return;
      for (const f of flocks) {
        const x = f.x0 + f.dir * f.speed * T;
        f.g.position.set(x, f.y + Math.sin(time * 0.3 + f.x0) * 1.2, f.z);
        f.g.rotation.z = Math.sin(time * 0.5 + f.x0) * 0.04;
        for (const b of f.birds) {
          flap(b, time);
          const base = b.group.userData.base;
          b.group.position.x = base[0];
          b.group.position.z = base[2] + Math.sin(time * 0.6 + b.phase) * 0.15;
          b.group.position.y += base[1];
        }
      }
    },
  };
}

const flyVert = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uNight;
uniform float uPx;
varying float vA;
void main() {
  vec3 p = position + vec3(
    sin(uTime * 0.40 + aSeed.x * 20.0) * 1.7,
    sin(uTime * 0.65 + aSeed.y * 20.0) * 0.6,
    cos(uTime * 0.35 + aSeed.z * 20.0) * 1.7);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float blink = smoothstep(0.30, 0.90, sin(uTime * (0.7 + aSeed.w) + aSeed.x * 40.0) * 0.5 + 0.5);
  vA = blink * smoothstep(0.30, 0.65, uNight);
  gl_PointSize = clamp((4.0 + 5.0 * aSeed.y) * uPx * (38.0 / -mv.z), 1.0, 40.0 * uPx);
}`;

const flyFrag = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  if (a * vA < 0.004) discard;
  gl_FragColor = vec4(vec3(0.85, 1.0, 0.35), a * vA);
  #include <colorspace_fragment>
}`;

export function createFireflies(env, count, pixelRatio) {
  const rng = mulberry32(31);
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const x = (rng() * 2 - 1) * 38, z = 14 - rng() * 70;
    pos.set([x, heightAt(x, z) + 0.7 + rng() * 2.6, z], i * 3);
    seed.set([rng(), rng(), rng(), rng()], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: env.u.uTime, uNight: env.u.uNight, uPx: { value: pixelRatio } },
    vertexShader: flyVert,
    fragmentShader: flyFrag,
  });
  const points = new THREE.Points(g, m);
  points.frustumCulled = false;
  return { points, setPixelRatio(pr) { m.uniforms.uPx.value = pr; } };
}
