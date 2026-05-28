import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { Clock } from "lucide-react";

export default async function PendingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const status = session.user.status;
  if (status === "APPROVED") redirect("/projects");
  if (status === "REJECTED") redirect("/rejected");

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20">
      <div className="max-w-md w-full mx-4 text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-amber-100 p-6">
            <Clock className="h-12 w-12 text-amber-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Aguardando aprovação</h1>
          <p className="text-muted-foreground">
            Olá, <span className="font-medium text-foreground">{session.user.name ?? session.user.email}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Seu acesso está pendente de aprovação por um administrador.
            Assim que aprovado, você poderá acessar o sistema automaticamente.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 text-left space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Conta cadastrada</p>
          <p className="text-sm font-medium">{session.user.name}</p>
          <p className="text-xs text-muted-foreground">{session.user.email}</p>
        </div>

        <div className="space-y-3">
          <a
            href="/projects"
            className="block w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium text-center hover:bg-primary/90 transition-colors"
          >
            Verificar aprovação
          </a>
          <form action={handleSignOut}>
            <button
              type="submit"
              className="w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Sair
            </button>
          </form>
        </div>

        <p className="text-xs text-muted-foreground">
          Se precisar de acesso urgente, entre em contato com o administrador do sistema.
        </p>
      </div>
    </div>
  );
}
