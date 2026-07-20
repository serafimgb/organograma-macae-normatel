import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarCreateForm } from "@/components/admin/calendar-create-form";
import { ChevronRight } from "lucide-react";

export default async function CalendarsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/projects");

  const calendars = await db.holidayCalendar.findMany({
    include: { _count: { select: { holidays: true, projects: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendários de Feriados</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre os feriados (nacionais, estaduais, municipais) por calendário. Cada projeto pode usar um
          calendário, e o mesmo calendário pode ser usado por vários projetos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo calendário</CardTitle>
        </CardHeader>
        <CardContent>
          <CalendarCreateForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calendários cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {calendars.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum calendário cadastrado ainda.</p>
          )}
          {calendars.map((cal) => (
            <Link
              key={cal.id}
              href={`/admin/calendars/${cal.id}`}
              className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium">{cal.name}</p>
                <p className="text-xs text-muted-foreground">
                  {cal._count.holidays} feriado(s) · {cal._count.projects} projeto(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{cal._count.holidays}</Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
