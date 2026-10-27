"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildFixtures } from "./fixtures";
import type { RoomConfig, SurfaceConfig, TileOption, WallKey } from "./types";
import { buildTileTextures, withRepeat, type TileTextureSet } from "./tileTexture";

export interface SceneApi {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** High-resolution PNG of the current view. */
  snapshot: (targetWidth: number) => Promise<Blob>;
  /** Moves the camera to a preset angle for the current room size. */
  setView: (view: CameraView) => void;
}

export type CameraView = "threeQuarter" | "front" | "top";

/** Camera position / target for a room of W × D × H metres. Back wall at z = -D/2, left wall at x = -W/2. */
function viewFor(view: CameraView, W: number, D: number, H: number) {
  const span = Math.max(W, D);
  switch (view) {
    case "front":
      return { pos: new THREE.Vector3(0, H * 0.55, D / 2 + span * 1.1), target: new THREE.Vector3(0, H * 0.4, 0) };
    case "top":
      return { pos: new THREE.Vector3(0.001, span * 1.9 + H, 0.001), target: new THREE.Vector3(0, 0, 0) };
    default: { // three quarter: from the front-right corner, a little above eye level, distance scaled to the room
      const target = new THREE.Vector3(-W * 0.04, H * 0.38, -D * 0.04);
      const dir = new THREE.Vector3(0.62, 0.34, 0.78).normalize();
      const dist = Math.hypot(W, D, H) * 0.98 + 0.55;
      return { pos: target.clone().addScaledVector(dir, dist), target };
    }
  }
}

interface Props {
  onReady?: (api: SceneApi | null) => void;
  room: RoomConfig;
  floor: SurfaceConfig;
  walls: Record<WallKey, SurfaceConfig>;
  onWallClick?: (wall: WallKey) => void;
  tiles: Map<string, TileOption>;
}

const PAINT = 0xf1efe9;

const imageCache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(url: string) {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous"; // textures served from cloud storage: needed to draw them on a canvas
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`texture ${url}`));
      img.src = url;
    });
    p.catch(() => imageCache.delete(url));
    imageCache.set(url, p);
  }
  return p;
}

function disposeGroup(group: THREE.Object3D) {
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.MeshStandardMaterial | undefined;
    if (mat) {
      mat.map?.dispose();
      mat.normalMap?.dispose();
      mat.roughnessMap?.dispose();
      mat.dispose();
    }
  });
}

export default function RoomScene({ room, floor, walls, tiles, onReady, onWallClick }: Props) {
  const roomRef = useRef(room);
  const wallClickRef = useRef(onWallClick);
  useEffect(() => {
    wallClickRef.current = onWallClick;
    roomRef.current = room;
  });
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    roomGroup: THREE.Group;
    framed: string;
  } | null>(null);

  // Scene, renderer, controls: created once.
  useEffect(() => {
    const mount = mountRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Neutral tone mapping keeps product colours faithful (ACES washed out pale tiles)
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdfe2e7);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc8bb, 0.6));
    const sun = new THREE.DirectionalLight(0xfff4e6, 1.5);
    sun.position.set(3.5, 5.5, 4.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -6;
    sun.shadow.camera.right = 6;
    sun.shadow.camera.top = 6;
    sun.shadow.camera.bottom = -6;
    sun.shadow.camera.far = 20;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.05, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.499;

    const roomGroup = new THREE.Group();
    scene.add(roomGroup);

    // Click a wall in the 3D view to select it (ignores drags used for orbiting).
    const raycaster = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return;
      const r = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1),
        camera
      );
      const hit = raycaster.intersectObjects(roomGroup.children, true)[0];
      let o: THREE.Object3D | null = hit?.object ?? null;
      while (o && !o.userData.wall) o = o.parent;
      if (o) wallClickRef.current?.(o.userData.wall as WallKey);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    stateRef.current = { scene, renderer, camera, controls, roomGroup, framed: "" };

    onReady?.({
      scene,
      camera,
      setView: (view) => {
        const r = roomRef.current;
        const v = viewFor(view, r.widthM, r.depthM, r.heightM);
        camera.position.copy(v.pos);
        controls.target.copy(v.target);
        controls.update();
      },
      snapshot: (targetWidth) =>
        new Promise<Blob>((resolve, reject) => {
          const w = mount.clientWidth, h = mount.clientHeight;
          const prevRatio = renderer.getPixelRatio();
          renderer.setPixelRatio(Math.min(4, Math.max(1, targetWidth / w)));
          renderer.setSize(w, h, false);
          renderer.render(scene, camera);
          renderer.domElement.toBlob((b) => {
            renderer.setPixelRatio(prevRatio);
            renderer.setSize(w, h);
            if (b) resolve(b);
            else reject(new Error("toBlob"));
          }, "image/png");
        }),
    });

    let raf = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      ro.disconnect();
      controls.dispose();
      disposeGroup(roomGroup);
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      stateRef.current = null;
      onReady?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Room: rebuilt whenever anything changes.
  useEffect(() => {
    let cancelled = false;
    const st = stateRef.current;
    if (!st) return;

    const load = async (s: SurfaceConfig) => {
      const tile = s.tileId != null ? tiles.get(s.tileId) : undefined;
      if (!tile) return null;
      try {
        const imgs = (await Promise.all(tile.images.map((u) => loadImage(u).catch(() => null)))).filter((i): i is HTMLImageElement => !!i);
        return imgs.length ? { tile, imgs } : null;
      } catch {
        return null;
      }
    };

    (async () => {
      const [fl, wb, wlft, wr, wf] = await Promise.all([load(floor), load(walls.back), load(walls.left), load(walls.right), load(walls.front)]);
      const wallRes = { back: wb, left: wlft, right: wr, front: wf };
      if (cancelled || !stateRef.current) return;
      const { roomGroup, camera, controls, renderer } = stateRef.current;
      const aniso = renderer.capabilities.getMaxAnisotropy();

      disposeGroup(roomGroup);
      roomGroup.clear();

      const { widthM: W, depthM: D, heightM: H } = room;
      const tiledH = Math.min(room.wallTiledM, H);

      const textureCache = new Map<string, TileTextureSet>();
      const tiledMaterial = (res: typeof fl, s: SurfaceConfig, wM: number, hM: number) => {
        if (!res) return new THREE.MeshStandardMaterial({ color: PAINT, roughness: 0.9 });
        const key = `${res.tile.id}|${s.layout}|${s.jointMm}|${s.jointColor}`;
        let set = textureCache.get(key);
        if (!set) textureCache.set(key, (set = buildTileTextures(res.imgs, res.tile, s, aniso)));
        const t = withRepeat(set, wM, hM);
        return new THREE.MeshStandardMaterial({
          map: t.map,
          normalMap: t.normalMap,
          normalScale: new THREE.Vector2(1, 1),
          roughnessMap: t.roughnessMap,
          roughness: 1,
          metalness: 0,
        });
      };
      const plane = (w: number, h: number, mat: THREE.Material) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        m.receiveShadow = true;
        return m;
      };

      // Floor
      const floorMesh = plane(W, D, tiledMaterial(fl, floor, W, D));
      floorMesh.receiveShadow = true;
      floorMesh.rotation.x = -Math.PI / 2;
      roomGroup.add(floorMesh);

      // Four walls, each with its own tile; single-sided so the ones facing the camera never hide the room.
      const addWall = (key: WallKey, len: number, place: (m: THREE.Object3D, y: number) => void) => {
        const group = new THREE.Group();
        group.userData.wall = key;
        if (tiledH > 0) {
          const t = plane(len, tiledH, tiledMaterial(wallRes[key], walls[key], len, tiledH));
          place(t, tiledH / 2);
          group.add(t);
        }
        if (tiledH < H) {
          const p = plane(len, H - tiledH, new THREE.MeshStandardMaterial({ color: PAINT, roughness: 0.9 }));
          place(p, tiledH + (H - tiledH) / 2);
          group.add(p);
        }
        roomGroup.add(group);
      };
      addWall("back", W, (m, y) => m.position.set(0, y, -D / 2));
      addWall("left", D, (m, y) => {
        m.rotation.y = Math.PI / 2;
        m.position.set(-W / 2, y, 0);
      });
      addWall("right", D, (m, y) => {
        m.rotation.y = -Math.PI / 2;
        m.position.set(W / 2, y, 0);
      });
      addWall("front", W, (m, y) => {
        m.rotation.y = Math.PI;
        m.position.set(0, y, D / 2);
      });

      // Skirting boards where the wall is painted down to the floor
      if (tiledH < 0.05) {
        const skirt = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const back = new THREE.Mesh(new THREE.BoxGeometry(W, 0.09, 0.015), skirt);
        back.position.set(0, 0.045, -D / 2 + 0.0075);
        const left = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.09, D), skirt);
        left.position.set(-W / 2 + 0.0075, 0.045, 0);
        roomGroup.add(back, left);
      }

      if (room.furniture) roomGroup.add(buildFixtures(room));

      // Re-frame the camera only when the room size changes.
      const key = `${room.type}-${W}-${D}-${H}`;
      if (stateRef.current.framed !== key) {
        stateRef.current.framed = key;
        const v = viewFor("threeQuarter", W, D, H);
        camera.position.copy(v.pos);
        controls.target.copy(v.target);
        controls.update();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [room, floor, walls, tiles]);

  return <div ref={mountRef} className="w-full h-full" />;
}
