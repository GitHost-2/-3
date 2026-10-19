// Cuatro gatitos de bloques (estilo Minecraft, dibujados en código) con gorro de cumpleaños.
// Cada uno lleva una letra de «Xime» en la panza y cruzan el campo en fila.
import * as THREE from 'three';
import { mulberry32, clamp, smooth } from './noise.js';
import { heightAt, LANE } from './terrain.js';

const LETTERS = ['X', 'i', 'm', 'e'];

const VARIANTS = [
  { fur: '#e08a3c', dark: '#b3601c', belly: '#fbe9cb', eye: '#7ed957', hat: ['#ff5fa2', '#ffffff'], kind: 'tabby' },
  { fur: '#2d2d3a', dark: '#1c1c26', belly: '#55556a', eye: '#f1e04a', hat: ['#9a6bff', '#ffffff'], kind: 'plain' },
  { fur: '#efe0c8', dark: '#5b4336', belly: '#fff7ea', eye: '#6fb4ff', hat: ['#3fb6ff', '#ffffff'], kind: 'siamese' },
  { fur: '#f6f2ec', dark: '#2a2a30', belly: '#ffffff', eye: '#d9a93c', hat: ['#ffcf3f', '#ffffff'], kind: 'calico', patch: '#e08a3c' },
];

// Duraciones del recorrido (segundos) y tamaño base del paso.
export const CATS_ENTER = 8.5, CATS_HOLD = 3.8, CATS_LEAVE = 6.8;
export const CATS_TOTAL = CATS_ENTER + CATS_HOLD + CATS_LEAVE;

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Pelaje con celdas de color ligeramente distintas, como los píxeles del juego.
function furCells(g, cols, rows, cell, v, rng, belly = 0) {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let col = v.fur;
      const r = rng();
      if (v.kind === 'tabby' && (x % 4 === 1 || (x + y) % 7 === 0) && y < rows - belly) col = v.dark;
      else if (v.kind === 'calico') {
        const n = Math.sin(x * 0.9 + 1.7) + Math.cos(y * 1.3 + x * 0.35);
        if (n > 1.05) col = v.patch;
        else if (n < -1.15) col = v.dark;
      } else if (v.kind === 'siamese' && (x < 2 || x > cols - 3)) col = v.dark;
      if (r < 0.1) col = shade(col, -14);
      else if (r > 0.92) col = shade(col, 12);
      g.fillStyle = col;
      g.fillRect(x * cell, y * cell, cell, cell);
    }
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// Costado con la panza clara y la letra en grande.
function flankTexture(v, letter, seed) {
  const cell = 8, cols = 26, rows = 10;
  return canvasTexture(cols * cell, rows * cell, (g, w, h) => {
    const rng = mulberry32(seed);
    furCells(g, cols, rows, cell, v, rng, 8);
    g.fillStyle = v.belly;
    g.fillRect(3 * cell, 2 * cell, (cols - 6) * cell, 8 * cell);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = shade(v.belly, rng() < 0.5 ? -10 : 6);
      g.fillRect((3 + Math.floor(rng() * (cols - 6))) * cell, (2 + Math.floor(rng() * 8)) * cell, cell, cell);
    }
    g.font = '700 80px "Pixelify Sans", ui-monospace, monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 10;
    g.strokeStyle = '#ffffff';
    g.strokeText(letter, w * 0.5, h * 0.56);
    g.fillStyle = '#ff3d85';
    g.fillText(letter, w * 0.5, h * 0.56);
  });
}

function furTexture(v, seed, w = 8, h = 8, belly = false) {
  const cell = 8;
  return canvasTexture(w * cell, h * cell, (g) => {
    const rng = mulberry32(seed);
    furCells(g, w, h, cell, belly ? { ...v, kind: 'plain', fur: v.belly } : v, rng);
  });
}

function faceTexture(v, seed) {
  const cell = 16, cols = 15, rows = 13;
  return canvasTexture(cols * cell, rows * cell, (g) => {
    const rng = mulberry32(seed);
    furCells(g, cols, rows, cell, v.kind === 'siamese' ? { ...v, kind: 'plain' } : v, rng);
    const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * cell, y * cell, w * cell, h * cell); };
    if (v.kind === 'siamese') px(4, 3, 7, 7, v.dark);
    px(4, 8, 7, 4, v.belly);                  // hocico claro
    px(3, 4, 3, 3, '#ffffff'); px(9, 4, 3, 3, '#ffffff');
    px(4, 4, 2, 3, v.eye); px(10, 4, 2, 3, v.eye);
    px(5, 4, 1, 3, '#15151c'); px(10, 4, 1, 3, '#15151c');   // pupilas
    px(7, 7, 1, 1, '#ff8fb0');                // nariz
    px(7, 8, 1, 1, '#2a2a30'); px(6, 9, 1, 1, '#2a2a30'); px(8, 9, 1, 1, '#2a2a30');
    px(2, 7, 2, 1, '#ff9fc0'); px(11, 7, 2, 1, '#ff9fc0');    // mejillas
  });
}

function mat(map, color) {
  const m = new THREE.MeshStandardMaterial({ map: map || null, color: color || 0xffffff, roughness: 1, metalness: 0 });
  // Un poco de luz propia: de noche los colores se leen sin quemarse.
  if (map) { m.emissiveMap = map; m.emissive = new THREE.Color(0xffffff); m.emissiveIntensity = 0.3; }
  else { m.emissive = new THREE.Color(color || 0xffffff); m.emissiveIntensity = 0.28; }
  return m;
}

function buildCat(v, letter, idx) {
  const seed = 100 + idx * 17;
  const furMat = mat(furTexture(v, seed));
  const topMat = mat(furTexture(v, seed + 1));
  const bellyMat = mat(furTexture(v, seed + 2, 8, 8, true));
  const flank = mat(flankTexture(v, letter, seed + 3));
  const face = mat(faceTexture(v, seed + 4));
  const dark = mat(null, v.kind === 'siamese' ? v.dark : v.fur);
  const tailTip = mat(null, v.kind === 'siamese' ? v.dark : v.kind === 'tabby' ? v.dark : v.fur);

  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  // Cuerpo: +x, -x, +y, -y, +z, -z
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.30, 0.78), [flank, flank, topMat, bellyMat, furMat, furMat]);
  body.position.y = 0.46;
  rig.add(body);

  const legs = [];
  const legGeo = new THREE.BoxGeometry(0.10, 0.31, 0.10);
  legGeo.translate(0, -0.155, 0);
  [[-0.1, -0.29], [0.1, -0.29], [-0.1, 0.29], [0.1, 0.29]].forEach(([x, z], i) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.32, z);
    const leg = new THREE.Mesh(legGeo, v.kind === 'siamese' ? dark : furMat);
    pivot.add(leg);
    rig.add(pivot);
    legs.push(pivot);
  });

  const head = new THREE.Group();
  head.position.set(0, 0.57, -0.5);
  const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.27, 0.27), [furMat, furMat, topMat, furMat, furMat, face]);
  head.add(headBox);
  [-0.095, 0.095].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.1, 0.045), v.kind === 'siamese' ? dark : furMat);
    ear.position.set(x, 0.18, 0.02);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.01), mat(null, '#ff9fc0'));
    inner.position.set(0, -0.005, -0.026);
    ear.add(inner);
    head.add(ear);
  });
  rig.add(head);

  // Gorro de cumpleaños escalonado, como una pirámide de bloques con pompón dorado.
  const hat = new THREE.Group();
  const widths = [0.25, 0.2, 0.15, 0.1, 0.055];
  widths.forEach((w, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.078, w), mat(null, v.hat[i % 2]));
    m.position.y = 0.039 + i * 0.078;
    hat.add(m);
  });
  const pom = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), mat(null, '#ffd23f'));
  pom.position.y = widths.length * 0.078 + 0.03;
  hat.add(pom);
  hat.position.set(0, 0.135, 0.01);
  hat.rotation.z = 0.1;
  head.add(hat);

  // Cola de dos tramos.
  const tail = new THREE.Group();
  tail.position.set(0, 0.56, 0.38);
  const t1g = new THREE.BoxGeometry(0.07, 0.07, 0.26); t1g.translate(0, 0, 0.13);
  const t1 = new THREE.Mesh(t1g, furMat);
  const tail2 = new THREE.Group();
  tail2.position.z = 0.26;
  const t2g = new THREE.BoxGeometry(0.07, 0.07, 0.22); t2g.translate(0, 0, 0.11);
  tail2.add(new THREE.Mesh(t2g, tailTip));
  t1.add(tail2);
  tail.add(t1);
  tail.rotation.x = -0.8;
  rig.add(tail);

  // Sombra suave en el suelo.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }),
  );
  shadow.scale.set(1.25, 1, 0.7);
  shadow.position.y = 0.025;
  root.add(shadow);

  return { root, rig, legs, head, tail, tail2, shadow };
}

export function createCats(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const cats = VARIANTS.map((v, i) => {
    const c = buildCat(v, LETTERS[i], i);
    c.root.rotation.y = Math.PI / 2;      // miran hacia -x (la izquierda de la pantalla)
    group.add(c.root);
    return c;
  });

  // Luz cálida que acompaña a los gatitos para que se lean bien de noche.
  const light = new THREE.PointLight(0xffd9b0, 0, 16, 1.4);
  light.position.set(0, 2.8, LANE.x + 2.4);
  scene.add(light);

  let spacing = 2.0, scale = 1.5, travel = 10;

  return {
    group,
    // Ajusta separación y tamaño al ancho visible (en vertical caben menos gatos).
    layout(aspect, vfovDeg, distance = 5.8) {
      const hfov = 2 * Math.atan(Math.tan((vfovDeg * Math.PI) / 360) * aspect);
      const halfW = Math.tan(hfov / 2) * distance;
      spacing = clamp((halfW * 2 * 0.58) / 3, 0.75, 2.3);
      scale = spacing * 0.78;
      travel = halfW + 3 * spacing + 1.6;
    },
    update(tau, time) {
      const enter = CATS_ENTER, hold = CATS_HOLD, leave = CATS_LEAVE;
      group.visible = tau > -0.5 && tau < CATS_TOTAL + 1;
      const presence = smooth(-0.5, 1.5, tau) * (1 - smooth(CATS_TOTAL - 2, CATS_TOTAL, tau));
      light.intensity = 9 * presence;
      if (!group.visible) return;

      // Posición común (desplazamiento sobre el lugar de descanso) y velocidad.
      let shift, speed;
      if (tau < enter) { const p = Math.max(0, tau) / enter; shift = travel * (1 - p) * (1 - p); speed = (2 * travel * (1 - p)) / enter; }
      else if (tau < enter + hold) { shift = 0; speed = 0; }
      else { const p = (tau - enter - hold) / leave; shift = -travel * p * p; speed = (2 * travel * p) / leave; }
      const dist = travel - shift;   // metros recorridos: da la fase del paso

      cats.forEach((c, i) => {
        const x = (i - 1.5) * spacing + shift;
        const g = heightAt(x, LANE.x);
        let hop = 0, wag = 1;
        const h = tau - enter - 0.55 * i - 0.2;                  // saltito alegre, uno tras otro
        if (h > 0 && h < 0.9) { hop = Math.abs(Math.sin((h / 0.9) * Math.PI)) * 0.42; wag = 3; }
        const walk = clamp(speed / 1.1, 0, 1);
        const ph = (dist / spacing) * 3.1 + i * 0.8;
        const bob = Math.abs(Math.sin(ph)) * 0.025 * walk;

        c.root.position.set(x, g + hop * scale + bob * scale, LANE.x);
        c.root.scale.setScalar(scale);
        c.shadow.scale.set(1.25 - hop * 0.8, 1, 0.7 - hop * 0.4);
        c.shadow.position.y = 0.025 - hop * 0.0;
        const sw = Math.sin(ph) * 0.62 * walk;
        c.legs[0].rotation.x = sw; c.legs[3].rotation.x = sw;
        c.legs[1].rotation.x = -sw; c.legs[2].rotation.x = -sw;
        c.head.rotation.x = Math.sin(ph * 2) * 0.05 * walk - hop * 0.25;
        c.head.rotation.y = 0.95 - 0.45 * walk + Math.sin(time * 0.9 + i) * 0.1 * (1 - walk);
        c.tail.rotation.y = Math.sin(time * 2.2 * wag + i) * 0.28;
        c.tail2.rotation.y = Math.sin(time * 2.2 * wag + i - 0.9) * 0.4;
        c.tail.rotation.x = -0.8 + Math.sin(time * 1.3 + i) * 0.08 - hop * 0.3;
      });
    },
  };
}
