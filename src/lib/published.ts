import manifest from "../data/texture-manifest.json";

/**
 * Textures published to cloud storage (see scripts/publish-textures.mts).
 * On Vercel the supplier folders do not exist, so the app reads this manifest and the image links in it.
 */
export interface PublishedTile {
  id: string;
  supplier: string;
  series: string;
  colour: string;
  widthCm: number;
  heightCm: number;
  finish: "matt" | "satin" | "gloss";
  variation: number;
  images: string[];
  thumb: string;
}

export interface PublishedBexioTexture {
  url: string;
}

interface Manifest {
  generatedAt: string | null;
  catalogue: PublishedTile[];
  bexio: Record<string, PublishedBexioTexture>;
  textureIndex: Record<string, unknown>;
}

export const published = manifest as unknown as Manifest;
