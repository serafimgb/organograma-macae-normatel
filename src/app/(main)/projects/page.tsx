import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAccessibleProjectIds } from "@/lib/permissions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

interface ProjectWithCounts {
  code: string;
  name: string;
  description: string | null;
  _count: { employees: number };
  carteiras: { name: string }[];
}

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const projectIds = await getAccessibleProjectIds(session.user.id, session.user.role);

  const projects: ProjectWithCounts[] = await db.project.findMany({
    where: { id: { in: projectIds } },
    include: {
      _count: {
        select: {
          employees: { where: { situacao: "ATIVO" } },
        },
      },
      carteiras: { select: { name: true } },
    },
    orderBy: { code: "asc" },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Projetos</h1>
        <p className="mt-1 text-muted-foreground">Selecione um projeto para acessar o dashboard</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Link key={project.code} href={`/projects/${project.code}/dashboard`}>
            <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant="outline" className="mb-2 font-mono">
                      #{project.code}
                    </Badge>
                    <CardTitle>{project.name}</CardTitle>
                    {project.description && (
                      <CardDescription className="mt-1">{project.description}</CardDescription>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    <span className="font-semibold text-foreground">{project._count.employees}</span>{" "}
                    colaboradores ativos
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {project.carteiras.slice(0, 4).map((c) => (
                    <Badge key={c.name} variant="secondary" className="text-xs">
                      {c.name}
                    </Badge>
                  ))}
                  {project.carteiras.length > 4 && (
                    <Badge variant="secondary" className="text-xs">
                      +{project.carteiras.length - 4}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {projects.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Nenhum projeto disponível para o seu perfil.
          </div>
        )}
      </div>
    </div>
  );
}
