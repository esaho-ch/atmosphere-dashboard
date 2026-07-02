import { fetchQuote, fetchContact, calculateMargins, getMaterialCostForQuote, getMarginTargets } from "@/lib/bexio";
import MarginBadge from "@/components/MarginBadge";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getMarginLevel, marginClasses } from "@/lib/marginColor";

interface Props {
  params: Promise<{ id: string }>;
}

async function getQuoteDetail(id: number) {
  const [quote, { positions, materialCost }] = await Promise.all([
    fetchQuote(id),
    getMaterialCostForQuote(id),
  ]);

  let contactName = "";
  try {
    const c = await fetchContact(quote.contact_id);
    contactName = [c.name_1, c.name_2].filter(Boolean).join(" ");
  } catch {}

  const totalHT = parseFloat(quote.total_net) || 0;
  const margins = calculateMargins(totalHT, materialCost);

  return { quote: { ...quote, contact_name: contactName }, positions, margins };
}

const STATUS_LABELS: Record<number, string> = {
  1: "Brouillon", 2: "En attente", 3: "Confirmée", 4: "Refusée", 5: "Annulée",
};

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
      <div className="min-h-screen bg-slate-50 p-8">
        <Link href="/" className="inline-flex items-center gap-1 text-blue-600 text-sm"><ChevronLeft size={14} />Retour</Link>
        <div className="mt-4 text-red-600">{error}</div>
      </div>
    );
  }

  const { quote, positions, margins } = data;
  const MARGIN_TARGETS = getMarginTargets();
  const fmt = (n: number) => n.toLocaleString("fr-CH", { style: "currency", currency: "CHF" });
  const fmtShort = (n: number) => n.toLocaleString("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 });
  const statusLabel = STATUS_LABELS[quote.kb_item_status_id] ?? "-";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
          <Link href="/" className="hover:text-slate-700 transition-colors">Offres</Link>
          <ChevronLeft size={12} className="rotate-180" />
          <span className="text-slate-600 font-medium">{quote.document_nr}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{quote.contact_name || "Client inconnu"}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-slate-400">{quote.is_valid_from?.split("-").reverse().join("/")}</span>
              <span className="text-slate-200">·</span>
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                quote.kb_item_status_id === 3 ? "bg-emerald-50 text-emerald-700" :
                quote.kb_item_status_id === 4 ? "bg-red-50 text-red-600" :
                "bg-slate-100 text-slate-500"
              }`}>{statusLabel}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{fmtShort(margins.totalHT)}</div>
            <div className="text-sm text-slate-400">HT · {fmtShort(margins.totalTTC)} TTC</div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-5xl px-8 py-6 space-y-6">

        {/* Résumé financier */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">CA TTC</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">{fmt(margins.totalTTC)}</div>
            <div className="text-xs text-slate-400 mt-1">dont TVA {fmt(margins.tvaAmount)} (8.1%)</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">CA HT</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">{fmt(margins.totalHT)}</div>
            <div className="text-xs text-slate-400 mt-1">base de calcul des marges</div>
          </div>
          <div className={`rounded-xl border p-5 shadow-sm ${margins.materialRatio > MARGIN_TARGETS.material_max ? "bg-red-50 border-red-200" : margins.materialCost === 0 ? "bg-slate-50 border-slate-200" : "bg-emerald-50 border-emerald-200"}`}>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Coût matériel</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">{fmt(margins.materialCost)}</div>
            {margins.materialCost > 0 && (
              <div className={`text-xs mt-1 font-medium ${margins.materialRatio > MARGIN_TARGETS.material_max ? "text-red-600" : "text-emerald-600"}`}>
                {(margins.materialRatio * 100).toFixed(1)}% du HT · cible max {(MARGIN_TARGETS.material_max * 100).toFixed(0)}%
              </div>
            )}
          </div>
        </div>

        {/* Analyse marges */}
        {margins.materialCost > 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Analyse des marges</h2>
            </div>

            <div className="grid grid-cols-4 gap-0 divide-x divide-slate-100">
              <div className="p-5">
                <MarginBadge ratio={1 - margins.materialRatio} target={1 - MARGIN_TARGETS.material_max} label="Marge matière brute" />
              </div>
              <div className="p-5">
                <MarginBadge ratio={margins.grossProfitRatio} target={MARGIN_TARGETS.gross_profit_target + MARGIN_TARGETS.salary_ratio} label="Marge après matière" />
              </div>
              <div className="p-5">
                <MarginBadge ratio={margins.grossExploitationRatio} target={MARGIN_TARGETS.gross_profit_target} label="Bénéfice brut exploit." />
              </div>
              <div className="p-5">
                <MarginBadge ratio={margins.netProfitRatio} target={MARGIN_TARGETS.net_profit_target} label="Bénéfice net estimé" />
              </div>
            </div>

            {/* Cascade waterfall */}
            <div className="px-6 py-5 border-t border-slate-100 space-y-1">
              <CascadeRow label="Produits HT" value={fmt(margins.totalHT)} valueClass="text-slate-900 font-bold" />
              <CascadeRow label={`Matériel (${(margins.materialRatio * 100).toFixed(1)}%)`} value={`− ${fmt(margins.materialCost)}`} valueClass="text-red-600" indent />
              <CascadeRow label="Marge après matière" value={`${fmt(margins.grossProfit)} (${(margins.grossProfitRatio * 100).toFixed(1)}%)`} separator valueClass={getMarginLevel(margins.grossProfitRatio, MARGIN_TARGETS.gross_profit_target + MARGIN_TARGETS.salary_ratio) === "good" ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"} />
              <CascadeRow label={`Salaires alloués (${(MARGIN_TARGETS.salary_ratio * 100).toFixed(1)}%)`} value={`− ${fmt(margins.salaryAllocation)}`} valueClass="text-amber-600" indent />
              <CascadeRow label="Bénéfice brut d'exploitation" value={`${fmt(margins.grossExploitationProfit)} (${(margins.grossExploitationRatio * 100).toFixed(1)}%)`} separator valueClass={getMarginLevel(margins.grossExploitationRatio, MARGIN_TARGETS.gross_profit_target) === "good" ? "text-emerald-600 font-semibold" : margins.grossExploitationRatio >= 0 ? "text-amber-600 font-semibold" : "text-red-600 font-semibold"} />
              <CascadeRow label={`Charges fixes allouées (${(MARGIN_TARGETS.fixed_costs_ratio * 100).toFixed(1)}%)`} value={`− ${fmt(margins.fixedCostsAllocation)}`} valueClass="text-amber-600" indent />
              <CascadeRow label="Bénéfice net estimé" value={`${fmt(margins.netProfit)} (${(margins.netProfitRatio * 100).toFixed(1)}%)`} separator bold valueClass={getMarginLevel(margins.netProfitRatio, MARGIN_TARGETS.net_profit_target) === "good" ? "text-emerald-700 font-bold" : margins.netProfitRatio >= 0 ? "text-amber-600 font-bold" : "text-red-600 font-bold"} />
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
            Aucun prix d'achat trouvé dans les positions. Renseignez les <strong>prix d'achat</strong> sur les articles Bexio pour calculer la marge automatiquement.
          </div>
        )}

        {/* Positions */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Positions de l'offre</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Description</th>
                <th className="px-4 py-3 text-right font-semibold">Qté</th>
                <th className="px-4 py-3 text-right font-semibold">PU vente</th>
                <th className="px-4 py-3 text-right font-semibold">Coût achat</th>
                <th className="px-4 py-3 text-right font-semibold">Total HT</th>
                <th className="px-4 py-3 text-right font-semibold">Marge</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos: any) => {
                const saleTotal = parseFloat(pos.position_total) || 0;
                const buyTotal = pos.purchase_total || 0;
                const posMargin = saleTotal > 0 && buyTotal > 0 ? (saleTotal - buyTotal) / saleTotal : null;
                const level = getMarginLevel(posMargin, 0.4);
                const cls = marginClasses[level];
                return (
                  <tr key={pos.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0">
                    <td className="px-6 py-3 text-slate-700 text-xs leading-relaxed max-w-xs">
                      <span dangerouslySetInnerHTML={{ __html: pos.text || "-" }} />
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs whitespace-nowrap tabular-nums">
                      {parseFloat(pos.amount).toLocaleString("fr-CH")} {pos.unit_name}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800 whitespace-nowrap tabular-nums">
                      {fmt(parseFloat(pos.unit_price))}
                      {pos.discount_in_percent && (
                        <span className="text-xs text-amber-600 font-semibold ml-1">-{parseFloat(pos.discount_in_percent)}%</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap tabular-nums">
                      {buyTotal > 0 ? fmt(buyTotal) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">{fmt(saleTotal)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {posMargin !== null ? (
                        <span className={`text-xs font-bold tabular-nums ${cls.text}`}>
                          {(posMargin * 100).toFixed(1)}%
                        </span>
                      ) : <span className="text-slate-300">-</span>}
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

function CascadeRow({
  label, value, valueClass, indent, separator, bold,
}: {
  label: string; value: string; valueClass?: string; indent?: boolean; separator?: boolean; bold?: boolean;
}) {
  return (
    <div className={`flex justify-between items-baseline py-1.5 text-sm ${separator ? "border-t border-slate-100 mt-1 pt-2" : ""}`}>
      <span className={`${indent ? "pl-4 text-slate-500" : "text-slate-700"} ${bold ? "font-semibold" : ""}`}>
        {indent ? "↳ " : ""}{label}
      </span>
      <span className={`tabular-nums ${valueClass ?? "text-slate-900"}`}>{value}</span>
    </div>
  );
}
