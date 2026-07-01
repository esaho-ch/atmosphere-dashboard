"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface Props {
  prevYear: number;
  curYear: number;
  data: {
    label: string;
    prev: number;
    cur: number;
  }[];
}

const CHF = (n: number) =>
  "CHF " + Math.round(n).toLocaleString("fr-CH").replace(/\s/g, "'");

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-sm space-y-1">
      <p className="font-semibold text-slate-800 mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="size-2 rounded-full inline-block" style={{ background: p.fill }} />
          <span className="text-slate-500 text-xs">{p.name}</span>
          <span className="text-slate-900 font-bold tabular-nums ml-auto pl-4">{CHF(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function ComparisonBar({ prevYear, curYear, data }: Props) {
  const SHORT: Record<string, string> = {
    "Total ordres (HT)":     "Ordres",
    "Total factures (HT)":   "Factures",
    "Montant encaissé (HT)": "Encaissé",
    "Solde non encaissé":    "Non encaissé",
  };

  const chartData = data.map((d) => ({
    name: SHORT[d.label] ?? d.label,
    [String(prevYear)]: d.prev,
    [String(curYear)]: d.cur,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 40 }} barCategoryGap="30%" barGap={4}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
        />
        <Bar dataKey={String(prevYear)} fill="#cbd5e1" radius={[3, 3, 0, 0]} />
        <Bar dataKey={String(curYear)} fill="#1e293b" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
