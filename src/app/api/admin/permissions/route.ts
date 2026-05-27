import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { userId, projectId, canViewDashboard, canViewOrganograma, canViewEfetivo, canEdit, isSalaryManager, remove } = await req.json();

  if (!userId || !projectId) {
    return NextResponse.json({ error: "userId e projectId são obrigatórios" }, { status: 400 });
  }

  if (remove) {
    await db.permission.deleteMany({ where: { userId, projectId } });
    return NextResponse.json({ ok: true });
  }

  const perm = await db.permission.upsert({
    where: { userId_projectId_scope_scopeRefId: { userId, projectId, scope: "ALL", scopeRefId: null } },
    create: {
      userId,
      projectId,
      scope: "ALL",
      scopeRefId: null,
      canViewDashboard: canViewDashboard ?? true,
      canViewOrganograma: canViewOrganograma ?? true,
      canViewEfetivo: canViewEfetivo ?? true,
      canEdit: canEdit ?? false,
      isSalaryManager: isSalaryManager ?? false,
    },
    update: {
      canViewDashboard: canViewDashboard ?? true,
      canViewOrganograma: canViewOrganograma ?? true,
      canViewEfetivo: canViewEfetivo ?? true,
      canEdit: canEdit ?? false,
      isSalaryManager: isSalaryManager ?? false,
    },
  });

  return NextResponse.json(perm);
}
