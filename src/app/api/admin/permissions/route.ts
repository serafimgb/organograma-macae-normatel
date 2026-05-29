import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { userId, projectId, canViewDashboard, canViewOrganograma, canViewEfetivo, canEdit, isSalaryManager, canEditComments, remove } = await req.json();

  if (!userId || !projectId) {
    return NextResponse.json({ error: "userId e projectId são obrigatórios" }, { status: 400 });
  }

  if (remove) {
    await db.permission.deleteMany({ where: { userId, projectId } });
    return NextResponse.json({ ok: true });
  }

  // upsert com scopeRefId=null não funciona no Postgres (NULL!=NULL em unique),
  // então usamos findFirst + update/create manualmente
  const existing = await db.permission.findFirst({
    where: { userId, projectId, scope: "ALL", scopeRefId: null },
  });

  const data = {
    canViewDashboard: canViewDashboard ?? true,
    canViewOrganograma: canViewOrganograma ?? true,
    canViewEfetivo: canViewEfetivo ?? true,
    canEdit: canEdit ?? false,
    isSalaryManager: isSalaryManager ?? false,
    canEditComments: canEditComments ?? false,
  };

  const perm = existing
    ? await db.permission.update({ where: { id: existing.id }, data })
    : await db.permission.create({ data: { userId, projectId, scope: "ALL", scopeRefId: null, ...data } });

  return NextResponse.json(perm);
}
