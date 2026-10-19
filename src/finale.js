// Escena final: fondo lila que continúa el del tornado, con corazones que suben despacio.
import * as THREE from 'three';
import { createFloatHearts } from './hearts.js';

function background() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  const lg = g.createLinearGradient(0, 0, 0, 512);
  lg.addColorStop(0, '#e6d3fa'); lg.addColorStop(0.55, '#f0cfec'); lg.addColorStop(1, '#f7c3df');
  g.fillStyle = lg; g.fillRect(0, 0, 256, 512);
  const rg = g.createRadialGradient(128, 230, 10, 128, 230, 260);
  rg.addColorStop(0, 'rgba(255,255,255,0.55)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createFinale(pixelRatio) {
  const scene = new THREE.Scene();
  scene.background = background();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 14);
  const hearts = createFloatHearts(90, pixelRatio);
  scene.add(hearts.points);
  return {
    scene, camera, hearts,
    layout(aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      const visH = 2 * 14 * Math.tan((camera.fov * Math.PI) / 360);
      hearts.uniforms.uSpan.value.set(Math.max(visH * aspect, 8) * 1.1, visH * 1.05);
    },
    update(time) { hearts.uniforms.uTime.value = time; },
  };
}
