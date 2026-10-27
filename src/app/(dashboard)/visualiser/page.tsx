import { fetchArticles } from "@/lib/bexio";
import { catalogueFaceCount, loadCatalogue } from "@/lib/catalogue";
import { loadTextureIndex, parseTileInfo, textureUrl } from "@/lib/textures";
import RoomViewer from "@/components/visualiser/RoomViewer";
import type { TileOption } from "@/components/visualiser/types";

export default async function VisualiserPage({
  searchParams,
}: {
  searchParams: Promise<{ floor?: string; wall?: string }>;
}) {
  const sp = await searchParams;
  const index = loadTextureIndex();

  const tiles: TileOption[] = [];
  let error = "";

  // Tiles of your Bexio articles that have a texture
  try {
    const articles = await fetchArticles();
    for (const a of articles) {
      if (index[a.id]?.status !== "found") continue;
      const info = parseTileInfo(a);
      const text = `${a.deliverer_description ?? ""} ${a.intern_code ?? ""} ${a.intern_name ?? ""}`.toUpperCase();
      const finish: TileOption["finish"] = /BRILL|POLI|GLOSS|LUCID|LAPP|LUX/.test(text)
        ? "gloss"
        : /SATIN|SOFT|SEMI/.test(text) ? "satin" : "matt";
      const variation = parseInt(/\bV([1-4])\b/.exec(`${a.intern_description ?? ""}`.toUpperCase())?.[1] ?? "2");
      tiles.push({
        id: String(a.id),
        images: [textureUrl(a.id)],
        thumb: textureUrl(a.id),
        name: [info.series, info.colour].filter(Boolean).join(" ") || a.intern_name?.trim() || a.intern_code,
        detail: (info.supplier || "").split(" - ")[0],
        widthCm: info.widthCm ?? 60,
        heightCm: info.heightCm ?? 60,
        finish,
        variation,
      });
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  // Tiles found directly in the supplier picture folders (no Bexio article needed)
  for (const e of loadCatalogue()) {
    tiles.push({
      id: e.id,
      thumb: e.thumb ?? `/api/catalogue/${encodeURIComponent(e.id)}/0?w=160`,
      images: e.images ?? Array.from({ length: catalogueFaceCount(e) }, (_, n) => `/api/catalogue/${encodeURIComponent(e.id)}/${n}`),
      name: `${e.series} ${e.colour}`.trim(),
      detail: `${e.supplier} · catalogue${e.skus?.length ? ` · ${e.skus[0]}` : ""}`,
      widthCm: e.widthCm,
      heightCm: e.heightCm,
      finish: e.finish,
      variation: e.variation,
    });
  }

  tiles.sort((a, b) => a.name.localeCompare(b.name) || a.widthCm - b.widthCm);

  const toId = (v?: string) => (v && tiles.some((t) => t.id === v) ? v : null);

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <h1 className="text-lg font-bold text-slate-900">Visualiseur 3D</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {tiles.length} carrelages · pose, joints et dimensions réels
        </p>
      </div>
      {error && (
        <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm">
          Articles Bexio indisponibles ({error}) : seul le catalogue des dossiers fournisseurs est affiché.
        </div>
      )}
      {tiles.length === 0 ? (
        <p className="p-8 text-sm text-slate-500">
          Aucune texture disponible. Ajoutez des dossiers fournisseurs ou lancez « Récupérer les textures manquantes » dans Produits.
        </p>
      ) : (
        <RoomViewer tiles={tiles} initialFloor={toId(sp.floor)} initialWall={toId(sp.wall)} />
      )}
    </div>
  );
}
