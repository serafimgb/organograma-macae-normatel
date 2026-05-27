import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { role } = await req.json();
  if (!["ADMIN", "MANAGER", "VIEWER"].includes(role)) {
    return NextResponse.json({ error: "Role inválida" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id: params.userId },
    data: { role },
    select: { id: true, email: true, role: true },
  });

  return NextResponse.json(user);
}
