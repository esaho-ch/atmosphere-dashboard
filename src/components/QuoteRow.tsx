"use client";

import Link from "next/link";

interface Props {
  quote: any;
}

const STATUS_LABELS: Record<number, string> = {
  1: "Brouillon",
  2: "En attente",
  3: "Confirmée",
  4: "Refusée",
  5: "Annulée",
};

export default function QuoteRow({ quote }: Props) {
  return (
    <Link href={`/quotes/${quote.id}`} className="block hover:bg-gray-50 transition">
      <div className="grid grid-cols-6 gap-4 px-6 py-4 items-center border-b border-gray-100">
        <div className="text-sm font-mono text-gray-600">{quote.document_nr}</div>
        <div className="text-sm font-semibold text-gray-900 truncate">{quote.contact_name || "—"}</div>
        <div className="text-sm text-gray-700">{quote.is_valid_from}</div>
        <div className="text-sm text-right font-bold text-gray-900">
          {Number(quote.totalHT).toLocaleString("fr-CH", { style: "currency", currency: "CHF" })}
        </div>
        <div className="text-sm text-center">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
            quote.status_id === 3 ? "bg-green-100 text-green-700" :
            quote.status_id === 4 ? "bg-red-100 text-red-700" :
            "bg-yellow-100 text-yellow-700"
          }`}>
            {STATUS_LABELS[quote.status_id] || quote.status_id}
          </span>
        </div>
        <div className="text-sm text-right text-blue-600 font-medium">→ Détail</div>
      </div>
    </Link>
  );
}
