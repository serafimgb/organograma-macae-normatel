"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Loader2 } from "lucide-react";

interface ProjectUrlFormProps {
  projectId: string;
  code: string;
  name: string;
  organogramUrl: string | null;
  holidayCalendarId: string | null;
  calendars: { id: string; name: string }[];
}

export function ProjectUrlForm({
  projectId,
  code,
  name,
  organogramUrl,
  holidayCalendarId,
  calendars,
}: ProjectUrlFormProps) {
  const [url, setUrl] = useState(organogramUrl ?? "");
  const [calendarId, setCalendarId] = useState(holidayCalendarId ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await fetch(`/api/admin/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organogramUrl: url.trim(), holidayCalendarId: calendarId || null }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const isDirty = url.trim() !== (organogramUrl ?? "") || calendarId !== (holidayCalendarId ?? "");

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">
        <span className="font-mono text-xs text-muted-foreground mr-2">#{code}</span>
        {name}
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="https://... (deixe vazio para usar o organograma interno)"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setSaved(false); }}
          className="flex-1 text-sm"
        />
        <Select value={calendarId || "_none_"} onValueChange={(v) => { setCalendarId(v === "_none_" ? "" : v); setSaved(false); }}>
          <SelectTrigger className="w-48 text-sm">
            <SelectValue placeholder="Calendário de feriados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none_">Sem calendário</SelectItem>
            {calendars.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !isDirty}
          variant={saved ? "secondary" : "default"}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <><Check className="h-4 w-4 mr-1" /> Salvo</>
          ) : (
            "Salvar"
          )}
        </Button>
      </div>
    </div>
  );
}
