import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImportForm } from "@/components/admin/import-form";

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/projects");

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
            {[
              "CHAPA", "NOME", "FUNÇÃO", "SALARIO ATUAL", "ADICIONAL", "CPF", "SEXO",
              "NASCIMENTO", "SITUAÇÃO", "ADMISSÃO", "DEMISSÃO", "PROJETO", "CARTEIRA", "LOTAÇÃO", "SINDICATO",
            ].map((col) => (
              <div key={col} className="rounded bg-muted px-2 py-1">{col}</div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            • A coluna PROJETO pode ter o código do projeto embutido no texto (ex: "PROJETO 736 - MANUTENÇÃO...-SINDMETAL") — o código e o sindicato (último trecho após hífen) são extraídos automaticamente. Se a planilha tiver uma coluna SINDICATO separada, ela tem prioridade<br />
            • ADICIONAL é o percentual sobre o salário (insalubridade, periculosidade etc), ex: "30%" ou "40%" — entra só no cálculo do salário, não afeta a diária de alimentação<br />
            • LOTAÇÃO é onde o colaborador está alocado (ex: UTE, Áreas Externas, Tapera, Cabiúnas, Severina, Barra do Furado) — mesmo campo exibido como "Base" nas telas de Efetivo e Salários<br />
            • A coluna SITUAÇÃO aceita: ATIVO, DESLIGADO, AFASTADO, FÉRIAS, LICENÇA<br />
            • Datas devem estar no formato DD/MM/YYYY ou DD-MM-YYYY<br />
            • A operação é um <strong>upsert</strong> por CHAPA + PROJETO: registros existentes são atualizados, e colunas em branco na planilha não apagam valores já cadastrados (mantém o mais recente que cada colaborador já tinha)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Selecionar arquivo</CardTitle>
        </CardHeader>
        <CardContent>
          <ImportForm />
        </CardContent>
      </Card>
    </div>
  );
}
