import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await req.json();
  const trimmed = String(name ?? "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  }

  const calendar = await db.holidayCalendar.create({ data: { name: trimmed } });
  return NextResponse.json({ calendar });
}
