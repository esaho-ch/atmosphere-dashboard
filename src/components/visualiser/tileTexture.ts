import * as THREE from "three";
import type { Layout, SurfaceConfig, TileOption } from "./types";

const ROW_COUNT: Record<Layout, number> = { straight: 1, half: 2, third: 3 };
const FINISH_ROUGHNESS = { matt: 0.72, satin: 0.45, gloss: 0.12 } as const;
/** Shade amplitude per supplier variation level (V1 = uniform … V4 = very varied). */
const VARIATION_AMP = [0, 0.03, 0.06, 0.1];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TileTextureSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  /** Size of one repeat of the maps, in cm. */
  cellW: number;
  cellH: number;
  roughness: number;
}

function canvasTexture(canvas: HTMLCanvasElement, srgb: boolean, anisotropy: number) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  return t;
}

/** Height map (white = tile surface, black = grout) → tangent-space normal map. */
function heightToNormal(height: HTMLCanvasElement, strength: number) {
  const w = height.width, h = height.height;
  const src = height.getContext("2d")!.getImageData(0, 0, w, h).data;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d")!;
  const dst = octx.createImageData(w, h);
  const H = (x: number, y: number) => src[((Math.min(h - 1, Math.max(0, y)) * w) + Math.min(w - 1, Math.max(0, x))) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      dst.data[i] = (-dx / len * 0.5 + 0.5) * 255;
      dst.data[i + 1] = (dy / len * 0.5 + 0.5) * 255; // image y runs downward, v upward
      dst.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      dst.data[i + 3] = 255;
    }
  }
  octx.putImageData(dst, 0, 0);
  return out;
}

/**
 * Builds a large repeatable patch of tiling (several tiles each way) so the same photo is not obviously repeated:
 * every tile gets its own shade, crop and orientation according to the supplier's variation level.
 */
export function buildTileTextures(imgs: HTMLImageElement[], tile: TileOption, s: SurfaceConfig, anisotropy: number): TileTextureSet {
  const jointCm = s.jointMm / 10;
  const pitchX = tile.widthCm + jointCm;
  const pitchY = tile.heightCm + jointCm;
  const layoutRows = ROW_COUNT[s.layout];

  const cols = Math.min(8, Math.max(2, Math.round(240 / pitchX)));
  const baseRows = Math.min(8, Math.max(2, Math.round(240 / pitchY)));
  const gridRows = Math.ceil(baseRows / layoutRows) * layoutRows;
  const cellW = cols * pitchX;
  const cellH = gridRows * pitchY;

  const px = Math.min(2048 / cellW, 2048 / cellH, 10);
  const W = Math.max(2, Math.round(cellW * px));
  const H = Math.max(2, Math.round(cellH * px));

  const color = document.createElement("canvas");
  color.width = W; color.height = H;
  const cctx = color.getContext("2d")!;
  cctx.fillStyle = s.jointColor;
  cctx.fillRect(0, 0, W, H);

  const height = document.createElement("canvas");
  height.width = W; height.height = H;
  const hctx = height.getContext("2d")!;
  hctx.fillStyle = "#000";
  hctx.fillRect(0, 0, W, H);

  const rough = document.createElement("canvas");
  rough.width = W; rough.height = H;
  const rctx = rough.getContext("2d")!;
  rctx.fillStyle = "#fff"; // grout is fully rough
  rctx.fillRect(0, 0, W, H);

  const roughness = FINISH_ROUGHNESS[tile.finish];
  const grey = Math.round(255 * roughness);
  // real faces already carry the variation: add only a light synthetic shade on top
  const amp = VARIATION_AMP[Math.min(4, Math.max(1, tile.variation)) - 1] * (imgs.length >= 3 ? 0.4 : 1);

  const tileAspect = tile.widthCm / tile.heightCm;
  const seedBase = [...tile.id].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7);

  const tw = tile.widthCm * px, th = tile.heightCm * px;
  const bevel = Math.max(1, 0.1 * px * 10 / 10); // ~1 mm edge

  const blurSupported = "filter" in hctx;

  for (let r = 0; r < gridRows; r++) {
    const shift = layoutRows > 1 ? ((r % layoutRows) / layoutRows) * pitchX : 0;
    // Canvas y runs downward, texture v runs upward: flip the row order.
    const y = (gridRows - 1 - r) * pitchY * px + (jointCm / 2) * px;
    for (let c = 0; c < cols; c++) {
      const rand = rng(seedBase + r * 131 + c * 17 + 1);
      const x0 = (c * pitchX + shift) * px + (jointCm / 2) * px;
      const shade = (rand() - 0.5) * 2 * amp;
      const warm = (rand() - 0.5) * amp;
      const rotate = tile.variation >= 3 && rand() < 0.5;
      const mirror = tile.variation >= 4 && rand() < 0.5;
      // each tile draws one of the supplier's faces, centre-cropped to the tile's proportions (never stretched)
      const img = imgs[imgs.length > 1 ? Math.floor(rand() * imgs.length) : 0];
      const imgAspect = img.naturalWidth / img.naturalHeight;
      let sw = img.naturalWidth, sh = img.naturalHeight;
      if (imgAspect > tileAspect) sw = sh * tileAspect;
      else sh = sw / tileAspect;
      const slackX = img.naturalWidth - sw, slackY = img.naturalHeight - sh;
      const sx = tile.variation >= 2 ? rand() * slackX : slackX / 2;
      const sy = tile.variation >= 2 ? rand() * slackY : slackY / 2;

      for (const x of [x0, x0 - W]) {
        if (x + tw < 0 || x > W) continue;
        cctx.save();
        cctx.beginPath();
        cctx.rect(x, y, tw, th);
        cctx.clip();
        cctx.translate(x + tw / 2, y + th / 2);
        if (rotate) cctx.rotate(Math.PI);
        if (mirror) cctx.scale(-1, 1);
        cctx.drawImage(img, sx, sy, sw, sh, -tw / 2, -th / 2, tw, th);
        cctx.restore();
        if (shade !== 0) {
          cctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade})`;
          cctx.fillRect(x, y, tw, th);
          cctx.fillStyle = warm > 0 ? `rgba(255,190,120,${warm})` : `rgba(120,170,255,${-warm})`;
          cctx.fillRect(x, y, tw, th);
        }

        // tile surface sits above the grout; soft edge = bevel
        hctx.fillStyle = "#fff";
        if (blurSupported) hctx.filter = `blur(${bevel}px)`;
        hctx.fillRect(x, y, tw, th);
        if (blurSupported) hctx.filter = "none";
        rctx.fillStyle = `rgb(${grey},${grey},${grey})`;
        rctx.fillRect(x, y, tw, th);
      }
    }
  }

  // ~1.2 mm of relief → strength proportional to the pixel density
  const normal = heightToNormal(height, Math.min(6, 0.12 * px * 10 / 2));

  return {
    map: canvasTexture(color, true, anisotropy),
    normalMap: canvasTexture(normal, false, anisotropy),
    roughnessMap: canvasTexture(rough, false, anisotropy),
    cellW,
    cellH,
    roughness,
  };
}

/** Clones the textures so each surface can have its own repeat while sharing the canvases. */
export function withRepeat(set: TileTextureSet, widthM: number, heightM: number) {
  const repeatX = (widthM * 100) / set.cellW;
  const repeatY = (heightM * 100) / set.cellH;
  const clone = (t: THREE.Texture) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.repeat.set(repeatX, repeatY);
    return c;
  };
  return { map: clone(set.map), normalMap: clone(set.normalMap), roughnessMap: clone(set.roughnessMap) };
}
