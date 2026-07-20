import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectUrlForm } from "@/components/admin/project-url-form";

export default async function AdminProjectsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/projects");

  const [projects, calendars] = await Promise.all([
    db.project.findMany({ orderBy: { code: "asc" } }) as unknown as Array<{
      id: string;
      code: string;
      name: string;
      organogramUrl: string | null;
      holidayCalendarId: string | null;
    }>,
    db.holidayCalendar.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuração de Projetos</h1>
        <p className="text-sm text-muted-foreground">
          Configure o link externo do organograma por projeto. Quando preenchido, o menu lateral abrirá o link externo em vez da visualização interna.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Link do Organograma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {projects.map((project) => (
            <ProjectUrlForm
              key={project.id}
              projectId={project.id}
              code={project.code}
              name={project.name}
              organogramUrl={project.organogramUrl}
              holidayCalendarId={project.holidayCalendarId}
              calendars={calendars}
            />
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum projeto cadastrado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
