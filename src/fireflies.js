// Luciérnagas: puntos de luz suaves que parpadean sobre el campo por la noche.
import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { heightAt } from './terrain.js';

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
