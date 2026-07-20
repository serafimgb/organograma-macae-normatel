import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission, canViewSalaryInProject, isSalaryManagerInProject } from "@/lib/permissions";
import { calcularCustoTotalColaborador } from "@/lib/calcularCustoTotal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SalarioCharts } from "@/components/salarios/salario-charts";
import { SalaryEmployeeTable, type SalaryEmployeeRow } from "@/components/salarios/salary-employee-table";
import { SindicatoConfigEditor } from "@/components/salarios/sindicato-config-editor";
import { SalaryImportForm } from "@/components/salarios/salary-import-form";
import { DollarSign, Users, TrendingUp } from "lucide-react";

export default async function SalariosPage({ params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const project = await db.project.findUnique({
    where: { code: params.code },
    select: { id: true, code: true, name: true, sindicatoConfig: true },
  });
  if (!project) notFound();

  const hasAccess = await requirePermission(
    { userId: session.user.id, role: session.user.role, projectId: project.id },
    "view"
  );
  if (!hasAccess) redirect("/projects");

  // LGPD: sem bypass para ADMIN, verificação explícita obrigatória
  const canSeeSalary = await canViewSalaryInProject(session.user.id, session.user.role, project.id);
  if (!canSeeSalary) redirect("/projects");

  const canManage = await isSalaryManagerInProject(session.user.id, project.id);

  const employees = await db.employee.findMany({
    where: { projectId: project.id, situacao: { not: "DESLIGADO" } },
    include: {
      funcao: { select: { name: true } },
      carteira: { select: { name: true } },
      base: { select: { name: true } },
      salaryBenefit: true, // Incluir SalaryBenefit para cálculo de custo total
    },
    orderBy: { nome: "asc" },
  });

  const withSalary = employees.filter((e) => e.salary != null);

  const totalFolha = withSalary.reduce((acc, e) => acc + Number(e.salary), 0);
  const mediaSalarial = withSalary.length > 0 ? totalFolha / withSalary.length : 0;

  // Agregado por carteira
  const carteiraMap = new Map<string, { total: number; count: number }>();
  for (const emp of withSalary) {
    const key = emp.carteira?.name ?? "Sem Carteira";
    const cur = carteiraMap.get(key) ?? { total: 0, count: 0 };
    carteiraMap.set(key, { total: cur.total + Number(emp.salary), count: cur.count + 1 });
  }
  const carteiraData = [...carteiraMap.entries()]
    .map(([name, { total, count }]) => ({ name, total, media: count > 0 ? total / count : 0, count }))
    .sort((a, b) => b.total - a.total);

  // Média por função (top 10)
  const funcaoMap = new Map<string, { total: number; count: number }>();
  for (const emp of withSalary) {
    const key = emp.funcao.name;
    const cur = funcaoMap.get(key) ?? { total: 0, count: 0 };
    funcaoMap.set(key, { total: cur.total + Number(emp.salary), count: cur.count + 1 });
  }
  const funcaoData = [...funcaoMap.entries()]
    .map(([name, { total, count }]) => ({ name, media: count > 0 ? total / count : 0 }))
    .sort((a, b) => b.media - a.media)
    .slice(0, 10);

  // Custo total carregado (salário + encargos + diária) vs. folha base (só salário)
  const custoTotalCarregado = withSalary.reduce(
    (acc, e) =>
      acc +
      calcularCustoTotalColaborador({
        salary: e.salary,
        benefit: e.salaryBenefit,
        diariaAlimentacao: project.sindicatoConfig?.diariaAlimentacao,
      }),
    0
  );
  const custoTotalData = [
    { label: "Folha Base", total: totalFolha },
    { label: "Custo Total Carregado", total: custoTotalCarregado },
  ];

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const tableRows: SalaryEmployeeRow[] = employees.map((emp) => ({
    id: emp.id,
    nome: emp.nome,
    funcao: emp.funcao.name,
    carteira: emp.carteira?.name ?? null,
    base: emp.base?.name ?? null,
    situacao: emp.situacao,
    salary: emp.salary != null ? Number(emp.salary) : null,
    planoSaude: emp.salaryBenefit?.planoSaude != null ? Number(emp.salaryBenefit.planoSaude) : null,
    planoOdontologico: emp.salaryBenefit?.planoOdontologico != null ? Number(emp.salaryBenefit.planoOdontologico) : null,
    seguroVida: emp.salaryBenefit?.seguroVida != null ? Number(emp.salaryBenefit.seguroVida) : null,
  }));

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="font-mono">#{project.code}</Badge>
            <Badge variant="destructive" className="text-xs">Restrito LGPD</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground mt-1">Análise de salários · acesso controlado</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total da Folha</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{fmt(totalFolha)}</div>
            <p className="text-xs text-muted-foreground">{withSalary.length} colaboradores com salário</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Headcount Ativo</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-xs text-muted-foreground">ativos + afastados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salário Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(mediaSalarial)}</div>
            <p className="text-xs text-muted-foreground">entre quem tem salário cadastrado</p>
          </CardContent>
        </Card>
      </div>

      {/* Gestão (só para isSalaryManager) */}
      {canManage && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SindicatoConfigEditor
            projectCode={project.code}
            diariaAlimentacao={
              project.sindicatoConfig?.diariaAlimentacao != null
                ? Number(project.sindicatoConfig.diariaAlimentacao)
                : null
            }
          />
          <SalaryImportForm projectCode={project.code} />
        </div>
      )}

      {/* Gráficos */}
      <SalarioCharts carteiraData={carteiraData} funcaoData={funcaoData} custoTotalData={custoTotalData} />

      {/* Tabela individual */}
      <SalaryEmployeeTable employees={tableRows} projectCode={project.code} canManage={canManage} />
    </div>
  );
}
