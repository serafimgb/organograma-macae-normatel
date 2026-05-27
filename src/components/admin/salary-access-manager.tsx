"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";

interface SalaryUser {
  id: string;
  name: string | null;
  email: string;
  canViewSalary: boolean;
}

interface ManagedProject {
  id: string;
  code: string;
  name: string;
  users: SalaryUser[];
}

export function SalaryAccessManager({ managedProjects }: { managedProjects: ManagedProject[] }) {
  const [salaryMap, setSalaryMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const proj of managedProjects) {
      for (const u of proj.users) {
        map[`${proj.id}:${u.id}`] = u.canViewSalary;
      }
    }
    return map;
  });
  const [saving, setSaving] = useState<string | null>(null);

  const toggle = async (projectId: string, userId: string, value: boolean) => {
    const key = `${projectId}:${userId}`;
    setSaving(key);
    try {
      const res = await fetch(`/api/salary/${projectId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, canViewSalary: value }),
      });
      if (!res.ok) throw new Error();
      setSalaryMap((prev) => ({ ...prev, [key]: value }));
    } catch {
      alert("Erro ao atualizar acesso. Tente novamente.");
    } finally {
      setSaving(null);
    }
  };

  if (managedProjects.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-semibold">Gestão de Acesso a Salários</h2>
        <Badge variant="destructive" className="text-xs">Restrito LGPD</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Você é gestor de salários nos projetos abaixo. Controle quem pode visualizar dados salariais.
      </p>

      {managedProjects.map((proj) => (
        <Card key={proj.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              #{proj.code} — {proj.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {proj.users.map((user) => {
              const key = `${proj.id}:${user.id}`;
              const canView = salaryMap[key] ?? false;
              return (
                <div key={user.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{user.name ?? user.email}</p>
                    {user.name && <p className="text-xs text-muted-foreground">{user.email}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {canView ? "Pode ver" : "Sem acesso"}
                    </span>
                    <Switch
                      checked={canView}
                      onCheckedChange={(v) => toggle(proj.id, user.id, v)}
                      disabled={saving === key}
                    />
                  </div>
                </div>
              );
            })}
            {proj.users.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhum outro usuário com acesso ao projeto.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
