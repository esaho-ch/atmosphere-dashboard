"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Props {
  data: { label: string; amount: number }[];
}

const COLORS: Record<string, string> = {
  "Payée":               "#10b981",
  "Partiellement payée": "#f59e0b",
  "En suspens":          "#94a3b8",
};

const CHF = (n: number) =>
  "CHF " + Math.round(n).toLocaleString("fr-CH").replace(/\s/g, "'");

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-slate-800">{name}</p>
      <p className="text-slate-600 tabular-nums">{CHF(value)}</p>
    </div>
  );
};

export default function PaymentDonut({ data }: Props) {
  const chartData = data.map((d) => ({ name: d.label, value: d.amount }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name] ?? "#cbd5e1"} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span className="text-xs text-slate-600">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
