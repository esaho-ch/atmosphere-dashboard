"use client";

interface Props {
  ratio: number;
  target: number;
  label: string;
}

export default function MarginBadge({ ratio, target, label }: Props) {
  const pct = (ratio * 100).toFixed(1);
  const ok = ratio >= target;
  return (
    <div className={`rounded-lg px-3 py-2 text-sm font-medium ${ok ? "bg-green-100 text-green-900" : "bg-red-100 text-red-900"}`}>
      <div className="text-xs font-semibold opacity-80">{label}</div>
      <div className="text-lg font-bold">{pct}%</div>
      <div className="text-xs opacity-70">cible {(target * 100).toFixed(0)}%</div>
    </div>
  );
}
