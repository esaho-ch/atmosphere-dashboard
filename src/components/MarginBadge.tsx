"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getMarginLevel } from "@/lib/marginColor";

interface Props {
  ratio: number;
  target: number;
  label: string;
}

export default function MarginBadge({ ratio, target, label }: Props) {
  const level = getMarginLevel(ratio, target);
  const pct = (ratio * 100).toFixed(1);

  const styles = {
    good:    "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    bad:     "bg-red-50 text-red-700 border-red-200",
    neutral: "bg-slate-100 text-slate-400 border-slate-200",
  };

  const icons = { good: "✓", warning: "↗", bad: "✕", neutral: "" };

  return (
    <div className={cn("rounded-lg px-4 py-3 border", styles[level])}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{pct}%</p>
      <div className="flex items-center gap-1 mt-1">
        <span className="text-xs opacity-70">cible {(target * 100).toFixed(0)}%</span>
        {icons[level] && <span className="text-xs">{icons[level]}</span>}
      </div>
    </div>
  );
}
