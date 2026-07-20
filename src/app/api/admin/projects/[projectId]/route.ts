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

  const body = await req.json();

  const data: { organogramUrl?: string | null; holidayCalendarId?: string | null } = {};
  if ("organogramUrl" in body) data.organogramUrl = body.organogramUrl || null;
  if ("holidayCalendarId" in body) data.holidayCalendarId = body.holidayCalendarId || null;

  await db.project.update({
    where: { id: params.projectId },
    data,
  });

  return NextResponse.json({ ok: true });
}
