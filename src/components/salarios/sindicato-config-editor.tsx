"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { useEntranceMotion } from "@/lib/motion";

interface Row {
  sindicato: string;
  label: string;
  diariaAlimentacao: number | null;
}

export function SindicatoConfigEditor({
  projectCode,
  configs,
  sindicatosPresentes,
  diasUteis,
}: {
  projectCode: string;
  configs: { sindicato: string; diariaAlimentacao: number }[];
  sindicatosPresentes: string[];
  diasUteis: number;
}) {
  const router = useRouter();
  const { hoverLift } = useEntranceMotion();

  const initialRows: Row[] = (() => {
    const byKey = new Map<string, Row>();
    byKey.set("", { sindicato: "", label: "Padrão (sem sindicato)", diariaAlimentacao: null });
    for (const s of sindicatosPresentes) {
      if (!byKey.has(s)) byKey.set(s, { sindicato: s, label: s, diariaAlimentacao: null });
    }
    for (const c of configs) {
      const existing = byKey.get(c.sindicato);
      if (existing) existing.diariaAlimentacao = c.diariaAlimentacao;
      else byKey.set(c.sindicato, { sindicato: c.sindicato, label: c.sindicato || "Padrão (sem sindicato)", diariaAlimentacao: c.diariaAlimentacao });
    }
    return Array.from(byKey.values());
  })();

  const [rows, setRows] = useState<Row[]>(initialRows);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(initialRows.map((r) => [r.sindicato, r.diariaAlimentacao?.toString() ?? ""]))
  );
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newSindicato, setNewSindicato] = useState("");

  async function save(sindicato: string) {
    const value = values[sindicato];
    if (value === undefined || value === "") return;
    setSavingKey(sindicato);
    setError(null);
    try {
      const res = await fetch(`/projects/${projectCode}/salarios/sindicato`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sindicato, diariaAlimentacao: Number(value) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao salvar");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSavingKey(null);
    }
  }

  function addSindicato() {
    const name = newSindicato.trim();
    if (!name || rows.some((r) => r.sindicato === name)) return;
    setRows((prev) => [...prev, { sindicato: name, label: name, diariaAlimentacao: null }]);
    setValues((prev) => ({ ...prev, [name]: "" }));
    setNewSindicato("");
  }

  return (
    <motion.div {...hoverLift}>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Diária de Alimentação por Sindicato</CardTitle>
          <p className="text-xs text-muted-foreground">
            Multiplicada pelos dias úteis do mês atual ({diasUteis} dias) no cálculo do custo total carregado.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row) => (
            <div key={row.sindicato} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{row.label}</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={values[row.sindicato] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [row.sindicato]: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <Button
                size="sm"
                onClick={() => save(row.sindicato)}
                disabled={savingKey === row.sindicato || !values[row.sindicato]}
              >
                {savingKey === row.sindicato ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          ))}

          <div className="flex items-end gap-2 pt-2 border-t">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Adicionar sindicato</label>
              <Input
                value={newSindicato}
                onChange={(e) => setNewSindicato(e.target.value)}
                placeholder="Nome do sindicato"
              />
            </div>
            <Button size="sm" variant="outline" onClick={addSindicato} disabled={!newSindicato.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}
