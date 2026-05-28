"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";

interface Props {
  userId: string;
  userName: string | null;
  userEmail: string;
}

const ROLES = [
  { value: "VIEWER", label: "Visualizador", description: "Acesso somente leitura aos projetos" },
  { value: "MANAGER", label: "Gestor", description: "Pode editar dados nos projetos permitidos" },
  { value: "ADMIN", label: "Admin", description: "Acesso total ao sistema" },
] as const;

type Role = typeof ROLES[number]["value"];

export function UserApprovalDialog({ userId, userName, userEmail }: Props) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("VIEWER");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED", role }),
      });
      if (!res.ok) throw new Error("Erro ao aprovar usuário");
      setOpen(false);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      });
      if (!res.ok) throw new Error("Erro ao rejeitar usuário");
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
        <Button size="sm" className="gap-1">
          <CheckCircle className="h-3.5 w-3.5" />
          Aprovar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Aprovar acesso</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-0.5">
            <p className="text-sm font-medium">{userName ?? userEmail}</p>
            <p className="text-xs text-muted-foreground">{userEmail}</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Nível de acesso</p>
            <div className="space-y-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    role === r.value
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Após aprovação, configure os projetos e abas que este usuário pode acessar em &quot;Editar&quot;.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={handleReject}
              disabled={saving}
            >
              <XCircle className="h-3.5 w-3.5" />
              Rejeitar
            </Button>
            <Button className="flex-1 gap-1" onClick={handleApprove} disabled={saving}>
              <CheckCircle className="h-3.5 w-3.5" />
              {saving ? "Salvando..." : "Aprovar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
