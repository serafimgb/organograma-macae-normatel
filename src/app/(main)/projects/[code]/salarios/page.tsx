import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission, canViewSalaryInProject, isSalaryManagerInProject } from "@/lib/permissions";
import { calcularCustoTotalColaborador, diasUteisNoMes, resolveDiariaInfo, salarioComAdicional } from "@/lib/calcularCustoTotal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SalarioCharts } from "@/components/salarios/salario-charts";
import { SalaryEmployeeTable, type SalaryEmployeeRow } from "@/components/salarios/salary-employee-table";
import { SindicatoConfigEditor } from "@/components/salarios/sindicato-config-editor";
import { DollarSign, Users, TrendingUp, AlertTriangle } from "lucide-react";

export default async function SalariosPage({ params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const project = await db.project.findUnique({
    where: { code: params.code },
    select: {
      id: true,
      code: true,
      name: true,
      sindicatoConfigs: true,
      holidayCalendar: { select: { holidays: { select: { date: true } } } },
    },
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

  const holidayDates = project.holidayCalendar?.holidays.map((h) => h.date) ?? [];
  const diasUteis = diasUteisNoMes(new Date(), holidayDates);

  const diariaInfoOf = (e: { sindicato: string | null }) => resolveDiariaInfo(project.sindicatoConfigs, e.sindicato);

  const breakdownOf = (e: (typeof withSalary)[number]) =>
    calcularCustoTotalColaborador({
      salary: e.salary,
      adicionalPercentual: e.adicionalPercentual,
      benefit: e.salaryBenefit,
      diariaRate: diariaInfoOf(e).rate,
      diasUteis,
    });

  // Agregado por carteira (salário com adicional)
  const carteiraMap = new Map<string, { total: number; count: number }>();
  for (const emp of withSalary) {
    const key = emp.carteira?.name ?? "Sem Carteira";
    const cur = carteiraMap.get(key) ?? { total: 0, count: 0 };
    const salario = salarioComAdicional(emp.salary, emp.adicionalPercentual);
    carteiraMap.set(key, { total: cur.total + salario, count: cur.count + 1 });
  }
  const carteiraData = [...carteiraMap.entries()]
    .map(([name, { total, count }]) => ({ name, total, media: count > 0 ? total / count : 0, count }))
    .sort((a, b) => b.total - a.total);

  // Agregado por lotação (Base): salário, encargos, vale e total separados
  const lotacaoMap = new Map<string, { salario: number; encargos: number; vale: number; total: number; count: number }>();
  for (const emp of withSalary) {
    const key = emp.base?.name ?? "Sem Lotação";
    const cur = lotacaoMap.get(key) ?? { salario: 0, encargos: 0, vale: 0, total: 0, count: 0 };
    const b = breakdownOf(emp);
    lotacaoMap.set(key, {
      salario: cur.salario + b.salario,
      encargos: cur.encargos + b.encargos,
      vale: cur.vale + b.vale,
      total: cur.total + b.total,
      count: cur.count + 1,
    });
  }
  const lotacaoData = [...lotacaoMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total);

  // Média por função (top 10)
  const funcaoMap = new Map<string, { total: number; count: number }>();
  for (const emp of withSalary) {
    const key = emp.funcao.name;
    const cur = funcaoMap.get(key) ?? { total: 0, count: 0 };
    const salario = salarioComAdicional(emp.salary, emp.adicionalPercentual);
    funcaoMap.set(key, { total: cur.total + salario, count: cur.count + 1 });
  }
  const funcaoData = [...funcaoMap.entries()]
    .map(([name, { total, count }]) => ({ name, media: count > 0 ? total / count : 0 }))
    .sort((a, b) => b.media - a.media)
    .slice(0, 10);

  // Custo total carregado, separado por natureza: salário (com adicional) + encargos (planos) + vale (diária x dias úteis)
  const totais = withSalary.reduce(
    (acc, e) => {
      const b = breakdownOf(e);
      return { salario: acc.salario + b.salario, encargos: acc.encargos + b.encargos, vale: acc.vale + b.vale, total: acc.total + b.total };
    },
    { salario: 0, encargos: 0, vale: 0, total: 0 }
  );
  const custoTotalData = [
    { label: "Salário (com adicional)", total: totais.salario },
    { label: "Encargos (planos)", total: totais.encargos },
    { label: "Vale Alimentação", total: totais.vale },
    { label: "Custo Total Carregado", total: totais.total },
  ];

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const tableRows: SalaryEmployeeRow[] = employees.map((emp) => {
    const salary = emp.salary != null ? Number(emp.salary) : null;
    const adicionalPercentual = emp.adicionalPercentual != null ? Number(emp.adicionalPercentual) : null;
    const valorAdicional = salary != null && adicionalPercentual != null ? salary * (adicionalPercentual / 100) : 0;
    const salarioTotal = salary != null ? salarioComAdicional(salary, adicionalPercentual) : null;
    const planoSaude = emp.salaryBenefit?.planoSaude != null ? Number(emp.salaryBenefit.planoSaude) : null;
    const planoOdontologico = emp.salaryBenefit?.planoOdontologico != null ? Number(emp.salaryBenefit.planoOdontologico) : null;
    const seguroVida = emp.salaryBenefit?.seguroVida != null ? Number(emp.salaryBenefit.seguroVida) : null;
    const encargos = (planoSaude ?? 0) + (planoOdontologico ?? 0) + (seguroVida ?? 0);
    const diaria = diariaInfoOf(emp);
    const vale = diaria.rate * diasUteis;
    const custoTotal = (salarioTotal ?? 0) + encargos + vale;

    return {
      id: emp.id,
      nome: emp.nome,
      funcao: emp.funcao.name,
      carteira: emp.carteira?.name ?? null,
      base: emp.base?.name ?? null,
      sindicato: emp.sindicato,
      situacao: emp.situacao,
      salary,
      adicionalPercentual,
      valorAdicional,
      salarioTotal,
      diariaRate: diaria.rate,
      diasUteis,
      vale,
      valeStatus: diaria.source,
      planoSaude,
      planoOdontologico,
      seguroVida,
      encargos,
      custoTotal,
    };
  });

  // Alertas de qualidade de dado: colaboradores sem sindicato, com sindicato sem diária
  // EXATA configurada (caindo no valor padrão do projeto), sindicato sem NENHUM valor
  // configurado (vale sai R$0), ou sem salário cadastrado — pra nenhuma lacuna passar
  // despercebida pelo gestor.
  const semSalario = employees.filter((e) => e.salary == null).length;
  const semSindicato = employees.filter((e) => !e.sindicato).length;
  const sindicatosSemConfigExata = [
    ...new Set(
      employees
        .filter((e) => e.sindicato && diariaInfoOf(e).source !== "exact")
        .map((e) => e.sindicato as string)
    ),
  ].sort();
  const sindicatosZerados = [
    ...new Set(
      employees
        .filter((e) => e.sindicato && diariaInfoOf(e).source === "missing")
        .map((e) => e.sindicato as string)
    ),
  ].sort();

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

      {/* Alertas de qualidade de dado — nenhuma lacuna de cálculo passa em silêncio */}
      {(semSalario > 0 || semSindicato > 0 || sindicatosSemConfigExata.length > 0) && (
        <Card className="border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Pontos de atenção no cálculo deste contrato
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-amber-900 dark:text-amber-200 space-y-1.5">
              {semSalario > 0 && (
                <li>
                  • <strong>{semSalario}</strong> colaborador(es) sem salário cadastrado — não entram em nenhum total abaixo.
                </li>
              )}
              {semSindicato > 0 && (
                <li>
                  • <strong>{semSindicato}</strong> colaborador(es) sem sindicato cadastrado
                  {(() => {
                    const cfgDefault = project.sindicatoConfigs.find((c) => c.sindicato === "");
                    return cfgDefault
                      ? ` — usando a diária padrão do projeto (${fmt(Number(cfgDefault.diariaAlimentacao))}/dia).`
                      : " — sem diária padrão configurada, então o vale desses colaboradores está R$ 0,00.";
                  })()}
                </li>
              )}
              {sindicatosZerados.length > 0 && (
                <li>
                  • Sindicato(s) <strong>{sindicatosZerados.join(", ")}</strong> sem nenhuma diária configurada nem valor
                  padrão — o vale desses colaboradores está saindo <strong>R$ 0,00</strong>. Configure abaixo em
                  &quot;Diária de Alimentação por Sindicato&quot;.
                </li>
              )}
              {sindicatosSemConfigExata.filter((s) => !sindicatosZerados.includes(s)).length > 0 && (
                <li>
                  • Sindicato(s){" "}
                  <strong>{sindicatosSemConfigExata.filter((s) => !sindicatosZerados.includes(s)).join(", ")}</strong>{" "}
                  não têm diária própria cadastrada e estão usando o valor padrão do projeto — confirme se é
                  intencional.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

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

      {/* Composição do custo total: salário separado de encargos e vale */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Composição do Custo Total Carregado</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Salário (c/ adicional)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-emerald-600">{fmt(totais.salario)}</div>
              <p className="text-xs text-muted-foreground">salário-base + insalubridade/periculosidade</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Encargos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-sky-600">{fmt(totais.encargos)}</div>
              <p className="text-xs text-muted-foreground">plano saúde + odontológico + seguro de vida</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Vale Alimentação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-amber-600">{fmt(totais.vale)}</div>
              <p className="text-xs text-muted-foreground">diária por sindicato × {diasUteis} dias úteis</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Custo Total Carregado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{fmt(totais.total)}</div>
              <p className="text-xs text-muted-foreground">salário + encargos + vale</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Gestão (só para isSalaryManager) */}
      {canManage && (
        <SindicatoConfigEditor
          projectCode={project.code}
          configs={project.sindicatoConfigs.map((c) => ({
            sindicato: c.sindicato,
            diariaAlimentacao: Number(c.diariaAlimentacao),
          }))}
          sindicatosPresentes={[...new Set(employees.map((e) => e.sindicato).filter((s): s is string => !!s))]}
          diasUteis={diasUteis}
        />
      )}

      {/* Custo por Lotação (Base) */}
      {lotacaoData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Custo Total Carregado por Lotação</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lotação</TableHead>
                  <TableHead className="text-right">Colaboradores</TableHead>
                  <TableHead className="text-right">Salário</TableHead>
                  <TableHead className="text-right">Encargos</TableHead>
                  <TableHead className="text-right">Vale</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotacaoData.map((l) => (
                  <TableRow key={l.name}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell className="text-right">{l.count}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(l.salario)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(l.encargos)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(l.vale)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmt(l.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      <SalarioCharts carteiraData={carteiraData} funcaoData={funcaoData} custoTotalData={custoTotalData} />

      {/* Tabela individual */}
      <SalaryEmployeeTable employees={tableRows} projectCode={project.code} canManage={canManage} />
    </div>
  );
}
