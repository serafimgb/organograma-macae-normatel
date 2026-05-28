import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const VALID_ROLES = ["ADMIN", "MANAGER", "VIEWER"];
const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const { role, status } = body;

  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Role inválida" }, { status: 400 });
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }
  if (role === undefined && status === undefined) {
    return NextResponse.json({ error: "Nada a atualizar" }, { status: 400 });
  }

  const data: Record<string, string> = {};
  if (role !== undefined) data.role = role;
  if (status !== undefined) data.status = status;

  const user = await db.user.update({
    where: { id: params.userId },
    data,
    select: { id: true, email: true, role: true, status: true },
  });

  return NextResponse.json(user);
}
