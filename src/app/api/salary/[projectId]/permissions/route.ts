import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSalaryManagerInProject } from "@/lib/permissions";
import { db } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const isManager = await isSalaryManagerInProject(session.user.id, params.projectId);
  if (!isManager) {
    return NextResponse.json({ error: "Apenas o gestor de salários pode alterar este acesso" }, { status: 403 });
  }

  const { userId, canViewSalary } = await req.json();
  if (!userId || typeof canViewSalary !== "boolean") {
    return NextResponse.json({ error: "userId e canViewSalary são obrigatórios" }, { status: 400 });
  }

  const existing = await db.permission.findFirst({
    where: { userId, projectId: params.projectId, scope: "ALL", scopeRefId: null },
  });

  const perm = existing
    ? await db.permission.update({ where: { id: existing.id }, data: { canViewSalary } })
    : await db.permission.create({ data: { userId, projectId: params.projectId, scope: "ALL", scopeRefId: null, canViewSalary } });

  return NextResponse.json(perm);
}
