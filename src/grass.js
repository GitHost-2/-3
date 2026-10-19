// Hierba instanciada con viento, brillo a contraluz y flores silvestres.
import * as THREE from 'three';
import { ENV_UNIFORMS, FOG, WIND } from './glsl.js';
import { mulberry32 } from './noise.js';
import { heightAt, pathX, CAM_Z } from './terrain.js';

const SEGMENTS = 4;

function bladeGeometry() {
  const pos = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const y = i / SEGMENTS;
    const hw = 0.5 * Math.pow(1 - y, 0.9);
    pos.push(-hw, y, 0, hw, y, 0);
  }
  pos.push(0, 1, 0);
  const idx = [];
  for (let i = 0; i < SEGMENTS - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const last = (SEGMENTS - 1) * 2;
  idx.push(last, last + 1, SEGMENTS * 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

const grassVert = /* glsl */ `
${ENV_UNIFORMS}
${FOG}
${WIND}
attribute vec3 aPos;
attribute vec4 aData;   // x: giro, y: alto, z: ancho, w: azar
uniform vec3 uBase;
uniform vec3 uTipA;
uniform vec3 uTipB;
varying vec3 vCol;

void main() {
  float t = position.y;
  float yaw = aData.x, h = aData.y, w = aData.z, rnd = aData.w;

  // Las briznas lejanas del borde del prado se encogen para que no se vea el corte.
  float edge = 1.0 - smoothstep(58.0, 82.0, length(aPos.xz - vec2(0.0, ${CAM_Z.toFixed(1)})));
  h *= mix(0.25, 1.0, edge);

  vec3 p = vec3(position.x * w, position.y * h, 0.0);
  float c = cos(yaw), s = sin(yaw);
  p = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
  p += windBend(aPos.xz, t, h, rnd);

  vec3 world = aPos + p;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);

  vec3 tip = mix(uTipA, uTipB, smoothstep(0.30, 0.80, rnd));
  vec3 alb = mix(uBase, tip, smoothstep(0.0, 1.0, t));
  alb *= 0.82 + 0.36 * fract(rnd * 13.7);

  vec3 viewDir = normalize(world - cameraPosition);
  float sunBack = pow(max(dot(viewDir, uSunDir), 0.0), 3.0);
  float moonBack = pow(max(dot(viewDir, uMoonDir), 0.0), 4.0);

  vec3 amb = mix(uAmbGround, uAmbSky, 0.35 + 0.65 * t);
  vec3 diff = uSunCol * (0.28 + 0.55 * t) + uMoonCol * (0.35 + 0.35 * t);
  // A contraluz la hierba se enciende: el efecto del atardecer dorado.
  vec3 rim = uSunCol * sunBack * t * 1.5 + uMoonCol * moonBack * t * 1.1;
  vec3 col = alb * (amb + diff + rim);

  col = applyFog(col, length(world - cameraPosition));
  vCol = col;
}`;

const grassFrag = /* glsl */ `
varying vec3 vCol;
void main() {
  gl_FragColor = vec4(vCol, 1.0);
  #include <colorspace_fragment>
}`;

const flowerVert = /* glsl */ `
${ENV_UNIFORMS}
${FOG}
${WIND}
attribute vec3 aPos;
attribute vec4 aData;   // x: alto, y: tamaño, z: azar, w: color
uniform vec3 uPalette[4];
varying vec3 vCol;
varying vec2 vUv;

void main() {
  float h = aData.x;
  float edge = 1.0 - smoothstep(58.0, 82.0, length(aPos.xz - vec2(0.0, ${CAM_Z.toFixed(1)})));
  h *= mix(0.25, 1.0, edge);
  vec3 top = aPos + vec3(0.0, h, 0.0) + windBend(aPos.xz, 1.0, h, aData.z);

  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 world = top + (right * position.x + up * position.y) * aData.y * mix(0.4, 1.0, edge);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  vUv = position.xy * 2.0;

  int ci = int(aData.w);
  vec3 alb = uPalette[0];
  if (ci == 1) alb = uPalette[1];
  else if (ci == 2) alb = uPalette[2];
  else if (ci == 3) alb = uPalette[3];

  vec3 amb = mix(uAmbGround, uAmbSky, 0.9);
  vec3 col = alb * (amb + uSunCol * 0.85 + uMoonCol * 0.7);
  col = applyFog(col, length(world - cameraPosition));
  vCol = col;
}`;

const flowerFrag = /* glsl */ `
varying vec3 vCol;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float a = atan(vUv.y, vUv.x);
  float petal = 0.62 + 0.26 * cos(5.0 * a);
  if (r > petal) discard;
  vec3 col = vCol;
  if (r < 0.22) col = mix(vec3(0.55, 0.4, 0.05), vCol, 0.25) * 1.2;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function createGrass(env, { count, flowers }) {
  const rng = mulberry32(1337);
  const total = count + flowers;
  const aPos = new Float32Array(total * 3);
  const aData = new Float32Array(total * 4);
  const fPos = new Float32Array(flowers * 3);
  const fData = new Float32Array(flowers * 4);

  const place = (maxR, minR, power) => {
    for (;;) {
      const r = minR + (maxR - minR) * Math.pow(rng(), power);
      const th = (rng() * 2 - 1) * 2.05;
      const x = Math.sin(th) * r, z = CAM_Z - Math.cos(th) * r;
      if (z < CAM_Z + 4 && Math.abs(x - pathX(z)) < 1.45 + rng() * 0.5) continue;
      return [x, z, r];
    }
  };

  for (let i = 0; i < count; i++) {
    const [x, z, r] = place(80, 1.5, 0.62);
    aPos.set([x, heightAt(x, z), z], i * 3);
    const grow = 1 + r / 70;
    aData.set([rng() * Math.PI * 2, (0.55 + 0.55 * rng()) * grow, (0.06 + 0.06 * rng()) * (1 + r / 22), rng()], i * 4);
  }
  for (let i = 0; i < flowers; i++) {
    const [x, z] = place(55, 3.5, 0.9);
    const y = heightAt(x, z);
    const h = 0.8 + 0.5 * rng(), azar = rng();
    // Cada flor lleva su tallo: una brizna verde con el mismo alto y azar.
    const j = count + i;
    aPos.set([x, y, z], j * 3);
    aData.set([rng() * Math.PI * 2, h, 0.05, 0.12 + azar * 0.1], j * 4);
    fPos.set([x, y, z], i * 3);
    fData.set([h, 0.22 + 0.14 * rng(), 0.12 + azar * 0.1, Math.floor(rng() * 4)], i * 4);
  }

  const grassGeo = new THREE.InstancedBufferGeometry();
  const base = bladeGeometry();
  grassGeo.index = base.index;
  grassGeo.setAttribute('position', base.attributes.position);
  grassGeo.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
  grassGeo.setAttribute('aData', new THREE.InstancedBufferAttribute(aData, 4));
  grassGeo.instanceCount = total;

  const grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      ...env.u,
      uBase: { value: new THREE.Color('#2c3812') },
      uTipA: { value: new THREE.Color('#9db23c') },
      uTipB: { value: new THREE.Color('#e6bb4c') },
    },
    vertexShader: grassVert,
    fragmentShader: grassFrag,
  });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.frustumCulled = false;

  const quad = new THREE.PlaneGeometry(1, 1);
  const flowerGeo = new THREE.InstancedBufferGeometry();
  flowerGeo.index = quad.index;
  flowerGeo.setAttribute('position', quad.attributes.position);
  flowerGeo.setAttribute('aPos', new THREE.InstancedBufferAttribute(fPos, 3));
  flowerGeo.setAttribute('aData', new THREE.InstancedBufferAttribute(fData, 4));
  flowerGeo.instanceCount = flowers;
  const flowerMat = new THREE.ShaderMaterial({
    uniforms: {
      ...env.u,
      uPalette: {
        value: [new THREE.Color('#f6f1e2'), new THREE.Color('#f3c64c'), new THREE.Color('#ec7fb2'), new THREE.Color('#8f74e0')],
      },
    },
    vertexShader: flowerVert,
    fragmentShader: flowerFrag,
  });
  const flowerMesh = new THREE.Mesh(flowerGeo, flowerMat);
  flowerMesh.frustumCulled = false;

  const group = new THREE.Group();
  group.add(grass, flowerMesh);
  return { group };
}
