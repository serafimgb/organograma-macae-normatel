"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEntranceMotion } from "@/lib/motion";

export function SindicatoConfigEditor({
  projectCode,
  diariaAlimentacao,
}: {
  projectCode: string;
  diariaAlimentacao: number | null;
}) {
  const router = useRouter();
  const { hoverLift } = useEntranceMotion();
  const [value, setValue] = useState(diariaAlimentacao?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/projects/${projectCode}/salarios/sindicato`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diariaAlimentacao: Number(value) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao salvar");
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div {...hoverLift}>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Diária de Alimentação (Sindicato)</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Valor único do projeto (R$)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => { setValue(e.target.value); setSaved(false); }}
              placeholder="0,00"
              className="w-40"
            />
          </div>
          <Button onClick={handleSave} disabled={saving || value === ""}>
            {saving ? "Salvando..." : saved ? "Salvo" : "Salvar"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}
