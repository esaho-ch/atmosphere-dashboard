"use client";

import { getMarginLevel, marginClasses } from "@/lib/marginColor";

interface Props {
  ratio: number;
  target: number;
  label: string;
}

export default function MarginBadge({ ratio, target, label }: Props) {
  const level = getMarginLevel(ratio, target);
  const cls = marginClasses[level];
  const pct = (ratio * 100).toFixed(1);

  return (
    <div className={`rounded-lg px-4 py-3 ${cls.bg} ${cls.border} border`}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${cls.text}`}>{pct}%</div>
      <div className="flex items-center gap-1 mt-1">
        <span className={`text-xs ${cls.text} opacity-70`}>cible {(target * 100).toFixed(0)}%</span>
        {level === "good" && <span className="text-xs text-emerald-600">✓</span>}
        {level === "warning" && <span className="text-xs text-amber-600">↗</span>}
        {level === "bad" && <span className="text-xs text-red-600">✕</span>}
      </div>
    </div>
  );
}
