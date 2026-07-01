"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface Props {
  data: { name: string; total: number }[];
}

const SHORT: Record<string, string> = {
  "AD Carrelage SA":    "AD Carrelage",
  "Carrelages Sassi SA": "Sassi",
  "ETSA — MIC Marly":  "ETSA / MIC",
  "Nelson (autres clients)": "Nelson",
};

const COLORS = ["#1e293b", "#334155", "#64748b", "#94a3b8"];

const CHF = (n: number) =>
  "CHF " + Math.round(n).toLocaleString("fr-CH").replace(/\s/g, "'");

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-slate-800 mb-0.5">{label}</p>
      <p className="text-slate-600 tabular-nums">{CHF(payload[0].value)}</p>
    </div>
  );
};

export default function ClientGroupsBar({ data }: Props) {
  const chartData = data.map((d) => ({
    name: SHORT[d.name] ?? d.name,
    value: d.total,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 40 }} barCategoryGap="35%">
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
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
