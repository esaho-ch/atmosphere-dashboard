import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { RoomConfig, RoomStyle } from "./types";

// All builders work in a local frame: floor at y = 0, centred on x = 0,
// the side that touches the wall at z = 0 and the front facing +z.

interface Theme {
  cabinet: THREE.MeshStandardMaterial;
  worktop: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  handle: THREE.MeshStandardMaterial;
  ceramic: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  black: THREE.MeshStandardMaterial;
  mirror: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
  pot: THREE.MeshStandardMaterial;
  fabric: THREE.MeshStandardMaterial;
}

const std = (color: number, roughness = 0.6, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function makeTheme(style: RoomStyle): Theme {
  const light = style === "light";
  return {
    cabinet: std(light ? 0xf3f1ec : 0x2c2f33, 0.55),
    worktop: std(light ? 0xd9d6cf : 0x1d1f22, light ? 0.4 : 0.3),
    wood: std(light ? 0xb48b64 : 0x6e4a2e, 0.65),
    handle: std(light ? 0x2a2a2a : 0xc9a96a, 0.35, 0.8),
    ceramic: std(0xffffff, 0.12),
    chrome: std(0xd6d8da, 0.22, 0.85),
    steel: std(0xc4c7ca, 0.38, 0.45),
    black: std(0x17181a, 0.4, 0.3),
    mirror: new THREE.MeshStandardMaterial({ color: 0xe4ecf0, roughness: 0.12, metalness: 0.55 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe6ee, roughness: 0.05, transparent: true, opacity: 0.22 }),
    leaf: std(0x3f7d4a, 0.8),
    pot: std(light ? 0xe9e4da : 0x3a3a3a, 0.7),
    fabric: std(light ? 0x7d8c8a : 0x8a6f5a, 0.95),
  };
}

class Part {
  readonly group = new THREE.Group();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rot?: [number, number, number]) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(...rot);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }
  box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
    return this.add(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  }
  round(w: number, h: number, d: number, r: number, mat: THREE.Material, x: number, y: number, z: number) {
    return this.add(new RoundedBoxGeometry(w, h, d, 4, r), mat, x, y, z);
  }
  cyl(rt: number, rb: number, h: number, mat: THREE.Material, x: number, y: number, z: number, rot?: [number, number, number], seg = 24) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, rot);
  }
}

// ── Shared small pieces ─────────────────────────────────────────────────────

function tap(p: Part, t: Theme, x: number, y: number, z: number, height = 0.2, reach = 0.14) {
  p.cyl(0.018, 0.022, height, t.chrome, x, y + height / 2, z);
  p.cyl(0.013, 0.013, reach, t.chrome, x, y + height, z + reach / 2, [Math.PI / 2, 0, 0]);
  p.cyl(0.008, 0.008, 0.07, t.chrome, x + 0.045, y + height * 0.25, z, [0, 0, Math.PI / 2]);
}

function plant(t: Theme, scale = 1) {
  const p = new Part();
  p.cyl(0.14 * scale, 0.1 * scale, 0.28 * scale, t.pot, 0, 0.14 * scale, 0);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = p.add(new THREE.ConeGeometry(0.07 * scale, 0.55 * scale, 8), t.leaf,
      Math.cos(a) * 0.07 * scale, 0.55 * scale, Math.sin(a) * 0.07 * scale,
      [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]);
    leaf.scale.z = 0.5;
  }
  return p.group;
}

function mirror(t: Theme, w: number, h: number) {
  const p = new Part();
  p.box(w + 0.04, h + 0.04, 0.02, t.black, 0, 0, 0.01);
  p.box(w, h, 0.01, t.mirror, 0, 0, 0.025);
  p.group.position.y = 0;
  return p.group;
}

function toilet(t: Theme) {
  const p = new Part();
  p.round(0.4, 0.42, 0.2, 0.03, t.ceramic, 0, 0.62, 0.1);
  p.round(0.37, 0.05, 0.19, 0.02, t.ceramic, 0, 0.855, 0.1);
  p.box(0.07, 0.012, 0.03, t.chrome, 0, 0.865, 0.1);
  const bowl = p.cyl(0.19, 0.12, 0.4, t.ceramic, 0, 0.22, 0.4, undefined, 32);
  bowl.scale.set(1, 1, 1.55);
  const seat = p.cyl(0.19, 0.19, 0.03, t.ceramic, 0, 0.415, 0.4, undefined, 32);
  seat.scale.set(1, 1, 1.5);
  const lid = p.cyl(0.175, 0.175, 0.025, t.ceramic, 0, 0.44, 0.4, undefined, 32);
  lid.scale.set(1, 1, 1.45);
  p.box(0.14, 0.2, 0.22, t.ceramic, 0, 0.1, 0.18);
  return p.group;
}

// ── Kitchen ─────────────────────────────────────────────────────────────────

function cabinetRun(t: Theme, len: number) {
  const p = new Part();
  const n = Math.max(1, Math.round(len / 0.6));
  const w = len / n;
  p.box(len - 0.02, 0.1, 0.52, t.black, 0, 0.05, 0.28); // plinth
  p.box(len, 0.76, 0.58, t.cabinet, 0, 0.48, 0.29);
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + w * (i + 0.5);
    p.box(w - 0.012, 0.7, 0.02, t.cabinet, x, 0.48, 0.595);
    p.box(w * 0.5, 0.012, 0.014, t.handle, x, 0.78, 0.62);
  }
  p.box(len + 0.02, 0.04, 0.62, t.worktop, 0, 0.88, 0.31);

  // sink
  const sx = -len * 0.28;
  p.box(0.5, 0.012, 0.38, t.chrome, sx, 0.903, 0.33);
  p.box(0.44, 0.004, 0.32, t.black, sx, 0.909, 0.33);
  tap(p, t, sx, 0.9, 0.12, 0.26, 0.16);
  // hob
  const hx = len * 0.25;
  p.box(0.58, 0.008, 0.5, t.black, hx, 0.904, 0.31);
  for (const [dx, dz, r] of [[-0.14, -0.1, 0.07], [0.14, -0.1, 0.055], [-0.14, 0.11, 0.055], [0.14, 0.11, 0.07]] as const) {
    p.add(new THREE.TorusGeometry(r, 0.006, 8, 24), t.chrome, hx + dx, 0.912, 0.31 + dz, [Math.PI / 2, 0, 0]);
  }
  // upper cabinets and hood
  const upLen = len * 0.42;
  const ux = -len / 2 + upLen / 2;
  const un = Math.max(1, Math.round(upLen / 0.6));
  p.box(upLen, 0.7, 0.34, t.cabinet, ux, 1.85, 0.17);
  for (let i = 0; i < un; i++) {
    const x = ux - upLen / 2 + (upLen / un) * (i + 0.5);
    p.box(upLen / un - 0.012, 0.68, 0.02, t.cabinet, x, 1.85, 0.345);
    p.box(0.012, 0.18, 0.014, t.handle, x + 0.1, 1.6, 0.37);
  }
  const hood = p.add(new THREE.CylinderGeometry(0.2, 0.42, 0.28, 4, 1), t.steel, hx, 1.4, 0.3, [0, Math.PI / 4, 0]);
  hood.scale.set(1, 1, 0.75);
  p.box(0.18, 0.7, 0.18, t.steel, hx, 1.9, 0.14);
  return p.group;
}

function fridge(t: Theme) {
  const p = new Part();
  p.round(0.6, 1.85, 0.62, 0.02, t.steel, 0, 0.925, 0.31);
  p.box(0.6, 0.012, 0.003, t.black, 0, 1.18, 0.623);
  p.box(0.012, 0.5, 0.03, t.black, 0.24, 1.5, 0.64);
  p.box(0.012, 0.3, 0.03, t.black, 0.24, 0.9, 0.64);
  return p.group;
}

function island(t: Theme) {
  const p = new Part();
  p.box(1.8, 0.86, 0.85, t.cabinet, 0, 0.43, 0);
  p.box(1.9, 0.04, 0.95, t.worktop, 0, 0.88, 0);
  p.box(1.6, 0.012, 0.014, t.handle, 0, 0.78, 0.436);
  for (const x of [-0.45, 0.45]) {
    p.cyl(0.19, 0.19, 0.05, t.wood, x, 0.66, 0.85);
    p.cyl(0.02, 0.02, 0.62, t.black, x, 0.32, 0.85);
    p.cyl(0.15, 0.15, 0.02, t.black, x, 0.01, 0.85);
  }
  return p.group;
}

// ── Bathroom ────────────────────────────────────────────────────────────────

function bathtub(t: Theme) {
  const p = new Part();
  p.round(1.7, 0.58, 0.75, 0.12, t.ceramic, 0, 0.29, 0.375);
  p.round(1.5, 0.04, 0.55, 0.1, std(0xd9e4e8, 0.1), 0, 0.575, 0.38);
  tap(p, t, -0.6, 0.58, 0.04, 0.12, 0.12);
  p.cyl(0.012, 0.012, 1.1, t.chrome, 0.55, 1.35, 0.03);
  p.cyl(0.011, 0.011, 0.18, t.chrome, 0.55, 1.85, 0.1, [Math.PI / 2, 0, 0]);
  p.cyl(0.09, 0.07, 0.02, t.chrome, 0.55, 1.83, 0.2);
  const screen = p.box(0.01, 1.5, 0.78, t.glass, 0.85, 1.33, 0.39);
  screen.castShadow = false;
  return p.group;
}

function vanity(t: Theme, w = 0.9) {
  const p = new Part();
  p.box(w, 0.5, 0.46, t.wood, 0, 0.5, 0.23);
  p.box(w - 0.02, 0.012, 0.02, t.handle, 0, 0.67, 0.47);
  p.box(w + 0.02, 0.04, 0.5, t.ceramic, 0, 0.77, 0.25);
  const basin = p.cyl(0.19, 0.17, 0.08, t.ceramic, 0, 0.83, 0.26, undefined, 32);
  basin.scale.set(1.3, 1, 1);
  tap(p, t, 0, 0.79, 0.08, 0.2, 0.14);
  const m = mirror(t, w * 0.85, 0.85);
  m.position.set(0, 1.55, 0);
  p.group.add(m);
  p.box(w * 0.85, 0.03, 0.08, t.black, 0, 2.05, 0.05); // light bar
  return p.group;
}

function towelRadiator(t: Theme) {
  const p = new Part();
  p.cyl(0.015, 0.015, 1.1, t.black, -0.25, 1.1, 0.06);
  p.cyl(0.015, 0.015, 1.1, t.black, 0.25, 1.1, 0.06);
  for (let i = 0; i < 8; i++) p.cyl(0.011, 0.011, 0.5, t.black, 0, 0.6 + i * 0.14, 0.06, [0, 0, Math.PI / 2], 12);
  const towel = p.box(0.46, 0.5, 0.02, t.fabric, 0, 1.05, 0.09);
  towel.castShadow = true;
  return p.group;
}

// ── WC ──────────────────────────────────────────────────────────────────────

function handBasin(t: Theme) {
  const p = new Part();
  p.round(0.42, 0.16, 0.26, 0.05, t.ceramic, 0, 0.9, 0.13);
  p.box(0.34, 0.008, 0.18, std(0xd9e4e8, 0.1), 0, 0.98, 0.14);
  tap(p, t, 0, 0.98, 0.04, 0.16, 0.11);
  const m = mirror(t, 0.5, 0.65);
  m.position.set(0, 1.55, 0);
  p.group.add(m);
  return p.group;
}

function shelf(t: Theme, w = 0.6) {
  const p = new Part();
  p.box(w, 0.03, 0.18, t.wood, 0, 0, 0.09);
  p.cyl(0.04, 0.035, 0.1, t.pot, -w * 0.3, 0.065, 0.1);
  p.cyl(0.03, 0.03, 0.13, t.black, w * 0.1, 0.08, 0.1);
  p.box(0.14, 0.1, 0.03, t.fabric, w * 0.3, 0.065, 0.1);
  return p.group;
}

// ── Assembly ────────────────────────────────────────────────────────────────

export function buildFixtures(room: RoomConfig): THREE.Group {
  const out = new THREE.Group();
  const t = makeTheme(room.style);
  const { widthM: W, depthM: D } = room;

  const onBack = (g: THREE.Object3D, x: number, y = 0) => {
    g.position.set(x, y, -D / 2);
    out.add(g);
  };
  const onLeft = (g: THREE.Object3D, z: number, y = 0) => {
    g.rotation.y = Math.PI / 2;
    g.position.set(-W / 2, y, z);
    out.add(g);
  };
  const free = (g: THREE.Object3D, x: number, z: number, ry = 0) => {
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    out.add(g);
  };

  if (room.type === "kitchen") {
    const fr = fridge(t);
    onBack(fr, -W / 2 + 0.31);
    const len = Math.min(W - 0.62 - 0.01, 3.2);
    onBack(cabinetRun(t, len), -W / 2 + 0.62 + len / 2);
    if (D >= 2.8) free(island(t), -W / 2 + 0.62 + len / 2, -D / 2 + 0.6 + 1.1 + 0.42);
    free(plant(t, 1.2), -W / 2 + 0.3, D / 2 - 0.3);
  } else if (room.type === "bathroom") {
    onBack(bathtub(t), -W / 2 + 0.85);
    onBack(vanity(t, Math.min(0.9, W - 2.0)), W / 2 - 0.5, 0);
    onLeft(toilet(t), Math.min(-D / 2 + 0.75 + 0.5, D / 2 - 0.9) + 0.0);
    onLeft(towelRadiator(t), D / 2 - 0.4);
    free(plant(t, 0.9), -W / 2 + 0.25, D / 2 - 0.3);
  } else {
    onBack(toilet(t), 0.15);
    onBack(shelf(t, 0.7), 0.15, 1.45);
    onLeft(handBasin(t), 0.0);
    free(plant(t, 0.9), -W / 2 + 0.25, D / 2 - 0.3);
  }
  return out;
}
