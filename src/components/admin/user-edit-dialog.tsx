"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Settings } from "lucide-react";

interface Project {
  id: string;
  code: string;
  name: string;
}

interface UserPerm {
  projectId: string;
  canViewDashboard: boolean;
  canViewOrganograma: boolean;
  canViewEfetivo: boolean;
  canEdit: boolean;
  isSalaryManager: boolean;
}

interface UserEditDialogProps {
  userId: string;
  userName: string | null;
  userEmail: string;
  userRole: "Admin" | "Gestor" | "Visualizador";
  permissions: UserPerm[];
  projects: Project[];
}

const ROLES = ["Admin", "Gestor", "Visualizador"] as const;
type Role = typeof ROLES[number];

export function UserEditDialog({
  userId,
  userName,
  userEmail,
  userRole,
  permissions,
  projects,
}: UserEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(userRole);
  const [perms, setPerms] = useState<Record<string, UserPerm>>(() => {
    const map: Record<string, UserPerm> = {};
    for (const p of permissions) map[p.projectId] = { ...p };
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAccess = (projectId: string) => {
    setPerms((prev) => {
      const next = { ...prev };
      if (next[projectId]) {
        delete next[projectId];
      } else {
        next[projectId] = {
          projectId,
          canViewDashboard: true,
          canViewOrganograma: true,
          canViewEfetivo: true,
          canEdit: false,
          isSalaryManager: false,
        };
      }
      return next;
    });
  };

  const setFlag = (projectId: string, flag: keyof Omit<UserPerm, "projectId">, value: boolean) => {
    setPerms((prev) => ({
      ...prev,
      [projectId]: { ...prev[projectId], [flag]: value },
    }));
  };

  const roleToDb: Record<Role, string> = { Admin: "ADMIN", Gestor: "MANAGER", Visualizador: "VIEWER" };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // 1. Atualiza role
      await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: roleToDb[role] }),
      }).then((r) => { if (!r.ok) throw new Error("Erro ao salvar role"); });

      // 2. Atualiza permissões por projeto
      for (const project of projects) {
        const perm = perms[project.id];
        await fetch("/api/admin/permissions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            projectId: project.id,
            remove: !perm,
            ...(perm ?? {}),
          }),
        }).then((r) => { if (!r.ok) throw new Error(`Erro ao salvar permissões do projeto ${project.code}`); });
      }

      setOpen(false);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-3.5 w-3.5 mr-1" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar permissões — {userName ?? userEmail}</DialogTitle>
        </DialogHeader>

        {/* Role */}
        <div className="mb-6">
          <p className="text-sm font-medium mb-2">Papel (role)</p>
          <div className="flex gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  role === r
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Permissões por projeto */}
        <div className="space-y-4">
          <p className="text-sm font-medium">Acesso por projeto</p>
          {projects.map((project) => {
            const hasPerm = !!perms[project.id];
            const perm = perms[project.id];
            return (
              <div key={project.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">#{project.code}</span>
                    <span className="text-muted-foreground text-sm ml-2">{project.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Acesso</span>
                    <Switch checked={hasPerm} onCheckedChange={() => toggleAccess(project.id)} />
                  </div>
                </div>

                {hasPerm && perm && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    {(
                      [
                        ["canViewDashboard", "Dashboard"],
                        ["canViewOrganograma", "Organograma"],
                        ["canViewEfetivo", "Efetivo"],
                        ["canEdit", "Pode editar"],
                        ["isSalaryManager", "Gestor de salários"],
                      ] as [keyof Omit<UserPerm, "projectId">, string][]
                    ).map(([flag, label]) => (
                      <div key={flag} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <Switch
                          checked={!!perm[flag]}
                          onCheckedChange={(v) => setFlag(project.id, flag, v)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="text-sm text-destructive mt-2">{error}</p>}

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
