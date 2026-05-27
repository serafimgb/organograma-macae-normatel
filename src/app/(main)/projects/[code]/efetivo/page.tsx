import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import type { Prisma, Situacao } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission, canViewSalaryInProject, canViewTab } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { EfetivoTable } from "@/components/efetivo/efetivo-table";

interface EmployeeRow {
  id: string;
  chapa: string;
  nome: string;
  funcao: string;
  carteira: string;
  base: string;
  situacao: "ATIVO" | "DESLIGADO" | "AFASTADO" | "FERIAS" | "LICENCA";
  admissao: string;
  demissao: string | null;
  salary: number | null;
}

export default async function EfetivoPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { situacao?: string; carteira?: string; base?: string; q?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const project = await db.project.findUnique({
    where: { code: params.code },
    include: {
      carteiras: { select: { id: true, name: true } },
      bases: { select: { id: true, name: true } },
    },
  });
  if (!project) notFound();

  const hasAccess = await requirePermission(
    { userId: session.user.id, role: session.user.role, projectId: project.id },
    "view"
  );
  if (!hasAccess) redirect("/projects");

  const tabOk = await canViewTab(session.user.id, session.user.role, project.id, "efetivo");
  if (!tabOk) redirect("/projects");

  const showSalary = await canViewSalaryInProject(session.user.id, session.user.role, project.id);

  const where: Prisma.EmployeeWhereInput = {
    projectId: project.id,
    ...(searchParams.situacao && searchParams.situacao !== "TODOS"
      ? { situacao: searchParams.situacao as Situacao }
      : {}),
    ...(searchParams.carteira ? { carteiraId: searchParams.carteira } : {}),
    ...(searchParams.base ? { baseId: searchParams.base } : {}),
    ...(searchParams.q
      ? {
          OR: [
            { nome: { contains: searchParams.q, mode: "insensitive" } },
            { chapa: { contains: searchParams.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const employees = await db.employee.findMany({
    where,
    include: {
      funcao: { select: { name: true } },
      carteira: { select: { name: true } },
      base: { select: { name: true } },
    },
    orderBy: { nome: "asc" },
    take: 500,
  });

  const rows: EmployeeRow[] = employees.map((e) => ({
    id: e.id,
    chapa: e.chapa,
    nome: e.nome,
    funcao: e.funcao.name,
    carteira: e.carteira?.name ?? "—",
    base: e.base?.name ?? "—",
    situacao: e.situacao as EmployeeRow["situacao"],
    admissao: e.admissao.toISOString(),
    demissao: e.demissao?.toISOString() ?? null,
    salary: showSalary ? (e.salary ? Number(e.salary.toString()) : 0) : null,
  }));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Efetivo</h1>
          <p className="text-sm text-muted-foreground">Projeto #{params.code}</p>
        </div>
        <Badge variant="outline">{rows.length} colaboradores</Badge>
      </div>

      <Suspense fallback={<div className="text-muted-foreground text-sm py-8 text-center">Carregando...</div>}>
        <EfetivoTable
          employees={rows}
          carteiras={project.carteiras}
          bases={project.bases}
          showSalary={showSalary}
        />
      </Suspense>
    </div>
  );
}
