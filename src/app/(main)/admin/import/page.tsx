import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImportForm } from "@/components/admin/import-form";

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/projects");

  const projects = await db.project.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar Excel</h1>
        <p className="text-sm text-muted-foreground">
          Importação em lote de colaboradores via arquivo .xlsx
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Colunas esperadas na planilha</CardTitle>
          <CardDescription>
            O arquivo deve conter as colunas abaixo (maiúsculas/minúsculas indiferente):
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm font-mono">
            {["CHAPA", "NOME", "FUNÇÃO", "CPF", "ADMISSÃO", "DEMISSÃO", "SIT", "PROJETO", "BASE", "CARTEIRA"].map((col) => (
              <div key={col} className="rounded bg-muted px-2 py-1">{col}</div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            • A coluna SIT aceita: ATIVO, DESLIGADO, AFASTADO, FÉRIAS, LICENÇA<br />
            • Datas devem estar no formato DD/MM/YYYY ou DD-MM-YYYY<br />
            • A operação é um <strong>upsert</strong> por CHAPA + PROJETO: registros existentes são atualizados
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar arquivo</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportForm projects={projects} />
        </CardContent>
      </Card>
    </div>
  );
}
