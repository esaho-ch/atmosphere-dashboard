import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Original texture files (TIFF/JPG) supplied by a manufacturer, kept in data/<name>-tiff-source/.
 * `flat` folders hold all files together; otherwise there is one sub-folder per series.
 */
export interface LocalSource {
  id: string;
  name: string;
  supplier: RegExp;
  dir: string;
  flat: boolean;
}

export const LOCAL_SOURCES: LocalSource[] = [
  { id: "navarti", name: "Navarti", supplier: /navarti/i, dir: path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "navarti-tiff-source"), flat: false },
  { id: "lamour", name: "Recer Lamour", supplier: /lamour/i, dir: path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "lamour-tiff-source"), flat: true },
];

export function sourceForSupplier(supplier: string) {
  return LOCAL_SOURCES.find((src) => src.supplier.test(supplier) && fs.existsSync(src.dir)) ?? null;
}

const CACHE_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "texture-cache");
const MAX_SIDE = 1600;

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

interface LocalFile {
  folder: string;
  folderSlug: string;
  file: string;
  fullPath: string;
  tokens: string[];
  widthCm: number | null;
  heightCm: number | null;
}

// Room photos, details and anything that is not a flat tile.
const SKIP = /^(a|amb|rlv)[\s_-]|escalera|malla|cocina|bano|baño|muretto|tono|copia|cmyk|ambiente|rodapie|zocalo|peldano/i;

const cached = new Map<string, LocalFile[]>();

export function listLocalFiles(src: LocalSource): LocalFile[] {
  const hit = cached.get(src.id);
  if (hit) return hit;
  const out: LocalFile[] = [];
  const addDir = (dir: string, folder: string) => {
    for (const file of fs.readdirSync(dir)) {
      if (!/\.(tiff?|jpe?g|png)$/i.test(file) || SKIP.test(file)) continue;
      const base = file.replace(/\.[^.]+$/, "");
      const size = base.match(/(\d{2,3})\s*[xX]\s*(\d{2,3})/);
      out.push({
        folder,
        folderSlug: slug(folder),
        file,
        fullPath: path.join(dir, file),
        tokens: slug(base.replace(/\bM?\d+\s*[xX]\s*\d+/g, " ")).split(" ").filter(Boolean),
        widthCm: size ? parseInt(size[1]) : null,
        heightCm: size ? parseInt(size[2]) : null,
      });
    }
  };
  if (fs.existsSync(src.dir)) {
    if (src.flat) addDir(src.dir, "");
    else {
      for (const folder of fs.readdirSync(src.dir)) {
        const dir = path.join(src.dir, folder);
        if (fs.statSync(dir).isDirectory()) addDir(dir, folder);
      }
    }
  }
  cached.set(src.id, out);
  return out;
}

export interface LocalQuery {
  series: string;
  colour: string;
  widthCm: number | null;
  heightCm: number | null;
  thicknessMm: number | null;
}

/** Best matching original file for a Bexio article: right series, right colour, closest format. */
export function matchLocalFile(src: LocalSource, q: LocalQuery): LocalFile | null {
  const s = slug(q.series);
  const seriesWords = s.split(" ");
  // words of the colour that are not just the series name repeated
  const colourTokens = slug(q.colour).split(" ").filter((t) => t && !seriesWords.includes(t));
  if (!s || colourTokens.length === 0) return null;
  const thick = (q.thicknessMm ?? 0) >= 18;

  let best: { f: LocalFile; score: number } | null = null;
  for (const f of listLocalFiles(src)) {
    // series folder
    let folderScore: number;
    if (src.flat) folderScore = 0;
    else if (f.folderSlug === s) folderScore = thick ? 1 : 6;
    else if (f.folderSlug.startsWith(s + " ")) {
      const twenty = /20 ?mm/.test(f.folderSlug);
      folderScore = twenty === thick ? 5 : 1;
    } else continue;

    // colour: every word of the Bexio colour must show up in the file name
    const colourOk = colourTokens.every((c) => f.tokens.some((t) => t.length >= 3 && (t.startsWith(c.slice(0, 4)) || c.startsWith(t.slice(0, 4)))));
    if (!colourOk) continue;

    let score = folderScore;
    // fewer extra words (other colours / products) in the name is better
    const own = f.tokens.filter((t) => !seriesWords.includes(t));
    score -= Math.max(0, own.length - colourTokens.length) * (src.flat ? 3 : 0.5);
    if (f.widthCm && f.heightCm && q.widthCm && q.heightCm) {
      const same = (f.widthCm === q.widthCm && f.heightCm === q.heightCm) || (f.widthCm === q.heightCm && f.heightCm === q.widthCm);
      if (same) score += 10;
      else if (Math.abs(f.widthCm / f.heightCm - q.widthCm / q.heightCm) < 0.03 || Math.abs(f.widthCm / f.heightCm - q.heightCm / q.widthCm) < 0.03) score += 4;
    } else if (!f.widthCm) score -= 1;
    if (!best || score > best.score) best = { f, score };
  }
  return best?.f ?? null;
}

/** Converts an original (possibly 100 MB CMYK TIFF) to a web-sized sRGB JPEG, once per source file. */
export async function convertToJpeg(src: string): Promise<Buffer> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const key = crypto.createHash("sha1").update(`${src}|${MAX_SIDE}`).digest("hex");
  const out = path.join(CACHE_DIR, `${key}.jpg`);
  if (fs.existsSync(out)) return fs.readFileSync(out);

  const sharp = (await import("sharp")).default;
  const buf = await sharp(src, { limitInputPixels: false, sequentialRead: true })
    .rotate()
    .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .toColourspace("srgb")
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  fs.writeFileSync(out, buf);
  return buf;
}
