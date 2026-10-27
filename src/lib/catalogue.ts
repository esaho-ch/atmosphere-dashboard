import fs from "fs";
import path from "path";
import { convertToJpeg } from "./localSources";
import { published } from "./published";

/**
 * Catalogue of tiles built straight from the supplier picture folders in data/, independent of Bexio:
 * every tile (series + colour + format) found in the files becomes a selectable tile in the 3D viewer.
 * Several pictures of the same tile ("faces") are kept so each tile can look different.
 */
const DATA = path.join(/*turbopackIgnore: true*/ process.cwd(), "data");

/**
 * Folder with the supplier pictures (e.g. in OneDrive). Its path lives in data/local-sources.json
 * ({ "photosFournisseur": "/absolute/path" }) so that it is read at run time and never bundled with the app.
 */
function photosDir(): string {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(DATA, "local-sources.json"), "utf-8"));
    if (typeof cfg.photosFournisseur === "string") return cfg.photosFournisseur;
  } catch {}
  return path.join(DATA, "photos-fournisseur");
}

export interface CatalogueEntry {
  id: string;
  supplier: string;
  series: string;
  colour: string;
  widthCm: number;
  heightCm: number;
  finish: "matt" | "satin" | "gloss";
  variation: number;
  files: string[];
  /** Supplier product codes found in the file names (= Bexio "deliverer_code"): exact link to Bexio articles. */
  skus?: string[];
  /** Set when the tile comes from the published manifest (production): direct links, no local files. */
  images?: string[];
  thumb?: string;
}

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();
const IMG = /\.(tiff?|jpe?g|png)(\.jpe?g)?$/i;
const SIZE = /(\d{1,3}(?:[.,]\d)?)\s*[xX]\s*(\d{1,3}(?:[.,]\d)?)/;
const num = (s: string) => parseFloat(s.replace(",", "."));

function walk(dir: string, out: string[] = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const p = path.join(dir, name);
    let st: fs.Stats;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (IMG.test(name)) out.push(p);
  }
  return out;
}

function finishOf(text: string): CatalogueEntry["finish"] {
  const t = text.toUpperCase();
  if (/LAPP|POLISH|GLOSS|BRILL|LUCID|LUX/.test(t)) return "gloss";
  if (/VELVET|SATIN|SOFT|SILK/.test(t)) return "satin";
  return "matt";
}

type Draft = Omit<CatalogueEntry, "id">;

function add(map: Map<string, Draft>, key: string, d: Omit<Draft, "files">, file: string, sku?: string) {
  const e = map.get(key) ?? { ...d, files: [] };
  e.files.push(file);
  if (sku) e.skus = [...new Set([...(e.skus ?? []), sku.toUpperCase()])];
  map.set(key, e);
}

// ── Navarti: <series>/<SERIES COLOUR WxH>.tif ───────────────────────────────

const SKIP_NAVARTI = /^(a|amb|rlv)[\s_-]|escalera|malla|cocina|bano|baño|muretto|tono|copia|cmyk|ambiente|rodapie|zocalo|peldano/i;

function navarti(): Draft[] {
  const root = path.join(DATA, "navarti-tiff-source");
  const map = new Map<string, Draft>();
  if (!fs.existsSync(root)) return [];
  for (const folder of fs.readdirSync(root)) {
    const dir = path.join(root, folder);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!IMG.test(file) || SKIP_NAVARTI.test(file)) continue;
      const base = file.replace(/\.[^.]+$/, "");
      const m = base.match(SIZE);
      if (!m) continue;
      const seriesWords = slug(folder).split(" ");
      const colour = slug(base.replace(SIZE, " ").replace(/\(\d+\)|_\d+$/g, " "))
        .split(" ").filter((t) => t && !seriesWords.includes(t)).join(" ");
      if (!colour) continue;
      const w = num(m[1]), h = num(m[2]);
      add(map, `${slug(folder)}|${colour}|${w}x${h}`, {
        supplier: "Navarti", series: title(folder), colour: title(colour), widthCm: w, heightCm: h,
        finish: finishOf(base), variation: 2,
      }, path.join(dir, file));
    }
  }
  // one picture per tile: duplicates in these folders are other versions of the same file
  return [...map.values()].map((d) => ({ ...d, files: d.files.slice(0, 1) }));
}

// ── Lamour (Recer): flat folder "Lamour <pattern> <colour> M20x20.tif" ──────

function lamour(): Draft[] {
  const root = path.join(DATA, "lamour-tiff-source");
  const out: Draft[] = [];
  if (!fs.existsSync(root)) return out;
  for (const file of fs.readdirSync(root)) {
    if (!IMG.test(file)) continue;
    const base = file.replace(/\.[^.]+$/, "");
    const m = base.match(SIZE);
    if (!m) continue;
    const colour = slug(base.replace(/\bM?\d+\s*[xX]\s*\d+/g, " ")).split(" ").filter((t) => t && t !== "lamour").join(" ");
    out.push({
      supplier: "Recer", series: "Lamour", colour: title(colour), widthCm: num(m[1]), heightCm: num(m[2]),
      finish: "satin", variation: 1, files: [path.join(root, file)],
    });
  }
  return out;
}

// ── Atlas Concorde: [A9Q6_]AtlasConcorde_<Collection>_<Colour>_<WxH>_<Finish>_[SKU_]<n>.jpg ──

function atlas(): Draft[] {
  const root = photosDir();
  const map = new Map<string, Draft>();
  if (!fs.existsSync(root)) return [];
  for (const dirName of fs.readdirSync(root)) {
    if (!/^Cumulative/i.test(dirName)) continue;
    for (const file of walk(path.join(root, dirName))) {
      const raw = path.basename(file).replace(/(\.tif)?\.(jpe?g|png)$/i, "");
      const prefixSku = raw.match(/^([A-Z0-9]{4})_(?=AtlasConcorde)/)?.[1];
      const base = raw.replace(/^[A-Z0-9]{4}_(?=AtlasConcorde)/, "");
      const parts = base.split("_");
      if (parts[0] !== "AtlasConcorde" || parts.length < 5) continue;
      const [, collection, colour, size, fin] = parts;
      const m = size.match(SIZE);
      if (!m) continue;
      const series = collection.replace(/([a-z])([A-Z])/g, "$1 $2");
      add(map, `${collection}|${colour}|${size}|${fin}`, {
        supplier: "Atlas Concorde", series, colour: title(colour), widthCm: num(m[1]), heightCm: num(m[2]),
        finish: finishOf(fin), variation: 4,
      }, file, prefixSku ?? parts.slice(5).find((p) => /^[A-Z0-9]{4}$/.test(p)));
    }
  }
  return [...map.values()].map((d) => ({ ...d, files: d.files.sort() }));
}

// ── "Programmi fotoinserimento" (Tuscania): <effect>/<series>/…/<colour + size folders>/<SKU>@<n>.jpg ──

const CODE = /^[A-Z]\d[A-Z]\d$/;
const NOISE = new Set(["r", "rs", "ns", "out", "fp2", "ok", "minimali", "mod", "ds", "chevron", "1", "2", "cm"]);

function fotoinserimento(): Draft[] {
  const root = photosDir();
  const map = new Map<string, Draft>();
  if (!fs.existsSync(root)) return [];
  // packs sit in the root or inside a "tuscania" folder (Drive downloads split them into numbered parts)
  const bases = [root, path.join(root, "tuscania")].filter((d) => fs.existsSync(d))
    .flatMap((d) => fs.readdirSync(d).map((n) => path.join(d, n)))
    .filter((p) => /^001 - PROGRAMMI/i.test(path.basename(p)) && !p.endsWith(".zip") && fs.statSync(p).isDirectory());
  for (const base of bases) {
    for (const file of walk(base)) {
      const rel = path.relative(base, file).split(path.sep);
      if (rel.length < 3) continue;
      const series = rel[1];
      const segs = [...rel.slice(2, -1), rel[rel.length - 1].replace(/\.[^.]+$/, "")];
      const sizeSeg = [...segs].reverse().find((s) => SIZE.test(s));
      const m = sizeSeg?.match(SIZE) ?? segs.join(" ").match(SIZE);
      if (!m) continue;
      const seriesWords = slug(series).split(" ");
      const words = (s: string) => slug(s.replace(SIZE, " ").replace(/\d+\s*cm/gi, " ")).split(" ")
        .filter((t) => t && !seriesWords.includes(t) && !NOISE.has(t) && !CODE.test(t.toUpperCase()) && !/^\d+$/.test(t));
      // colour: words of the deepest folder that carries the size, else of the folder that follows it
      const idx = sizeSeg ? segs.lastIndexOf(sizeSeg) : -1;
      let colour = idx >= 0 ? words(segs[idx]).join(" ") : "";
      if (!colour) for (let i = Math.max(0, idx + 1); i < segs.length - 1 && !colour; i++) colour = words(segs[i]).join(" ");
      if (!colour) colour = "unico";
      // same SKU = same tile, even when Drive split its pictures over several numbered parts
      const sku = path.basename(file).match(/^([A-Z]\d[A-Z]\d)(?=[@.])/)?.[1];
      const key = `${series}|${colour}|${num(m[1])}x${num(m[2])}|${sku ?? rel.slice(0, -1).join("/")}`;
      add(map, key, {
        supplier: "Tuscania", series: title(series.replace(/_/g, " ").replace(/\b(minimali|fp2)\b/gi, "").replace(/\s+/g, " ")), colour: title(colour), widthCm: num(m[1]), heightCm: num(m[2]),
        finish: finishOf(segs.join(" ")), variation: 3,
      }, file, sku);
    }
  }
  return [...map.values()].filter((d) => d.files.length > 0).map((d) => ({ ...d, files: d.files.sort() }));
}

// ── Index ───────────────────────────────────────────────────────────────────

let cache: { at: number; entries: CatalogueEntry[] } | null = null;

export function loadCatalogue(): CatalogueEntry[] {
  if (cache && Date.now() - cache.at < 60_000) return cache.entries;
  const drafts = [...navarti(), ...lamour(), ...atlas(), ...fotoinserimento()];
  const seen = new Set<string>();
  const entries: CatalogueEntry[] = [];
  for (const d of drafts) {
    let id = `cat-${slug(d.supplier)}-${slug(d.series)}-${slug(d.colour)}-${d.widthCm}x${d.heightCm}`.replace(/\s+/g, "-");
    let n = 2;
    while (seen.has(id)) id = `${id.replace(/-\d+$/, "")}-${n++}`; // different pictures of the same name
    seen.add(id);
    entries.push({ id, ...d });
  }
  if (entries.length === 0 && published.catalogue.length > 0) {
    // production: no supplier folders, use what was published to cloud storage
    for (const t of published.catalogue) {
      entries.push({ ...t, files: [] });
    }
  }
  entries.sort((a, b) => a.supplier.localeCompare(b.supplier) || a.series.localeCompare(b.series) || a.colour.localeCompare(b.colour));
  cache = { at: Date.now(), entries };
  return entries;
}

/** Web-sized JPEG of face `n` of a catalogue tile, converted once and cached on disk. */
export async function catalogueImage(id: string, n: number): Promise<Buffer | null> {
  const entry = loadCatalogue().find((e) => e.id === id);
  const file = entry?.files[n];
  if (!file) return null;
  return convertToJpeg(file);
}

export const catalogueFaceCount = (e: CatalogueEntry) => Math.min(e.images?.length ?? e.files.length, 6);

/** Catalogue tile whose file names carry this supplier code (Bexio "deliverer_code"), e.g. Atlas "A9Q6" or Tuscania "L9S1". */
export function findBySku(sku: string, supplierHint?: RegExp): CatalogueEntry | null {
  const code = sku.trim().toUpperCase();
  if (code.length < 4) return null;
  const hits = loadCatalogue().filter((e) => e.skus?.includes(code) && (!supplierHint || supplierHint.test(e.supplier)));
  return hits[0] ?? null;
}

/**
 * Fallback when no supplier code matches: same collection and colour, closest format.
 * The texture of a colour is the same whatever the size, so a different format is still a correct picture.
 */
export function findByName(supplierHint: RegExp, series: string, colour: string, widthCm: number | null, heightCm: number | null): CatalogueEntry | null {
  const s = slug(series);
  const colourTokens = slug(colour).split(" ").filter(Boolean);
  if (!s || colourTokens.length === 0) return null;
  let best: { e: CatalogueEntry; score: number } | null = null;
  for (const e of loadCatalogue()) {
    if (!supplierHint.test(e.supplier) || slug(e.series) !== s) continue;
    const tokens = slug(e.colour).split(" ");
    const ok = colourTokens.every((c) => tokens.some((t) => t.length >= 3 && (t.startsWith(c.slice(0, 4)) || c.startsWith(t.slice(0, 4)))));
    if (!ok) continue;
    let score = 0;
    if (widthCm && heightCm) {
      if ((e.widthCm === widthCm && e.heightCm === heightCm) || (e.widthCm === heightCm && e.heightCm === widthCm)) score += 10;
      else if (Math.abs(e.widthCm / e.heightCm - widthCm / heightCm) < 0.03 || Math.abs(e.widthCm / e.heightCm - heightCm / widthCm) < 0.03) score += 4;
    }
    score += Math.min(e.files.length, 6) * 0.2 + Math.max(e.widthCm, e.heightCm) / 1000; // more faces and bigger pictures first
    if (!best || score > best.score) best = { e, score };
  }
  return best?.e ?? null;
}
