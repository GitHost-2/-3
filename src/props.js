// Árboles, molino de viento y fardos: geometría de pocos polígonos con luz real de three.js.
import * as THREE from 'three';
import { heightAt, CAM_Z } from './terrain.js';
import { mulberry32, noise2 } from './noise.js';
import { SUN_AZ } from './env.js';

function blob(radius, detail, amount) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // El desplazamiento depende solo de la posición: los vértices repetidos se mueven igual.
    const k = 1 + (noise2(v.x * 1.7 + 11, v.y * 1.7 + v.z * 1.3) - 0.5) * amount;
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, flatShading: true });

export function createProps(scene) {
  const rng = mulberry32(555);
  const group = new THREE.Group();
  scene.add(group);

  const trunkMat = mat('#4a3322');
  const leaves = [mat('#4d7b2d'), mat('#5b8a35'), mat('#426d2a')];
  const pineMat = [mat('#2d5638'), mat('#366343')];
  const poplarMat = mat('#587c2a');

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.4, 3.4, 6);
  trunkGeo.translate(0, 1.7, 0);
  const oakBlobs = [blob(2.3, 1, 0.35), blob(1.6, 1, 0.35), blob(1.7, 1, 0.35), blob(1.5, 1, 0.35)];
  const pineCones = [new THREE.ConeGeometry(1.9, 2.6, 7), new THREE.ConeGeometry(1.5, 2.3, 7), new THREE.ConeGeometry(1.0, 2.1, 7)];
  const poplarGeo = new THREE.IcosahedronGeometry(1, 1);
  poplarGeo.scale(0.85, 3.3, 0.85);

  function oak(scale) {
    const t = new THREE.Group();
    t.add(new THREE.Mesh(trunkGeo, trunkMat));
    const spots = [[0, 4.4, 0], [1.5, 3.7, 0.4], [-1.4, 3.8, -0.5], [0.2, 5.6, 0.3]];
    spots.forEach((s, i) => {
      const m = new THREE.Mesh(oakBlobs[i], leaves[i % 3]);
      m.position.set(...s);
      t.add(m);
    });
    t.scale.setScalar(scale);
    return t;
  }

  function pine(scale) {
    const t = new THREE.Group();
    const tr = new THREE.Mesh(trunkGeo, trunkMat);
    tr.scale.set(0.8, 0.9, 0.8);
    t.add(tr);
    [2.9, 4.3, 5.7].forEach((y, i) => {
      const m = new THREE.Mesh(pineCones[i], pineMat[i % 2]);
      m.position.y = y + 0.4;
      t.add(m);
    });
    t.scale.setScalar(scale);
    return t;
  }

  function poplar(scale) {
    const t = new THREE.Group();
    const tr = new THREE.Mesh(trunkGeo, trunkMat);
    tr.scale.set(0.7, 0.7, 0.7);
    t.add(tr);
    const m = new THREE.Mesh(poplarGeo, poplarMat);
    m.position.y = 5.3;
    t.add(m);
    t.scale.setScalar(scale);
    return t;
  }

  function put(obj, x, z, ry = rng() * Math.PI * 2) {
    obj.position.set(x, heightAt(x, z) - 0.15, z);
    obj.rotation.y = ry;
    group.add(obj);
  }

  // Árboles que enmarcan la vista.
  put(oak(1.3), -12, -15);
  put(oak(1.1), -21, -33);
  [[41, -62, 1.5], [46, -68, 1.25], [37, -74, 1.7], [50, -80, 1.3]].forEach(([x, z, s]) => put(pine(s), x, z));
  [[22, -48, 1.2], [25, -52, 1.0], [-30, -46, 1.1]].forEach(([x, z, s]) => put(poplar(s), x, z));

  // Setos y bosquecillos lejanos: siluetas contra el resplandor.
  for (let i = 0; i < 46; i++) {
    const ang = (rng() * 2 - 1) * 1.0;
    const dist = 90 + rng() * 230;
    if (Math.abs(ang - SUN_AZ) < 0.07 && rng() < 0.7) continue;
    const x = Math.sin(ang) * dist, z = CAM_Z - Math.cos(ang) * dist;
    const k = rng();
    const s = (1.0 + rng() * 0.9) * (1 + dist / 260);
    put(k < 0.45 ? oak(s) : k < 0.8 ? pine(s) : poplar(s), x, z);
  }

  // Molino de viento.
  const mill = new THREE.Group();
  const plaster = mat('#dcd2ba'), wood = mat('#6b4129'), stone = mat('#7b6b5a'), cloth = mat('#f0e8d4');
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.8, 0.9, 10), stone);
  foot.position.y = 0.45;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.5, 7, 10), plaster);
  tower.position.y = 4.2;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.4, 10), wood);
  cap.position.y = 8.9;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.2), wood);
  door.position.set(0, 1.7, 2.45);
  mill.add(foot, tower, cap, door);

  const blades = new THREE.Group();
  blades.position.set(0, 7.6, 2.1);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 8), wood);
  hub.rotation.x = Math.PI / 2;
  blades.add(hub);
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group();
    arm.rotation.z = (k * Math.PI) / 2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 8.4, 0.14), wood);
    beam.position.y = 4.4;
    const sail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4.2, 0.05), cloth);
    sail.position.set(0.85, 5.0, 0.06);
    arm.add(beam, sail);
    blades.add(arm);
  }
  mill.add(blades);
  put(mill, 6, -66, 0.18);

  // Fardos de paja en primer plano.
  const hay = mat('#c9a64a');
  const bale = new THREE.CylinderGeometry(0.7, 0.7, 1.3, 14);
  [[10.5, -9, 0.2], [12.2, -10.4, 1.1], [7.5, -22, 0.6]].forEach(([x, z, r]) => {
    const m = new THREE.Mesh(bale, hay);
    m.rotation.z = Math.PI / 2;
    const holder = new THREE.Group();
    holder.add(m);
    m.position.y = 0.7;
    put(holder, x, z, r);
  });

  return {
    update(dt) {
      blades.rotation.z -= dt * 0.55;
    },
  };
}
