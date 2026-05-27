import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission, canViewTab } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserMinus, UserX, TrendingUp } from "lucide-react";
import { HeadcountChart } from "@/components/dashboard/headcount-chart";
import { MatrizCarteiraBase } from "@/components/dashboard/matriz-carteira-base";

export default async function DashboardPage({ params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const project = await db.project.findUnique({
    where: { code: params.code },
    select: { id: true, code: true, name: true },
  });
  if (!project) notFound();

  const hasAccess = await requirePermission(
    { userId: session.user.id, role: session.user.role, projectId: project.id },
    "view"
  );
  if (!hasAccess) redirect("/projects");

  const tabOk = await canViewTab(session.user.id, session.user.role, project.id, "dashboard");
  if (!tabOk) redirect("/projects");

  const allEmployees = await db.employee.findMany({
    where: { projectId: project.id },
    select: {
      situacao: true,
      admissao: true,
      carteira: { select: { name: true } },
      base: { select: { name: true } },
    },
  });

  // Headcount por situação
  const totalAtivos = allEmployees.filter((e) => e.situacao === "ATIVO").length;
  const totalAfastados = allEmployees.filter((e) =>
    ["AFASTADO", "FERIAS", "LICENCA"].includes(e.situacao)
  ).length;
  const totalDesligados = allEmployees.filter((e) => e.situacao === "DESLIGADO").length;
  const headcountLiquido = totalAtivos + totalAfastados;

  // Headcount por carteira
  const carteiraMapRaw = new Map<string, { ativos: number; afastados: number; desligados: number }>();
  for (const emp of allEmployees) {
    const k = emp.carteira?.name ?? "Sem Carteira";
    if (!carteiraMapRaw.has(k)) carteiraMapRaw.set(k, { ativos: 0, afastados: 0, desligados: 0 });
    const c = carteiraMapRaw.get(k)!;
    if (emp.situacao === "ATIVO") c.ativos++;
    else if (["AFASTADO", "FERIAS", "LICENCA"].includes(emp.situacao)) c.afastados++;
    else c.desligados++;
  }
  const carteiraData = [...carteiraMapRaw.entries()]
    .map(([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => b.ativos + b.afastados - (a.ativos + a.afastados));

  // Admissões por ano
  const movMap = new Map<string, number>();
  for (const emp of allEmployees) {
    const year = new Date(emp.admissao).getFullYear().toString();
    movMap.set(year, (movMap.get(year) ?? 0) + 1);
  }
  const movData = [...movMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ano, admissoes]) => ({ ano, admissoes, desligamentos: 0 }));

  // Matriz carteira × base (top 5 carteiras ativas)
  const top5 = carteiraData
    .filter((c) => c.name !== "Sem Carteira")
    .slice(0, 5)
    .map((c) => c.name);
  const uniqueBases = [
    ...new Set(
      allEmployees
        .map((e) => e.base?.name ?? "")
        .filter(Boolean)
        .sort()
    ),
  ];
  const matrizData = top5.map((cartName) => {
    const row: Record<string, string | number> = { carteira: cartName };
    for (const base of uniqueBases) {
      row[base] = allEmployees.filter(
        (e) =>
          (e.carteira?.name ?? "") === cartName &&
          (e.base?.name ?? "") === base &&
          e.situacao !== "DESLIGADO"
      ).length;
    }
    return row;
  });

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="font-mono">#{project.code}</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground mt-1">Dashboard de efetivo</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalAtivos}</div>
            <p className="text-xs text-muted-foreground">colaboradores em atividade</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Afastados / Férias</CardTitle>
            <UserMinus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{totalAfastados}</div>
            <p className="text-xs text-muted-foreground">em afastamento, férias ou licença</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Desligados</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalDesligados}</div>
            <p className="text-xs text-muted-foreground">no histórico do projeto</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Headcount Líquido</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{headcountLiquido}</div>
            <p className="text-xs text-muted-foreground">ativos + afastados</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Headcount por Carteira — tabela */}
        <Card>
          <CardHeader>
            <CardTitle>Headcount por Carteira</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {carteiraData.length === 0 ? (
              <p className="text-sm text-muted-foreground px-6 py-8 text-center">Nenhum dado disponível</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Carteira</TableHead>
                    <TableHead className="text-right">Ativos</TableHead>
                    <TableHead className="text-right">Afastados</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {carteiraData.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right text-emerald-600">{c.ativos}</TableCell>
                      <TableCell className="text-right text-amber-600">{c.afastados}</TableCell>
                      <TableCell className="text-right font-semibold">{c.ativos + c.afastados}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Headcount por Carteira — gráfico */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Carteira</CardTitle>
          </CardHeader>
          <CardContent>
            <HeadcountChart data={carteiraData} />
          </CardContent>
        </Card>
      </div>

      {/* Carteira × Base */}
      {matrizData.length > 0 && uniqueBases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Carteira × Base (Top 5 carteiras)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <MatrizCarteiraBase data={matrizData} bases={uniqueBases} />
          </CardContent>
        </Card>
      )}

      {/* Admissões por ano */}
      {movData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Admissões por Ano</CardTitle>
          </CardHeader>
          <CardContent>
            <HeadcountChart
              data={movData.map((m) => ({ name: m.ano, ativos: m.admissoes, afastados: 0 }))}
              labels={{ ativos: "Admissões", afastados: "" as string }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
