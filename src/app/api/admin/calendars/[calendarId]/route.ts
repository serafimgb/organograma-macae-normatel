import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(req: NextRequest, { params }: { params: { calendarId: string } }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const inUse = await db.project.count({ where: { holidayCalendarId: params.calendarId } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Calendário em uso por ${inUse} projeto(s). Remova a associação antes de excluir.` },
      { status: 409 }
    );
  }

  await db.holidayCalendar.delete({ where: { id: params.calendarId } });
  return NextResponse.json({ ok: true });
}
