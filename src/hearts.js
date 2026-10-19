// Corazones como partículas: uno en remolino (tornado) y otro que flota hacia arriba (final).
import * as THREE from 'three';
import { mulberry32 } from './noise.js';

const heartFrag = /* glsl */ `
varying vec3 vCol;
varying float vA;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * 2.5;
  p.y = -p.y + 0.12;
  float a = p.x * p.x + p.y * p.y - 1.0;
  float v = a * a * a - p.x * p.x * p.y * p.y * p.y;   // corazón implícito: v < 0 es el interior
  float m = 1.0 - smoothstep(-0.03, 0.05, v);
  if (m * vA < 0.01) discard;
  gl_FragColor = vec4(vCol, vA * m);
  #include <colorspace_fragment>
}`;

const PALETTE = ['#ff6fa8', '#ffa3c8', '#ffffff', '#c9a6ff', '#ff8fb8'];

function colorsFor(count, rng) {
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    c.set(PALETTE[Math.floor(rng() * PALETTE.length)]);
    col.set([c.r, c.g, c.b], i * 3);
  }
  return col;
}

const swirlVert = /* glsl */ `
attribute vec4 aSeed;
attribute vec3 aColor;
uniform float uTime;
uniform float uPx;
uniform float uRadius;
uniform float uAlpha;
varying vec3 vCol;
varying float vA;
void main() {
  float u = fract(aSeed.x + uTime * 0.03 * (0.6 + aSeed.z));
  float r = (0.8 + 7.2 * pow(u, 1.5)) * uRadius * (1.1 + 0.3 * sin(aSeed.y * 9.0));
  float y = -5.0 + 10.2 * u;
  float ang = aSeed.y * 6.2831 + uTime * (1.5 - 0.95 * u) * (0.7 + aSeed.z * 0.6);
  vec4 mv = modelViewMatrix * vec4(cos(ang) * r, y, sin(ang) * r, 1.0);
  gl_Position = projectionMatrix * mv;
  vCol = aColor;
  vA = uAlpha * smoothstep(0.0, 0.1, u) * (1.0 - smoothstep(0.9, 1.0, u)) * 0.9;
  gl_PointSize = clamp(aSeed.w * uPx * (340.0 / -mv.z), 2.0, 60.0 * uPx);
}`;

export function createSwirlHearts(count, pixelRatio) {
  const rng = mulberry32(21);
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) seed.set([rng(), rng(), rng(), 0.55 + rng() * 0.9], i * 4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  g.setAttribute('aColor', new THREE.BufferAttribute(colorsFor(count, rng), 3));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPx: { value: pixelRatio }, uRadius: { value: 1 }, uAlpha: { value: 1 } },
    vertexShader: swirlVert, fragmentShader: heartFrag,
  });
  const points = new THREE.Points(g, m);
  points.frustumCulled = false;
  return { points, uniforms: m.uniforms };
}

const floatVert = /* glsl */ `
attribute vec4 aSeed;   // x, fase, velocidad, tamaño
attribute vec3 aColor;
uniform float uTime;
uniform float uPx;
uniform float uAlpha;
uniform vec2 uSpan;
varying vec3 vCol;
varying float vA;
void main() {
  float k = fract(aSeed.y + uTime * 0.035 * (0.5 + aSeed.z));
  float y = (k - 0.5) * uSpan.y;
  float x = (aSeed.x - 0.5) * uSpan.x + sin(uTime * 0.6 + aSeed.y * 30.0) * 0.5;
  vec4 mv = modelViewMatrix * vec4(x, y, -aSeed.z * 6.0, 1.0);
  gl_Position = projectionMatrix * mv;
  vCol = aColor;
  vA = uAlpha * smoothstep(0.0, 0.12, k) * (1.0 - smoothstep(0.85, 1.0, k)) * 0.8;
  gl_PointSize = clamp(aSeed.w * uPx * (300.0 / -mv.z), 3.0, 70.0 * uPx);
}`;

export function createFloatHearts(count, pixelRatio) {
  const rng = mulberry32(33);
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) seed.set([rng(), rng(), rng(), 0.6 + rng() * 1.1], i * 4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  g.setAttribute('aColor', new THREE.BufferAttribute(colorsFor(count, rng), 3));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPx: { value: pixelRatio }, uAlpha: { value: 1 }, uSpan: { value: new THREE.Vector2(26, 18) } },
    vertexShader: floatVert, fragmentShader: heartFrag,
  });
  const points = new THREE.Points(g, m);
  points.frustumCulled = false;
  return { points, uniforms: m.uniforms };
}
