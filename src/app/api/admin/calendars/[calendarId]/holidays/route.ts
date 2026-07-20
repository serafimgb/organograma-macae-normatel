import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: { calendarId: string } }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { date, name } = await req.json();
  const parsed = new Date(date);
  const trimmedName = String(name ?? "").trim();
  if (isNaN(parsed.getTime()) || !trimmedName) {
    return NextResponse.json({ error: "Data e nome são obrigatórios" }, { status: 400 });
  }

  try {
    const holiday = await db.holiday.create({
      data: { calendarId: params.calendarId, date: parsed, name: trimmedName },
    });
    return NextResponse.json({ holiday });
  } catch {
    return NextResponse.json({ error: "Já existe um feriado cadastrado nessa data" }, { status: 409 });
  }
}
