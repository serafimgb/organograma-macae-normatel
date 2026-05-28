"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

interface Props {
  userId: string;
  userName: string | null;
  userEmail: string;
}

export function RejectUserButton({ userId, userName, userEmail }: Props) {
  const [loading, setLoading] = useState(false);

  const handleReject = async () => {
    const display = userName ?? userEmail;
    if (!confirm(`Rejeitar acesso de ${display}? Eles não poderão entrar no sistema.`)) return;

    setLoading(true);
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      });
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
      onClick={handleReject}
      disabled={loading}
    >
      <XCircle className="h-3.5 w-3.5" />
      {loading ? "..." : "Rejeitar"}
    </Button>
  );
}
