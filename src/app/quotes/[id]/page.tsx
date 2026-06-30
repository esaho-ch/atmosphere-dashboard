import { fetchQuotes, fetchContact, calculateMargins, getMaterialCostForQuote, getMarginTargets } from "@/lib/bexio";
import MarginBadge from "@/components/MarginBadge";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

async function getQuoteDetail(id: number) {
  const [allQuotes, { positions, materialCost }] = await Promise.all([
    fetchQuotes(),
    getMaterialCostForQuote(id),
  ]);
  const quote = allQuotes.find((q) => q.id === id);
  if (!quote) throw new Error("Offre introuvable");

  let contactName = "";
  try {
    const c = await fetchContact(quote.contact_id);
    contactName = [c.name_1, c.name_2].filter(Boolean).join(" ");
  } catch {}

  const totalHT = parseFloat(quote.total_net) || 0;
  const margins = calculateMargins(totalHT, materialCost);

  return { quote: { ...quote, contact_name: contactName }, positions, margins };
}

export default async function QuoteDetailPage({ params }: Props) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  let data: any = null;
  let error = "";

  try {
    data = await getQuoteDetail(id);
  } catch (e: any) {
    error = e.message;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <Link href="/" className="text-blue-600 text-sm">← Retour</Link>
        <div className="mt-4 text-red-600">{error}</div>
      </div>
    );
  }

  const { quote, positions, margins } = data;
  const MARGIN_TARGETS = getMarginTargets();
  const fmt = (n: number) => n.toLocaleString("fr-CH", { style: "currency", currency: "CHF" });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <Link href="/" className="text-blue-600 text-sm hover:underline">← Toutes les offres</Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">
          Offre {quote.document_nr} — {quote.contact_name || "Client inconnu"}
        </h1>
        <p className="text-sm text-gray-700">{quote.is_valid_from}</p>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-8 space-y-8">
        {/* Résumé financier */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Résumé financier</h2>
          <div className="grid grid-cols-3 gap-6 text-sm">
            <div>
              <div className="text-sm font-medium text-gray-500">CA TTC</div>
              <div className="text-xl font-bold text-gray-900">{fmt(margins.totalTTC)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">TVA ({fmt(margins.tvaAmount)})</div>
              <div className="text-xl font-bold text-gray-900">{fmt(margins.totalHT)} HT</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Coût matériel (prix d'achat)</div>
              <div className={`text-xl font-bold ${margins.materialRatio > MARGIN_TARGETS.material_max ? "text-red-600" : "text-green-600"}`}>
                {fmt(margins.materialCost)}
                {margins.materialCost > 0 && (
                  <span className="text-sm ml-2 font-normal">
                    ({(margins.materialRatio * 100).toFixed(1)}% du HT)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Analyse marges */}
        {margins.materialCost > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Analyse des marges</h2>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <MarginBadge
                ratio={1 - margins.materialRatio}
                target={1 - MARGIN_TARGETS.material_max}
                label="Marge matière brute"
              />
              <MarginBadge
                ratio={margins.grossProfitRatio}
                target={MARGIN_TARGETS.gross_profit_target + MARGIN_TARGETS.salary_ratio}
                label="Marge après matière"
              />
              <MarginBadge
                ratio={margins.grossExploitationRatio}
                target={MARGIN_TARGETS.gross_profit_target}
                label="Bénéfice brut exploit."
              />
              <MarginBadge
                ratio={margins.netProfitRatio}
                target={MARGIN_TARGETS.net_profit_target}
                label="Bénéfice net estimé"
              />
            </div>

            {/* Cascade */}
            <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-gray-800">Produits HT</span>
                <span className="font-bold text-gray-900">{fmt(margins.totalHT)}</span>
              </div>
              <div className="flex justify-between py-1 text-red-600">
                <span>− Matériel ({(margins.materialRatio * 100).toFixed(1)}%)</span>
                <span>− {fmt(margins.materialCost)}</span>
              </div>
              <div className="flex justify-between py-1 font-semibold border-t border-gray-100 text-gray-900">
                <span>= Marge après matière</span>
                <span className="text-gray-900">{fmt(margins.grossProfit)} ({(margins.grossProfitRatio * 100).toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between py-1 text-orange-600">
                <span>− Salaires fixes alloués (17%)</span>
                <span>− {fmt(margins.salaryAllocation)}</span>
              </div>
              <div className="flex justify-between py-1 font-semibold border-t border-gray-100 text-gray-900">
                <span>= Bénéfice brut d'exploitation</span>
                <span className={margins.grossExploitationRatio >= MARGIN_TARGETS.gross_profit_target ? "text-green-600" : "text-red-600"}>
                  {fmt(margins.grossExploitationProfit)} ({(margins.grossExploitationRatio * 100).toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between py-1 text-orange-600">
                <span>− Charges fixes allouées (15%)</span>
                <span>− {fmt(margins.fixedCostsAllocation)}</span>
              </div>
              <div className="flex justify-between py-1 font-bold border-t border-gray-200 pt-2 text-gray-900">
                <span>= Bénéfice net estimé</span>
                <span className={margins.netProfitRatio >= MARGIN_TARGETS.net_profit_target ? "text-green-700" : "text-red-700"}>
                  {fmt(margins.netProfit)} ({(margins.netProfitRatio * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800 text-sm">
            Aucun prix d'achat trouvé dans les positions. Renseignez les <strong>prix d'achat</strong> sur les lignes Bexio pour calculer la marge automatiquement.
          </div>
        )}

        {/* Positions */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Positions de l'offre</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-right">Qté</th>
                <th className="px-4 py-3 text-right">Prix vente</th>
                <th className="px-4 py-3 text-right">Coût achat</th>
                <th className="px-4 py-3 text-right">Total HT</th>
                <th className="px-4 py-3 text-right">Marge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {positions.map((pos: any) => {
                const saleTotal = parseFloat(pos.position_total) || 0;
                const buyTotal = pos.purchase_total || 0;
                const posMargin = saleTotal > 0 ? (saleTotal - buyTotal) / saleTotal : null;
                return (
                  <tr key={pos.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-800 text-xs max-w-xs leading-relaxed">
                      <span dangerouslySetInnerHTML={{ __html: pos.text || "—" }} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-800 whitespace-nowrap">
                      {parseFloat(pos.amount).toLocaleString("fr-CH")} {pos.unit_name}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-medium whitespace-nowrap">
                      {fmt(parseFloat(pos.unit_price))}
                      {pos.discount_in_percent && (
                        <span className="text-xs text-orange-600 font-semibold ml-1">-{parseFloat(pos.discount_in_percent)}%</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-orange-600 whitespace-nowrap">
                      {buyTotal > 0 ? fmt(buyTotal) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">{fmt(saleTotal)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {posMargin !== null && buyTotal > 0 ? (
                        <span className={posMargin >= 0.4 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                          {(posMargin * 100).toFixed(1)}%
                        </span>
                      ) : <span className="text-gray-300">—</span>}
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
