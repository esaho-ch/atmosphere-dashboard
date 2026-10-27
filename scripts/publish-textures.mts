/**
 * Publishes the tile textures to Vercel Blob so the deployed app does not need your supplier folders.
 *
 *   npm run publish:textures                 # textures of the Bexio products only, then rewrite src/data/texture-manifest.json
 *   npm run publish:textures -- --catalogue  # also the whole supplier catalogue (large: may exceed the free Blob quota)
 *   npm run publish:textures -- --dry --limit 5   # test: convert a few tiles, upload nothing
 *   npm run publish:textures -- --force      # upload again even if already published
 *
 * Needs BLOB_READ_WRITE_TOKEN (Vercel → Storage → Blob → `vercel env pull .env.local`).
 * Commit src/data/texture-manifest.json afterwards: it is the list of tiles and image links used in production.
 */
import fs from "fs";
import path from "path";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { loadCatalogue, catalogueFaceCount } from "../src/lib/catalogue";
import { convertToJpeg } from "../src/lib/localSources";
import { loadTextureIndex, textureFilePath } from "../src/lib/textures";

try { process.loadEnvFile(".env.local"); } catch {}

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const force = args.includes("--force");
const withCatalogue = args.includes("--catalogue");
const limit = Number(args[args.indexOf("--limit") + 1]) || Infinity;

if (!dry && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN is missing. Create a Blob store in Vercel, then run: vercel env pull .env.local");
  process.exit(1);
}

const STATE = path.join(process.cwd(), "data", "publish-state.json");
const MANIFEST = path.join(process.cwd(), "src", "data", "texture-manifest.json");
const state: Record<string, string> = !force && fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {};
let uploaded = 0, reused = 0, bytes = 0;

async function publish(key: string, body: Buffer): Promise<string> {
  if (state[key]) { reused++; return state[key]; }
  if (dry) { bytes += body.length; return `dry://${key}`; }
  const { url } = await put(key, body, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "image/jpeg", cacheControlMaxAge: 31536000 });
  state[key] = url;
  uploaded++;
  bytes += body.length;
  if (uploaded % 25 === 0) fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
  return url;
}

const web = (b: Buffer) => sharp(b).resize(1100, 1100, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80, progressive: true, mozjpeg: true }).toBuffer();
const thumb = (b: Buffer) => sharp(b).resize(160, 160, { fit: "cover" }).jpeg({ quality: 75 }).toBuffer();

async function pool<T>(items: T[], size: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (next < items.length) { const i = next++; await fn(items[i], i); } }));
}

const entries = withCatalogue ? loadCatalogue().filter((e) => e.files.length > 0).slice(0, limit) : [];
if (withCatalogue && entries.length === 0) { console.error("No tiles found in data/*-tiff-source or data/photos-fournisseur."); process.exit(1); }
console.log(withCatalogue ? `${entries.length} catalogue tiles${dry ? " (dry run)" : ""}…` : `Bexio products only${dry ? " (dry run)" : ""}`);

const catalogue: Record<string, unknown>[] = [];
await pool(entries, 3, async (e, i) => {
  try {
    const images: string[] = [];
    let first: Buffer | null = null;
    for (let n = 0; n < catalogueFaceCount(e); n++) {
      const jpeg = await web(await convertToJpeg(e.files[n]));
      if (n === 0) first = jpeg;
      images.push(await publish(`catalogue/${e.id}/${n}.jpg`, jpeg));
    }
    const thumbUrl = await publish(`catalogue/${e.id}/thumb.jpg`, await thumb(first!));
    catalogue.push({
      id: e.id, supplier: e.supplier, series: e.series, colour: e.colour, widthCm: e.widthCm, heightCm: e.heightCm,
      finish: e.finish, variation: e.variation, images, thumb: thumbUrl,
    });
  } catch (err) {
    console.error(`  skipped ${e.id}: ${err instanceof Error ? err.message : err}`);
  }
  if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${entries.length}`);
});

// Textures of Bexio articles (Navarti / Lamour originals, manual uploads)
const index = loadTextureIndex();
const bexio: Record<string, { url: string }> = {};
const found = Object.values(index).filter((r) => r.status === "found" && fs.existsSync(textureFilePath(r.articleId)));
await pool(found.slice(0, dry ? 5 : undefined), 3, async (r) => {
  const url = await publish(`bexio/${r.articleId}.jpg`, await web(fs.readFileSync(textureFilePath(r.articleId))));
  bexio[String(r.articleId)] = { url };
});

if (!dry) {
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
  catalogue.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  fs.writeFileSync(MANIFEST, JSON.stringify({ generatedAt: new Date().toISOString(), catalogue, bexio, textureIndex: index }));
  console.log(`Manifest written: ${path.relative(process.cwd(), MANIFEST)} — commit it.`);
}
console.log(`Done. uploaded ${uploaded}, already published ${reused}, ${(bytes / 1048576).toFixed(0)} MB sent. ${catalogue.length} tiles, ${Object.keys(bexio).length} Bexio textures.`);
