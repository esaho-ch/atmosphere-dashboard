import { fetchArticles, type BexioArticle } from "@/lib/bexio";
import { loadTextureIndex, parseTileInfo, textureUrl, type TextureStatus } from "@/lib/textures";
import { clearTexture, fetchMissingTextures, importLocalFiles, setManualTexture } from "./actions";

const STATUS_LABEL: Record<TextureStatus | "pending", { label: string; cls: string }> = {
  found:       { label: "Texture OK",       cls: "bg-green-100 text-green-800" },
  not_found:   { label: "Introuvable",      cls: "bg-amber-100 text-amber-800" },
  unsupported: { label: "Ajout manuel", cls: "bg-slate-100 text-slate-500" },
  error:       { label: "Erreur",           cls: "bg-red-100 text-red-800" },
  pending:     { label: "À récupérer",      cls: "bg-slate-100 text-slate-500" },
};

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Tous" },
  { key: "found", label: "Avec texture" },
  { key: "missing", label: "Sans texture" },
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const f = sp.f ?? "";

  let articles: BexioArticle[] = [];
  let error = "";
  try {
    articles = await fetchArticles();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const index = loadTextureIndex();
  const statusOf = (a: BexioArticle): TextureStatus | "pending" => index[a.id]?.status ?? "pending";

  const counts = { found: 0, missing: 0, pending: 0 };
  for (const a of articles) {
    const s = statusOf(a);
    if (s === "found") counts.found++;
    else counts.missing++;
    if (s === "pending" || s === "error") counts.pending++;
  }

  const rows = articles.filter((a) => {
    const s = statusOf(a);
    if (f === "found" && s !== "found") return false;
    if (f === "missing" && s === "found") return false;
    if (!q) return true;
    return [a.intern_name, a.intern_code, a.deliverer_name, a.deliverer_description, a.deliverer_code]
      .some((v) => (v ?? "").toLowerCase().includes(q));
  });

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-slate-200 px-8 py-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Produits</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {articles.length} articles · {counts.found} textures · {counts.pending} à récupérer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action={fetchMissingTextures}>
            <button type="submit"
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-700 transition-colors">
              Récupérer les textures manquantes
            </button>
          </form>
          <form action={importLocalFiles}>
            <button type="submit" title="Utilise les fichiers d'origine du dossier data/*-tiff-source"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors">
              Importer les fichiers d&apos;origine (Navarti, Lamour, Atlas, Tuscania)
            </button>
          </form>
          <form action={fetchMissingTextures}>
            <input type="hidden" name="retry" value="1" />
            <button type="submit"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors">
              Réessayer les introuvables
            </button>
          </form>
        </div>
      </div>

      <main className="flex-1 px-8 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            Erreur API Bexio : {error}
          </div>
        )}

        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Rechercher (nom, code, fournisseur…)"
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-80 bg-white" />
          <select name="f" defaultValue={f} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white">
            {FILTERS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          <button type="submit" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100">
            Filtrer
          </button>
        </form>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
              <tr>
                <th className="text-left px-5 py-3 font-semibold w-20">Texture</th>
                <th className="text-left px-5 py-3 font-semibold">Produit</th>
                <th className="text-left px-5 py-3 font-semibold">Fournisseur</th>
                <th className="text-right px-5 py-3 font-semibold">Format</th>
                <th className="text-right px-5 py-3 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-400">Aucun produit</td></tr>
              )}
              {rows.map((a) => {
                const rec = index[a.id];
                const s = statusOf(a);
                const info = parseTileInfo(a);
                const badge = STATUS_LABEL[s];
                return (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-2">
                      {s === "found" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={textureUrl(a.id)} alt="" loading="lazy" className="size-12 rounded object-cover border border-slate-200" />
                      ) : (
                        <div className="size-12 rounded bg-slate-100" />
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{a.intern_name?.trim() || a.intern_code}</p>
                      <p className="text-xs text-slate-400">{a.deliverer_description || a.intern_code}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {info.supplier || "—"}
                      {info.sku && <span className="ml-1.5 text-xs font-mono text-slate-400">{info.sku}</span>}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500 tabular-nums">
                      {info.widthCm ? `${info.widthCm}×${info.heightCm} cm` : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span title={rec?.message} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {s === "found" && (
                        <a href={`/visualiser?floor=${a.id}`} className="ml-2 text-xs text-slate-400 hover:text-slate-700 underline">
                          3D
                        </a>
                      )}
                      <details className="mt-1.5 text-left">
                        <summary className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer text-right list-none">
                          {s === "found" ? "Remplacer" : "Ajouter une texture"}
                        </summary>
                        <form action={setManualTexture} className="mt-2 space-y-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <input type="hidden" name="articleId" value={a.id} />
                          <input type="url" name="url" placeholder="Lien d'une page produit ou d'une image"
                            className="border border-slate-200 rounded px-2 py-1 text-xs w-full bg-white" />
                          <input type="file" name="file" accept="image/*" className="text-xs w-full" />
                          <label className="flex items-center gap-1.5 text-xs text-slate-500">
                            <input type="checkbox" name="allSizes" defaultChecked />
                            Appliquer à tous les formats de cette couleur
                          </label>
                          <div className="flex items-center gap-2">
                            <button type="submit" className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-700">
                              Enregistrer
                            </button>
                            {s === "found" && (
                              <button formAction={clearTexture} className="text-xs text-slate-400 hover:text-red-600 underline">
                                {rec?.source === "manual" ? "Supprimer" : "Mauvaise image : retirer"}
                              </button>
                            )}
                          </div>
                        </form>
                      </details>
                      {rec?.pageUrl && (
                        <a href={rec.pageUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs text-slate-400 hover:text-slate-700 underline">
                          source
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
