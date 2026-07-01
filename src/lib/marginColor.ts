export type MarginLevel = "good" | "warning" | "bad" | "neutral";

export function getMarginLevel(ratio: number | null, target: number): MarginLevel {
  if (ratio === null) return "neutral";
  if (ratio >= target) return "good";
  if (ratio >= 0) return "warning";
  return "bad";
}

export const marginClasses: Record<MarginLevel, { badge: string; text: string; bg: string; border: string }> = {
  good:    { badge: "bg-emerald-50 text-emerald-700 border border-emerald-200", text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  warning: { badge: "bg-amber-50 text-amber-700 border border-amber-200",       text: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200"   },
  bad:     { badge: "bg-red-50 text-red-700 border border-red-200",             text: "text-red-600",     bg: "bg-red-50",     border: "border-red-200"     },
  neutral: { badge: "bg-gray-100 text-gray-400 border border-gray-200",         text: "text-gray-400",    bg: "bg-gray-50",    border: "border-gray-200"    },
};
