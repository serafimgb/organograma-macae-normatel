"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  name?: string;
  ativos: number;
  afastados: number;
}

interface HeadcountChartProps {
  data: DataPoint[];
  labels?: { ativos: string; afastados: string };
}

export function HeadcountChart({
  data,
  labels = { ativos: "Ativos", afastados: "Afastados" },
}: HeadcountChartProps) {
  const chartData = data.map((d) => {
    const row: Record<string, string | number | undefined> = { name: (d as { name?: string }).name };
    row[labels.ativos] = d.ativos;
    if (labels.afastados) row[labels.afastados] = d.afastados;
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12 }} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12 }}
          width={120}
        />
        <Tooltip />
        <Legend />
        <Bar dataKey={labels.ativos} fill="#10b981" radius={[0, 4, 4, 0]} />
        {labels.afastados && (
          <Bar dataKey={labels.afastados} fill="#f59e0b" radius={[0, 4, 4, 0]} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
