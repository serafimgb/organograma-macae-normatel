"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

export interface HolidayRow {
  id: string;
  date: string; // ISO yyyy-MM-dd
  name: string;
}

export function HolidayManager({ calendarId, holidays }: { calendarId: string; holidays: HolidayRow[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!date || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/calendars/${calendarId}/holidays`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao adicionar feriado");
      }
      setDate("");
      setName("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(holidayId: string) {
    setRemovingId(holidayId);
    try {
      await fetch(`/api/admin/calendars/${calendarId}/holidays/${holidayId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setRemovingId(null);
    }
  }

  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Data</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Nome do feriado</label>
          <Input placeholder="Ex: Aniversário de Macaé" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button onClick={handleAdd} disabled={saving || !date || !name.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="divide-y rounded-lg border">
        {sorted.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum feriado cadastrado ainda.</p>
        )}
        {sorted.map((h) => (
          <div key={h.id} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-muted-foreground">
                {new Date(h.date + "T00:00:00").toLocaleDateString("pt-BR")}
              </span>
              <span className="text-sm">{h.name}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleRemove(h.id)}
              disabled={removingId === h.id}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
