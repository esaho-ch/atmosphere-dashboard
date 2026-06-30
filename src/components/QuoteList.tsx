"use client";

import { useState, useMemo } from "react";
import QuoteRow from "@/components/QuoteRow";

interface Props {
  quotes: any[];
}

export default function QuoteList({ quotes }: Props) {
  const years = useMemo(() => {
    const set = new Set(quotes.map((q) => q.is_valid_from?.slice(0, 4)).filter(Boolean));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [quotes]);

  const [selectedYear, setSelectedYear] = useState<string>(years[0] ?? "");

  const filtered = useMemo(
    () => selectedYear ? quotes.filter((q) => q.is_valid_from?.startsWith(selectedYear)) : quotes,
    [quotes, selectedYear]
  );

  const totalHT = filtered.reduce((s: number, q: any) => s + q.totalHT, 0);
  const confirmed = filtered.filter((q: any) => q.kb_item_status_id === 3);
  const confirmedHT = confirmed.reduce((s: number, q: any) => s + q.totalHT, 0);

  return (
    <>
      {/* KPIs filtrés */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-500">Offres affichées</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{filtered.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-500">Volume total HT</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {totalHT.toLocaleString("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-500">Confirmées HT</div>
          <div className="text-3xl font-bold text-green-700 mt-1">
            {confirmedHT.toLocaleString("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-gray-600 mt-1">{confirmed.length} offre(s)</div>
        </div>
      </div>

      {/* Filtre année */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500 font-medium">Année :</span>
        <button
          onClick={() => setSelectedYear("")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            selectedYear === "" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Tout
        </button>
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              selectedYear === y ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-6 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <div>N° Offre</div>
          <div>Client</div>
          <div>Date</div>
          <div className="text-right">Montant HT</div>
          <div className="text-center">Statut</div>
          <div></div>
        </div>
        {filtered.length === 0 && (
          <div className="px-6 py-12 text-center text-gray-400">Aucune offre pour cette période</div>
        )}
        {filtered.map((q: any) => (
          <QuoteRow key={q.id} quote={q} />
        ))}
      </div>
    </>
  );
}
