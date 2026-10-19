import * as THREE from 'three';
import { ENV_UNIFORMS, NOISE, FOG, PATH } from './glsl.js';
import { fbm2, smooth } from './noise.js';
import { SUN_AZ } from './env.js';

export const CAM_Z = 18;   // posición de la cámara sobre el campo
// Carril de tierra que cruza el campo (z central, medio ancho): ahí caminan los gatitos.
export const LANE = new THREE.Vector3(12.5, 1.15, 1);

// Camino de tierra que serpentea hacia el horizonte (mismo cálculo que en el shader).
export function pathX(z) {
  const s = CAM_Z - z;
  return 11 * Math.sin(0.026 * s) * Math.cos(0.011 * s);
}

export function heightAt(x, z) {
  const dz = z - CAM_Z;
  const dist = Math.hypot(x, dz);
  const ang = Math.atan2(x, -dz);

  // Ondulación suave cerca de la cámara.
  let h = (fbm2(x * 0.035 + 10, z * 0.035) - 0.4) * 2.4 * smooth(4, 60, dist);

  // Colinas medias y cordillera lejana, más bajas justo donde se pone el sol.
  let hills = fbm2(x * 0.009 + 3, z * 0.009 + 7) * 26 * smooth(90, 330, dist);
  hills += smooth(300, 650, dist) * (18 + 32 * fbm2(x * 0.006 + 50, z * 0.006));
  const notch = Math.exp(-Math.pow((ang - SUN_AZ) / 0.32, 2));
  hills *= 1 - 0.9 * notch;
  return h + hills;
}

const vert = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normal;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const frag = /* glsl */ `
${ENV_UNIFORMS}
${NOISE}
${FOG}
${PATH}
uniform vec3 uLane;
uniform vec3 uGrassA;
uniform vec3 uGrassB;
uniform vec3 uWheat;
uniform vec3 uDirt;
varying vec3 vWorld;
varying vec3 vNormal;

void main() {
  vec3 n = normalize(vNormal);
  vec2 p = vWorld.xz;
  float dist = length(vWorld - cameraPosition);

  float patches = vnoise(p * 0.012);
  float fine = vnoise(p * 0.35) * 0.5 + vnoise(p * 1.3) * 0.25;

  // Mosaico de parcelas: pasto verde, pasto seco y trigo maduro a lo lejos.
  vec3 alb = mix(uGrassA, uGrassB, smoothstep(0.35, 0.65, patches));
  float wheat = smoothstep(0.55, 0.68, vnoise(p * 0.02 + 9.0)) * smoothstep(70.0, 200.0, dist);
  alb = mix(alb, uWheat, wheat);
  alb *= 0.88 + fine * 0.3;

  // Bajo la hierba, el suelo cercano es más oscuro (oclusión barata).
  alb *= mix(0.55, 1.0, smoothstep(15.0, 90.0, dist));

  // Camino de tierra con dos huellas de rueda.
  float dp = abs(p.x - pathX(p.y));
  float pathMask = 1.0 - smoothstep(0.9, 1.7, dp + (fine - 0.4) * 0.9);
  pathMask *= 1.0 - smoothstep(160.0, 320.0, dist);
  float laneM = 1.0 - smoothstep(uLane.y, uLane.y + 0.8, abs(p.y - uLane.x));
  laneM *= 1.0 - smoothstep(24.0, 40.0, abs(p.x));
  pathMask = max(pathMask, laneM);
  vec3 dirt = uDirt * (0.85 + fine * 0.35);
  dirt *= 1.0 - 0.28 * smoothstep(0.14, 0.0, abs(dp - 0.55));
  alb = mix(alb, dirt, pathMask);

  float ndl = max(dot(n, uSunDir), 0.0);
  float ndm = max(dot(n, uMoonDir), 0.0);
  vec3 amb = mix(uAmbGround, uAmbSky, n.y * 0.5 + 0.5);
  vec3 col = alb * (amb + uSunCol * ndl + uMoonCol * ndm);

  col = applyFog(col, dist);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function createTerrain(env) {
  const geo = new THREE.PlaneGeometry(1400, 1400, 230, 230);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...env.u,
      uLane: { value: LANE },
      uGrassA: { value: new THREE.Color('#5c7430') },
      uGrassB: { value: new THREE.Color('#9a9a3c') },
      uWheat: { value: new THREE.Color('#c4a448') },
      uDirt: { value: new THREE.Color('#8a6840') },
    },
    vertexShader: vert,
    fragmentShader: frag,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}
