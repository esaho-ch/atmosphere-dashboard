export interface TileOption {
  id: string;
  /** Picture(s) of the tile: several faces make each tile in the room look different. */
  images: string[];
  /** Small picture for lists. */
  thumb: string;
  name: string;
  detail: string;
  widthCm: number;
  heightCm: number;
  finish: "matt" | "satin" | "gloss";
  /** Supplier shade variation, 1 (uniform) to 4 (very varied). */
  variation: number;
}

export type Layout = "straight" | "half" | "third";

export interface SurfaceConfig {
  tileId: string | null;
  layout: Layout;
  jointMm: number;
  jointColor: string;
}

export type RoomType = "kitchen" | "bathroom" | "toilet";

export type RoomStyle = "light" | "dark";

export interface RoomConfig {
  style: RoomStyle;
  type: RoomType;
  widthM: number;
  depthM: number;
  heightM: number;
  wallTiledM: number;
  furniture: boolean;
}

export const ROOM_PRESETS: Record<RoomType, { label: string; widthM: number; depthM: number; heightM: number; wallTiledM: number }> = {
  kitchen:  { label: "Cuisine",       widthM: 4.0, depthM: 3.0, heightM: 2.5, wallTiledM: 1.5 },
  bathroom: { label: "Salle de bain", widthM: 2.8, depthM: 2.2, heightM: 2.5, wallTiledM: 2.5 },
  toilet:   { label: "WC",            widthM: 1.6, depthM: 1.2, heightM: 2.5, wallTiledM: 1.2 },
};

export const LAYOUT_LABEL: Record<Layout, string> = {
  straight: "Pose droite",
  half: "Décalé 1/2",
  third: "Décalé 1/3",
};

export type WallKey = "back" | "left" | "right" | "front";
export type SurfaceKey = "floor" | WallKey;

export const WALL_KEYS: WallKey[] = ["back", "left", "right", "front"];

export const SURFACE_LABEL: Record<SurfaceKey, string> = {
  floor: "Sol",
  back: "Fond",
  left: "Gauche",
  right: "Droite",
  front: "Devant",
};
