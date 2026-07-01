"use client";

import Link from "next/link";
import { getMarginLevel, marginClasses } from "@/lib/marginColor";

interface Props {
  quote: any;
}

const STATUS_STYLES: Record<number, { label: string; cls: string }> = {
  1: { label: "Brouillon",  cls: "bg-gray-100 text-gray-500" },
  2: { label: "En attente", cls: "bg-blue-50 text-blue-600" },
  3: { label: "Confirmée",  cls: "bg-emerald-50 text-emerald-700" },
  4: { label: "Refusée",    cls: "bg-red-50 text-red-600" },
  5: { label: "Annulée",    cls: "bg-gray-100 text-gray-400" },
};

const NET_TARGET = 0.08;

function MarginPill({ ratio }: { ratio: number | null }) {
  if (ratio === null) return <span className="text-xs text-gray-300">-</span>;
  const level = getMarginLevel(ratio, NET_TARGET);
  const cls = marginClasses[level];
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${cls.badge}`}>
      {ratio >= 0 ? "+" : ""}{(ratio * 100).toFixed(1)}%
    </span>
  );
}

export default function QuoteRow({ quote }: Props) {
  const status = STATUS_STYLES[quote.status_id] ?? { label: String(quote.status_id), cls: "bg-gray-100 text-gray-500" };

  return (
    <Link href={`/quotes/${quote.id}`} className="block hover:bg-slate-50 transition-colors">
      <div className="grid grid-cols-7 gap-4 px-6 py-3.5 items-center border-b border-gray-100 last:border-0">
        <div className="text-xs font-mono text-gray-400 tracking-tight">{quote.document_nr}</div>
        <div className="text-sm font-medium text-gray-900 truncate col-span-2">{quote.contact_name || "-"}</div>
        <div className="text-sm text-gray-500 tabular-nums">{quote.is_valid_from?.split("-").reverse().join("/")}</div>
        <div className="text-sm text-right font-bold text-gray-900 tabular-nums">
          {Number(quote.totalHT).toLocaleString("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 })}
        </div>
        <div className="text-center">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${status.cls}`}>
            {status.label}
          </span>
        </div>
        <div className="text-center">
          <MarginPill ratio={quote.netProfitRatio} />
        </div>
      </div>
    </Link>
  );
}
