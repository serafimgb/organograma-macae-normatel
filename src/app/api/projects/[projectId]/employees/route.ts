import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const canEdit = await requirePermission(
    { userId: session.user.id, role: session.user.role, projectId: params.projectId },
    "edit"
  );
  if (!canEdit) return NextResponse.json({ error: "Sem permissão de edição" }, { status: 403 });

  const body = await req.json();
  const { chapa, nome, funcaoName, carteiraId, baseId, situacao, admissao, demissao, cpf } = body;

  if (!chapa?.trim() || !nome?.trim() || !funcaoName?.trim() || !admissao) {
    return NextResponse.json({ error: "Chapa, nome, função e admissão são obrigatórios" }, { status: 400 });
  }

  const funcao = await db.funcao.upsert({
    where: { name: funcaoName.trim().toUpperCase() },
    create: { name: funcaoName.trim().toUpperCase() },
    update: {},
  });

  const employee = await db.employee.create({
    data: {
      chapa: chapa.trim().toUpperCase(),
      nome: nome.trim(),
      cpf: cpf?.trim() || null,
      funcaoId: funcao.id,
      projectId: params.projectId,
      carteiraId: carteiraId || null,
      baseId: baseId || null,
      situacao: situacao ?? "ATIVO",
      admissao: new Date(admissao),
      demissao: demissao ? new Date(demissao) : null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "CREATE",
      entityType: "Employee",
      entityId: employee.id,
      changes: { chapa: employee.chapa, nome: employee.nome, projectId: params.projectId },
    },
  });

  return NextResponse.json(employee, { status: 201 });
}
