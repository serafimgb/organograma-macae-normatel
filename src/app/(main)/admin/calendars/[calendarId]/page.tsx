import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HolidayManager } from "@/components/admin/holiday-manager";
import { ArrowLeft } from "lucide-react";

export default async function CalendarDetailPage({ params }: { params: { calendarId: string } }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/projects");

  const calendar = await db.holidayCalendar.findUnique({
    where: { id: params.calendarId },
    include: {
      holidays: { orderBy: { date: "asc" } },
      projects: { select: { id: true, code: true, name: true } },
    },
  });
  if (!calendar) notFound();

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <Link href="/admin/calendars" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Calendários
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-1">{calendar.name}</h1>
        <p className="text-sm text-muted-foreground">
          {calendar.projects.length === 0
            ? "Nenhum projeto usando este calendário ainda."
            : `Usado por: ${calendar.projects.map((p) => `#${p.code}`).join(", ")}`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feriados</CardTitle>
        </CardHeader>
        <CardContent>
          <HolidayManager
            calendarId={calendar.id}
            holidays={calendar.holidays.map((h) => ({
              id: h.id,
              date: h.date.toISOString().slice(0, 10),
              name: h.name,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
