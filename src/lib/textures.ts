import fs from "fs";
import path from "path";
import type { BexioArticle } from "./bexio";
import { convertToJpeg, matchLocalFile, sourceForSupplier, type LocalSource } from "./localSources";
import { published } from "./published";
import { findByName, findBySku } from "./catalogue";

const DATA_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
const INDEX_PATH = path.join(DATA_DIR, "textures.json");
const IMAGES_DIR = path.join(DATA_DIR, "textures");

export type TextureStatus = "found" | "not_found" | "unsupported" | "error";

export interface TextureRecord {
  articleId: number;
  status: TextureStatus;
  source?: "auto" | "manual";
  supplier?: string;
  sourceUrl?: string;
  pageUrl?: string;
  message?: string;
  fetchedAt: string;
}

export interface TileInfo {
  supplier: string;
  /** "NAVARTI - ZIRO" → "ZIRO" */
  series: string;
  colour: string;
  sku: string;
  /** supplier + series + colour: all sizes of one colour share it */
  groupKey: string;
  widthCm: number | null;
  heightCm: number | null;
  thicknessMm: number | null;
}

// ── Parsing of Bexio article fields ─────────────────────────────────────────

/** "600 600 9 MM" → 60 × 60 cm, 9 mm ; "120 60 9.5" → 120 × 60 cm ; "119.7 59.7" → cm already. */
function parseSize(text: string) {
  const num = "(\\d{2,4}(?:[.,]\\d)?)";
  const m = text.match(new RegExp(`${num}\\s*[x×\\s]\\s*${num}\\s*[x×\\s]\\s*(\\d{1,2}(?:[.,]\\d)?)\\s*mm`, "i"));
  if (!m) return { widthCm: null, heightCm: null, thicknessMm: null };
  const w = parseFloat(m[1].replace(",", "."));
  const h = parseFloat(m[2].replace(",", "."));
  const div = Math.max(w, h) >= 250 ? 10 : 1; // millimetres vs centimetres
  return { widthCm: w / div, heightCm: h / div, thicknessMm: parseFloat(m[3].replace(",", ".")) };
}

const STOP_WORDS = /^(MAT|MATT|MATE|RECT|RECTIFIE|RETT|NON|N\/RECT|NRECT|BRILL|BRILLANT|LAPP|LAPPATO|SATIN|SATINE|GLOSSY|SOFT|NATURAL|NATUREL|FAIENCE|GRES|R\d+[A-Z+]*|PRO|PLUS|\d.*|-)$/i;

/** First words of the supplier description after the collection name, up to the finish/size: "ZIRO BLANCO MAT RECT 1200…" → "BLANCO". */
function parseColour(collection: string, description: string) {
  let words = description.split(/\s+/).filter(Boolean);
  const col = collection.toUpperCase().split(/\s+/).filter(Boolean);
  if (col.length && words.slice(0, col.length).join(" ").toUpperCase() === col.join(" ")) words = words.slice(col.length);
  else if (col[0] && words[0]?.toUpperCase() === col[0]) words = words.slice(1);
  const out: string[] = [];
  for (const w of words) {
    if (STOP_WORDS.test(w)) break;
    out.push(w);
  }
  return out.join(" ");
}

export function parseTileInfo(a: BexioArticle): TileInfo {
  const desc = (a.deliverer_description ?? "").split("\n")[0].trim();
  const supplier = (a.deliverer_name ?? "").replace(/\s*-\s*/g, " - ").replace(/\s+/g, " ").trim();
  const parts = supplier.split(" - ").map((x) => x.trim());
  const series = parts[1] || desc.split(/\s+/)[0] || "";
  const colour = parseColour(series, desc);
  const size = parseSize(`${desc} ${a.intern_code ?? ""}`);
  return {
    supplier,
    series,
    colour,
    sku: (a.deliverer_code ?? "").trim(),
    groupKey: [parts[0], series, colour].map((x) => (x ?? "").toLowerCase()).join("|"),
    ...size,
  };
}

// ── Supplier resolvers ──────────────────────────────────────────────────────

interface Resolved {
  imageUrl: string;
  pageUrl: string;
}

interface Resolver {
  /** true when one image serves every size of a colour (fetched once per group) */
  perGroup: boolean;
  resolve: (info: TileInfo) => Promise<Resolved | null>;
}

const UA = "Mozilla/5.0 (compatible; atmo-margin texture fetch)";

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function getText(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.text();
}

/** Caesar: the product page embeds JSON-LD where each SKU (= Bexio deliverer_code) maps to its image. */
const caesar: Resolver = {
  perGroup: false,
  resolve: async (info) => {
    if (!info.series || !info.colour || !info.sku) return null;
    const pageUrl = `https://www.caesar.it/en/collections-porcelain-tile/${slug(info.series)}/${slug(info.colour)}/`;
    const html = await getText(pageUrl);
    if (!html) return null;
    const re = /"valueReference":\s*"([^"]+)",\s*"image":\s*"([^"]+)"/g;
    for (const m of html.matchAll(re)) {
      if (m[1].toUpperCase() === info.sku.toUpperCase()) return { imageUrl: m[2], pageUrl };
    }
    return null;
  },
};

// ── Generic helpers for sites that only publish a pile of images per collection page ──

const FILE_TOKENS = (url: string) => {
  const file = decodeURIComponent(url.split("?")[0].split("/").pop() ?? "").toLowerCase().replace(/\.[a-z0-9]+$/, "");
  const base = file.replace(/-\d+x\d+$/, "").replace(/-e\d{9,}$/, "");
  return base.split(/[^a-z0-9]+/).filter(Boolean);
};

/** Scores image URLs by how much their filename looks like a flat swatch of `series` in `colour`. */
function pickColourImage(urls: string[], series: string, colour: string): string | null {
  const s = slug(series).replace(/-/g, "");
  const c = slug(colour).replace(/-/g, "");
  if (!c) return null;
  let best: { url: string; score: number } | null = null;
  for (const url of urls) {
    const tokens = FILE_TOKENS(url);
    const joined = tokens.join("");
    let score = 0;
    if (joined.includes(s)) score += 2;
    if (tokens.some((t) => t.length >= 3 && (t.startsWith(c.slice(0, 4)) || c.startsWith(t.slice(0, 4))))) score += 4;
    if (tokens[0] === "amb" || tokens[0] === "a" || tokens.includes("amb")) score -= 6;
    if (tokens.some((t) => /^(bano|cocina|wc|room|ambiente|cuisine|salle|detail|detalle|logo)$/.test(t))) score -= 4;
    if (tokens.length > 4) score -= 3; // combo shots like "ECCHIO-CREMA_LORING-NATURAL_ECCHIO-TAUPE"
    if (/-\d+x\d+\.[a-z]+$/i.test(url.split("?")[0])) score -= 1;
    if (score >= 6 && (!best || score > best.score)) best = { url, score };
  }
  return best?.url ?? null;
}

let navartiSeries: Promise<string[]> | null = null;
function listNavartiSeries() {
  // The search page answers 404 when nothing matches, but its menu still lists every series.
  navartiSeries ??= fetch("https://www.navarti.com/en/search/?q=x", { headers: { "User-Agent": UA } }).then(async (res) => {
    const html = await res.text();
    const found = new Set<string>();
    for (const m of html.matchAll(/href="\/en\/series\/([^"/]+)\/"/g)) found.add(m[1]);
    return [...found];
  });
  navartiSeries.catch(() => (navartiSeries = null));
  return navartiSeries;
}

const navarti: Resolver = {
  perGroup: true,
  resolve: async (info) => {
    if (!info.series || !info.colour) return null;
    const s = slug(info.series);
    const candidates = (await listNavartiSeries())
      .filter((x) => x.replace(/_/g, "-").startsWith(s))
      .sort((a, b) => (a === s ? -1 : b === s ? 1 : a.length - b.length))
      .slice(0, 5);
    for (const c of candidates) {
      const pageUrl = `https://www.navarti.com/en/series/${c}/`;
      const html = await getText(pageUrl);
      if (!html) continue;
      const urls = [...new Set([...html.matchAll(/https:\/\/www\.navarti\.com\/wp-content\/uploads\/[^"'\s,)]+\.(?:jpe?g|png)/gi)].map((m) => m[0]))];
      const picked = pickColourImage(urls, info.series, info.colour);
      if (picked) {
        // prefer the original upload over a resized thumbnail
        const original = picked.replace(/-\d+x\d+(\.[a-z]+)$/i, "$1");
        return { imageUrl: original, pageUrl };
      }
    }
    return null;
  },
};

/**
 * Website lookups (Caesar, Navarti) are switched off: only the original files in data/*-tiff-source
 * and manual uploads are used, because website images are photos, not textures.
 */
const WEBSITE_FETCH = false;

const RESOLVERS: { match: RegExp; name: string; resolver: Resolver }[] = !WEBSITE_FETCH ? [] : [
  { match: /caesar/i, name: "Caesar", resolver: caesar },
  { match: /navarti/i, name: "Navarti", resolver: navarti },
];

export function hasResolver(supplier: string) {
  return RESOLVERS.some((r) => r.match.test(supplier)) || !!sourceForSupplier(supplier) || CATALOGUE_SUPPLIERS.test(supplier);
}

// ── Storage ─────────────────────────────────────────────────────────────────

export function loadTextureIndex(): Record<string, TextureRecord> {
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, "utf-8"));
  } catch {
    // production: the list published with the app
    return published.textureIndex as Record<string, TextureRecord>;
  }
}

/** Image link for the texture of a Bexio article: the local file in development, the published copy in production. */
export function textureUrl(articleId: number | string) {
  if (fs.existsSync(textureFilePath(Number(articleId)))) return `/api/textures/${articleId}`;
  return published.bexio[String(articleId)]?.url ?? `/api/textures/${articleId}`;
}

/** Writing textures needs a writable disk: only possible on your own machine. */
export function assertWritable() {
  if (process.env.VERCEL) throw new Error("Lecture seule en production : ajoutez les textures depuis votre poste puis publiez-les (npm run publish:textures).");
}

function saveTextureIndex(index: Record<string, TextureRecord>) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}

export function textureFilePath(articleId: number) {
  return path.join(IMAGES_DIR, `${articleId}.jpg`);
}

// ── Image download ──────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function assertPublicUrl(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("URL invalide");
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1|\[?f[cd])/.test(h)
  ) {
    throw new Error("URL non autorisée");
  }
  return u;
}

async function downloadImage(url: string): Promise<Buffer> {
  assertPublicUrl(url);
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`image ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) throw new Error("Ce lien n'est pas une image");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error("Image trop lourde");
  return buf;
}

/** A direct image URL, or a product page: the page's og:image is used. */
export async function fetchImageFromUrl(url: string): Promise<{ buffer: Buffer; imageUrl: string }> {
  const u = assertPublicUrl(url);
  const res = await fetch(u, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`${u.host} ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (type.startsWith("image/")) {
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Image trop lourde");
    return { buffer, imageUrl: u.toString() };
  }
  const html = await res.text();
  const og =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
  if (!og) throw new Error("Aucune image trouvée sur cette page");
  const imageUrl = new URL(og, u).toString();
  return { buffer: await downloadImage(imageUrl), imageUrl };
}

// ── Sync ────────────────────────────────────────────────────────────────────

function writeTexture(articleId: number, buffer: Buffer) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.writeFileSync(textureFilePath(articleId), buffer);
}

type GroupResult = { found: Resolved; buffer: Buffer } | null;

/** Manufacturer original files from data/<name>-tiff-source: exact format when available. */
async function fromLocal(src: LocalSource, articleId: number, info: TileInfo): Promise<TextureRecord | null> {
  const f = matchLocalFile(src, info);
  if (!f) return null;
  writeTexture(articleId, await convertToJpeg(f.fullPath));
  return {
    articleId,
    status: "found",
    source: "auto",
    supplier: src.name,
    sourceUrl: f.folder ? `${f.folder}/${f.file}` : f.file,
    message: `Fichier d'origine ${src.name}`,
    fetchedAt: new Date().toISOString(),
  };
}

const CATALOGUE_SUPPLIERS = /atlas|tuscania/i;

/** Atlas Concorde / Tuscania: pictures matched to the Bexio article by supplier code, else by collection + colour. */
async function fromCatalogue(articleId: number, info: TileInfo): Promise<TextureRecord | null> {
  if (!CATALOGUE_SUPPLIERS.test(info.supplier)) return null;
  const hit = findBySku(info.sku, CATALOGUE_SUPPLIERS) ?? findByName(CATALOGUE_SUPPLIERS, info.series, info.colour, info.widthCm, info.heightCm);
  if (!hit) return null;
  writeTexture(articleId, await convertToJpeg(hit.files[0]));
  return {
    articleId,
    status: "found",
    source: "auto",
    supplier: hit.supplier,
    sourceUrl: path.basename(hit.files[0]),
    message: `Fichier d'origine ${hit.supplier}`,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchOne(a: BexioArticle, groupCache: Map<string, Promise<GroupResult>>): Promise<TextureRecord> {
  const base = { articleId: a.id, fetchedAt: new Date().toISOString(), source: "auto" as const };
  const info = parseTileInfo(a);
  try {
    const fromCat = await fromCatalogue(a.id, info);
    if (fromCat) return fromCat;
  } catch {}
  const entry = RESOLVERS.find((r) => r.match.test(info.supplier));
  const localOnly = !entry ? sourceForSupplier(info.supplier) : null;
  if (!entry && localOnly) {
    try {
      const local = await fromLocal(localOnly, a.id, info);
      if (local) return local;
      return { ...base, status: "not_found", supplier: localOnly.name, message: "Pas de fichier correspondant dans le dossier" };
    } catch (e) {
      return { ...base, status: "error", supplier: localOnly.name, message: e instanceof Error ? e.message : String(e) };
    }
  }
  if (!entry) {
    return { ...base, status: "unsupported", supplier: info.supplier, message: info.supplier ? "Fournisseur non géré" : "Pas de fournisseur" };
  }
  try {
    const localSrc = sourceForSupplier(info.supplier);
    if (localSrc) {
      const local = await fromLocal(localSrc, a.id, info);
      if (local) return local;
    }
    const run = async (): Promise<GroupResult> => {
      const found = await entry.resolver.resolve(info);
      return found ? { found, buffer: await downloadImage(found.imageUrl) } : null;
    };
    let result: GroupResult;
    if (entry.resolver.perGroup) {
      let p = groupCache.get(info.groupKey);
      if (!p) groupCache.set(info.groupKey, (p = run()));
      result = await p;
    } else {
      result = await run();
    }
    if (!result) return { ...base, status: "not_found", supplier: entry!.name, message: "Produit introuvable sur le site" };
    writeTexture(a.id, result.buffer);
    return { ...base, status: "found", supplier: entry!.name, sourceUrl: result.found.imageUrl, pageUrl: result.found.pageUrl };
  } catch (e) {
    return { ...base, status: "error", supplier: entry!.name, message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Fetches the texture of every article that has no record yet ("once").
 * Retried: errors, articles whose supplier became supported, and (with `retryNotFound`) "not_found".
 * Manually added textures are never overwritten.
 */
export async function syncTextures(articles: BexioArticle[], { retryNotFound = false } = {}) {
  const index = loadTextureIndex();
  const todo = articles.filter((a) => {
    const r = index[a.id];
    if (!r) return true;
    if (r.source === "manual") return false; // added by hand, or removed by hand: never touch
    if (r.status === "error") return true;
    if (r.status === "unsupported") return hasResolver(parseTileInfo(a).supplier);
    return retryNotFound && r.status === "not_found";
  });

  const groupCache = new Map<string, Promise<GroupResult>>();
  const CONCURRENCY = 4;
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < todo.length) {
        const a = todo[next++];
        index[a.id] = await fetchOne(a, groupCache);
      }
    })
  );

  saveTextureIndex(index);
  return { processed: todo.length };
}

/** Manual texture (uploaded file or URL) for an article, optionally for every size of the same colour. */
export function saveManualTexture(
  articles: BexioArticle[],
  articleId: number,
  buffer: Buffer,
  opts: { allSizes: boolean; sourceUrl?: string }
) {
  const target = articles.find((a) => a.id === articleId);
  if (!target) throw new Error("Article introuvable");
  const key = parseTileInfo(target).groupKey;
  const ids = opts.allSizes
    ? articles.filter((a) => parseTileInfo(a).groupKey === key && key.replace(/\|/g, "") !== "").map((a) => a.id)
    : [articleId];
  if (!ids.includes(articleId)) ids.push(articleId);

  const index = loadTextureIndex();
  for (const id of ids) {
    writeTexture(id, buffer);
    index[id] = {
      articleId: id,
      status: "found",
      source: "manual",
      supplier: index[id]?.supplier,
      sourceUrl: opts.sourceUrl,
      fetchedAt: new Date().toISOString(),
    };
  }
  saveTextureIndex(index);
  return ids.length;
}

/** Removes a texture (e.g. a wrong automatic match). The article is kept out of future automatic fetches. */
export function removeTexture(articleId: number) {
  const index = loadTextureIndex();
  index[articleId] = {
    articleId,
    status: "not_found",
    source: "manual",
    supplier: index[articleId]?.supplier,
    message: "Texture retirée manuellement",
    fetchedAt: new Date().toISOString(),
  };
  saveTextureIndex(index);
  try {
    fs.unlinkSync(textureFilePath(articleId));
  } catch {}
}

/**
 * Re-fetches every article of a supplier that has original files in data/<name>-tiff-source,
 * replacing website images. Manual textures are kept.
 */
export async function importLocalSources(articles: BexioArticle[]) {
  const index = loadTextureIndex();
  const todo = articles
    .map((a) => ({ a, info: parseTileInfo(a) }))
    .map((x) => ({ ...x, src: sourceForSupplier(x.info.supplier) }))
    .filter((x) => (!!x.src || CATALOGUE_SUPPLIERS.test(x.info.supplier)) && index[x.a.id]?.source !== "manual");
  const stats = { total: todo.length, matched: 0, unmatched: 0, errors: 0 };

  let next = 0;
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (next < todo.length) {
        const { a, info, src } = todo[next++];
        try {
          const rec = (await fromCatalogue(a.id, info)) ?? (src ? await fromLocal(src, a.id, info) : null);
          if (rec) {
            index[a.id] = rec;
            stats.matched++;
          } else stats.unmatched++;
        } catch {
          stats.errors++;
        }
      }
    })
  );
  saveTextureIndex(index);
  return stats;
}
