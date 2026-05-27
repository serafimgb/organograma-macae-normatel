"use client";

import { cn } from "@/lib/utils";

interface MatrizRow {
  carteira: string;
  [base: string]: string | number;
}

interface MatrizCarteiraBaseProps {
  data: MatrizRow[];
  bases: string[];
}

function heatColor(value: number, max: number): string {
  const pct = max === 0 ? 0 : value / max;
  if (pct === 0) return "bg-muted text-muted-foreground";
  if (pct < 0.25) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (pct < 0.5) return "bg-emerald-200 text-emerald-900 dark:bg-emerald-800/50 dark:text-emerald-100";
  if (pct < 0.75) return "bg-emerald-400 text-white dark:bg-emerald-700 dark:text-white";
  return "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white";
}

export function MatrizCarteiraBase({ data, bases }: MatrizCarteiraBaseProps) {
  const allValues = data.flatMap((row) =>
    bases.map((b) => Number(row[b] ?? 0))
  );
  const max = Math.max(...allValues, 1);

  return (
    <table className="min-w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className="border px-3 py-2 text-left font-semibold bg-muted text-muted-foreground">
            Carteira
          </th>
          {bases.map((b) => (
            <th
              key={b}
              className="border px-3 py-2 text-center font-semibold bg-muted text-muted-foreground whitespace-nowrap"
            >
              {b}
            </th>
          ))}
          <th className="border px-3 py-2 text-center font-semibold bg-muted text-muted-foreground">
            Total
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => {
          const total = bases.reduce((s, b) => s + Number(row[b] ?? 0), 0);
          return (
            <tr key={row.carteira}>
              <td className="border px-3 py-2 font-medium whitespace-nowrap">{row.carteira}</td>
              {bases.map((b) => {
                const val = Number(row[b] ?? 0);
                return (
                  <td
                    key={b}
                    className={cn(
                      "border px-3 py-2 text-center font-semibold",
                      heatColor(val, max)
                    )}
                  >
                    {val || "—"}
                  </td>
                );
              })}
              <td className="border px-3 py-2 text-center font-bold">{total}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
