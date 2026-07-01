"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { getMarginLevel } from "@/lib/marginColor";

interface Props {
  quote: any;
}

const STATUS_CONFIG: Record<number, { label: string; className: string }> = {
  1: { label: "Brouillon",  className: "bg-slate-100 text-slate-600 border border-slate-200" },
  2: { label: "En attente", className: "bg-amber-50 text-amber-700 border border-amber-200" },
  3: { label: "Confirmée",  className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  4: { label: "Refusée",    className: "bg-red-50 text-red-600 border border-red-200" },
  5: { label: "Annulée",    className: "bg-slate-100 text-slate-500 border border-slate-200" },
};

const NET_TARGET = 0.08;

const marginBadgeClass: Record<string, string> = {
  good:    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border border-amber-200",
  bad:     "bg-red-50 text-red-600 border border-red-200",
  neutral: "bg-slate-100 text-slate-400 border border-slate-200",
};

function StatusPill({ statusId }: { statusId: number }) {
  const s = STATUS_CONFIG[statusId] ?? { label: String(statusId), className: "bg-slate-100 text-slate-500 border border-slate-200" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", s.className)}>
      {s.label}
    </span>
  );
}

function MarginPill({ ratio }: { ratio: number | null }) {
  if (ratio === null) return <span className="text-xs text-slate-400">—</span>;
  const level = getMarginLevel(ratio, NET_TARGET);
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums", marginBadgeClass[level])}>
      {ratio >= 0 ? "+" : ""}{(ratio * 100).toFixed(1)}%
    </span>
  );
}

export default function QuoteRow({ quote }: Props) {
  return (
    <Link href={`/quotes/${quote.id}`} className="block hover:bg-slate-50 transition-colors">
      <div className="grid grid-cols-7 gap-4 px-6 py-3.5 items-center border-b border-slate-100 last:border-0">
        <div className="text-xs font-mono text-slate-400 tracking-tight">{quote.document_nr}</div>
        <div className="text-sm font-medium text-slate-900 truncate col-span-2">{quote.contact_name || "—"}</div>
        <div className="text-sm text-slate-500 tabular-nums">{quote.is_valid_from?.split("-").reverse().join("/")}</div>
        <div className="text-sm text-right font-bold text-slate-900 tabular-nums">
          {Number(quote.totalHT).toLocaleString("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 })}
        </div>
        <div className="flex justify-center">
          <StatusPill statusId={quote.status_id} />
        </div>
        <div className="flex justify-center">
          <MarginPill ratio={quote.netProfitRatio} />
        </div>
      </div>
    </Link>
  );
}
