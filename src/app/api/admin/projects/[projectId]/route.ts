import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { organogramUrl } = await req.json();

  await db.project.update({
    where: { id: params.projectId },
    data: { organogramUrl: organogramUrl || null },
  });

  return NextResponse.json({ ok: true });
}
