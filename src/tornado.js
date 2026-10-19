// Tornado de cartas rosas: una espiral que gira con 4 fotos que, una a una, salen al frente.
import * as THREE from 'three';
import { mulberry32, clamp, lerp, smooth } from './noise.js';
import { createSwirlHearts } from './hearts.js';

const N = 52;
const PHOTO_AT = [6, 19, 32, 45];                 // posición de cada foto en la espiral
export const FOCUS_START = [6.0, 13.4, 20.8, 28.2];  // segundos (desde que empieza el tornado)
const FOCUS_LEN = 6.4;
export const TORNADO_LEN = 40;
const DISSOLVE = 34.5;

const CARD_W = 1.5, CARD_H = 2.1;
const FONT = '"Cormorant Garamond", Georgia, serif';

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function heart(g, cx, cy, s) {
  g.beginPath();
  g.moveTo(cx, cy + s * 0.9);
  g.bezierCurveTo(cx + s * 1.4, cy - s * 0.1, cx + s * 0.7, cy - s * 1.1, cx, cy - s * 0.35);
  g.bezierCurveTo(cx - s * 0.7, cy - s * 1.1, cx - s * 1.4, cy - s * 0.1, cx, cy + s * 0.9);
  g.closePath();
}

const CW = 480, CH = 672;

function cardFront({ img, variant, label }) {
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const g = c.getContext('2d');
  // Carta rosa
  const bg = g.createLinearGradient(0, 0, CW, CH);
  bg.addColorStop(0, '#ffd3e6'); bg.addColorStop(1, '#ff9ec7');
  g.fillStyle = bg;
  roundRect(g, 4, 4, CW - 8, CH - 8, 40); g.fill();
  g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,0.85)';
  roundRect(g, 14, 14, CW - 28, CH - 28, 32); g.stroke();

  // Marco blanco con la foto
  const fx = 40, fy = 40, fw = CW - 80, fh = 500;
  g.fillStyle = '#fff';
  roundRect(g, fx - 8, fy - 8, fw + 16, fh + 16, 14); g.fill();
  g.save();
  roundRect(g, fx, fy, fw, fh, 8); g.clip();
  if (img) {
    const s = Math.max(fw / img.naturalWidth, fh / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    g.drawImage(img, fx + (fw - w) / 2, fy + (fh - h) / 2, w, h);
  } else {
    const pg = g.createLinearGradient(fx, fy, fx + fw, fy + fh);
    const sets = [['#e7d6ff', '#ffd9ec'], ['#ffe0ee', '#d9c7ff'], ['#f3dcff', '#ffd0e3'], ['#dccaff', '#ffe3f0']];
    pg.addColorStop(0, sets[variant % 4][0]); pg.addColorStop(1, sets[variant % 4][1]);
    g.fillStyle = pg; g.fillRect(fx, fy, fw, fh);
    if (label) {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      heart(g, fx + fw / 2, fy + fh / 2 - 20, 90); g.fill();
      g.fillStyle = '#b04a86';
      g.font = `italic 500 40px ${FONT}`; g.textAlign = 'center';
      g.fillText(label, fx + fw / 2, fy + fh / 2 + 130);
    } else {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 4; xx++) {
        heart(g, fx + 50 + xx * 100 + (yy % 2) * 40, fy + 60 + yy * 100, 22 + ((xx + yy) % 3) * 6); g.fill();
      }
    }
  }
  g.restore();

  // Corazón al pie de la carta
  g.fillStyle = '#ff5c93';
  heart(g, CW / 2, CH - 56, 22); g.fill();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function cardBack() {
  const c = document.createElement('canvas');
  c.width = 240; c.height = 336;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 240, 336);
  bg.addColorStop(0, '#ff9ec7'); bg.addColorStop(1, '#ffc2dc');
  g.fillStyle = bg;
  roundRect(g, 2, 2, 236, 332, 20); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3;
  roundRect(g, 10, 10, 220, 316, 15); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  heart(g, 120, 168, 52); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function backgroundTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  const lg = g.createLinearGradient(0, 0, 0, 512);
  lg.addColorStop(0, '#b79df0'); lg.addColorStop(0.5, '#cdb6f6'); lg.addColorStop(1, '#e6d3fa');
  g.fillStyle = lg; g.fillRect(0, 0, 256, 512);
  const rg = g.createRadialGradient(128, 290, 10, 128, 290, 230);
  rg.addColorStop(0, 'rgba(255,230,245,0.65)'); rg.addColorStop(1, 'rgba(255,230,245,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const LILAC_BOTTOM = '#e6d3fa';

export function createTornado(photos, pixelRatio) {
  const scene = new THREE.Scene();
  scene.background = backgroundTexture();
  scene.fog = new THREE.Fog(0xd5bff6, 16, 34);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

  const rng = mulberry32(88);
  const geo = new THREE.PlaneGeometry(CARD_W, CARD_H);
  const backTex = cardBack();
  const fillerTex = [0, 1, 2, 3].map((v) => cardFront({ img: null, variant: v, label: '' }));
  const world = new THREE.Group();
  scene.add(world);

  const cards = [];
  let photoIdx = 0;
  for (let k = 0; k < N; k++) {
    const isPhoto = PHOTO_AT.includes(k);
    const p = isPhoto ? photoIdx++ : -1;
    const frontTex = isPhoto ? cardFront({ img: photos[p], variant: p, label: photos[p] ? '' : 'Tu foto aquí' }) : fillerTex[k % 4];
    const fm = new THREE.MeshBasicMaterial({ map: frontTex, transparent: true, alphaTest: 0.35 });
    const bm = new THREE.MeshBasicMaterial({ map: backTex, transparent: true, alphaTest: 0.35 });
    const front = new THREE.Mesh(geo, fm);
    const back = new THREE.Mesh(geo, bm);
    back.rotation.y = Math.PI;
    back.position.z = -0.004;
    const group = new THREE.Group();
    group.add(front, back);
    world.add(group);
    cards.push({
      group, fm, bm, isPhoto, p,
      u: (k + 0.5) / N,
      th0: rng() * Math.PI * 2,
      s: isPhoto ? 1.5 : 0.55 + rng() * 0.45,
      roll: (rng() - 0.5) * 0.5,
    });
  }

  const swirl = createSwirlHearts(170, pixelRatio);
  scene.add(swirl.points);

  let phi = 0, rScale = 1, stageDist = 10.5, camDist = 17, focusScale = 2.3;
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const _m = new THREE.Matrix4(), _pos = new THREE.Vector3(), _tgt = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  const _stage = new THREE.Vector3(), _scaleV = new THREE.Vector3();

  function layout(aspect) {
    const portrait = aspect < 1;
    camera.fov = portrait ? 60 : 42;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    rScale = portrait ? clamp(aspect * 1.15, 0.52, 1) : 1;
    const hfovHalf = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * aspect);
    camDist = Math.max(portrait ? 14 : 19, (8.2 * rScale * 1.02) / Math.tan(hfovHalf));
    stageDist = 10.5;
    const visH = 2 * stageDist * Math.tan((camera.fov * Math.PI) / 360);
    const visW = visH * aspect;
    focusScale = Math.min((0.64 * visH) / CARD_H, (0.82 * visW) / CARD_W);
  }
  layout(1.78);

  const focusEnv = (tau, k) => {
    const a = FOCUS_START[k];
    return smooth(a, a + 1.4, tau) * (1 - smooth(a + FOCUS_LEN - 1.4, a + FOCUS_LEN, tau));
  };

  return {
    scene, camera, layout, swirl,
    update(tau, time, dt) {
      // La velocidad se acumula: sube al formarse y se calma cuando una foto está al frente.
      let anyFocus = 0;
      for (let k = 0; k < 4; k++) anyFocus = Math.max(anyFocus, focusEnv(tau, k));
      const ramp = smooth(0, 6, tau);
      phi += dt * (0.55 + 0.9 * ramp) * (1 - 0.65 * anyFocus);

      camera.position.set(Math.sin(time * 0.22) * 0.9, 0.9, camDist);
      camera.lookAt(0, 0.1, 0);
      world.rotation.z = Math.sin(time * 0.35) * 0.035;
      world.updateMatrixWorld(true);

      swirl.uniforms.uTime.value = time;
      swirl.uniforms.uRadius.value = rScale;
      swirl.uniforms.uAlpha.value = smooth(1.5, 6, tau) * (1 - 0.0 * smooth(DISSOLVE, TORNADO_LEN, tau));

      _stage.set(0, 0.2, camDist - stageDist);

      for (const c of cards) {
        const u = c.u;
        const omega = 1.5 - 0.95 * u;
        const th = c.th0 + phi * omega;
        const r0 = (0.8 + 7.2 * Math.pow(u, 1.5)) * rScale;
        const y0 = -5.0 + 10.2 * u + Math.sin(time * 1.1 + c.th0) * 0.18;

        // Aparece de abajo hacia arriba y se disuelve subiendo en espiral.
        const appear = smooth(u * 3.4, u * 3.4 + 1.5, tau);
        const gone = smooth(DISSOLVE + (1 - u) * 1.6, DISSOLVE + (1 - u) * 1.6 + 2.6, tau);
        const rr = r0 * (1 + gone * 0.9);
        const yy = y0 + gone * 9;
        const thh = th + gone * 2.2;
        _pos.set(Math.cos(thh) * rr, yy, Math.sin(thh) * rr);

        // La carta mira hacia afuera e inclinada con la pendiente del embudo.
        const slope = (7.2 * 1.5 * Math.pow(u, 0.5) * rScale) / 10.2;
        _tgt.set(Math.cos(thh) * (rr + 1), yy - slope, Math.sin(thh) * (rr + 1));
        _m.lookAt(_tgt, _pos, _up);
        _q1.setFromRotationMatrix(_m);
        _q2.setFromAxisAngle(new THREE.Vector3(0, 0, 1), c.roll);
        _q1.multiply(_q2);
        let scale = c.s * appear * (1 - gone);

        if (c.isPhoto) {
          const f = focusEnv(tau, c.p);
          if (f > 0.001) {
            const e = f * f * (3 - 2 * f);
            _m.lookAt(camera.position, _stage, _up);
            _q2.setFromRotationMatrix(_m);
            _q2.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(time * 0.8) * 0.04));
            _q1.slerp(_q2, e);
            _pos.lerp(_stage, e);
            scale = lerp(scale, focusScale, e) * (1 - gone);
          }
        }
        c.group.position.copy(_pos);
        c.group.quaternion.copy(_q1);
        c.group.scale.setScalar(Math.max(0.0001, scale));
        c.group.visible = scale > 0.002;
        const o = 1 - gone;
        c.fm.opacity = o; c.bm.opacity = o;
        // Mientras una foto está al frente, el resto baja un poco su brillo.
        const dim = c.isPhoto && focusEnv(tau, c.p) > 0.5 ? 1 : 1 - 0.18 * anyFocus;
        c.fm.color.setScalar(dim); c.bm.color.setScalar(dim);
      }
    },
  };
}
