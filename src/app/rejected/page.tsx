import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { XCircle } from "lucide-react";

export default async function RejectedPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const status = session.user.status;
  if (status === "APPROVED") redirect("/projects");
  if (status === "PENDING") redirect("/pending");

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20">
      <div className="max-w-md w-full mx-4 text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-6">
            <XCircle className="h-12 w-12 text-red-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Acesso negado</h1>
          <p className="text-muted-foreground">
            Olá, <span className="font-medium text-foreground">{session.user.name ?? session.user.email}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Seu acesso a este sistema foi negado. Se acredita que isso é um erro,
            entre em contato com o administrador.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 text-left space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Conta</p>
          <p className="text-sm font-medium">{session.user.name}</p>
          <p className="text-xs text-muted-foreground">{session.user.email}</p>
        </div>

        <form action={handleSignOut}>
          <button
            type="submit"
            className="w-full rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
