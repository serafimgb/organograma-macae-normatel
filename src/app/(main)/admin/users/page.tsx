import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSalaryManagerInProject } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserEditDialog } from "@/components/admin/user-edit-dialog";
import { SalaryAccessManager } from "@/components/admin/salary-access-manager";

type Role = "ADMIN" | "MANAGER" | "VIEWER";
type DisplayRole = "Admin" | "Gestor" | "Visualizador";

const roleBadge: Record<Role, { label: string; variant: "default" | "secondary" | "outline" }> = {
  ADMIN: { label: "Admin", variant: "default" },
  MANAGER: { label: "Gestor", variant: "secondary" },
  VIEWER: { label: "Visualizador", variant: "outline" },
};

const roleToDisplay: Record<Role, DisplayRole> = {
  ADMIN: "Admin",
  MANAGER: "Gestor",
  VIEWER: "Visualizador",
};

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/projects");

  const [users, projects] = await Promise.all([
    db.user.findMany({
      include: {
        permissions: {
          where: { scope: "ALL" },
          include: { project: { select: { id: true, code: true, name: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.project.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  type ManagedProject = { id: string; code: string; name: string; users: { id: string; name: string | null; email: string; canViewSalary: boolean }[] };

  // Verifica se o usuário atual é gestor de salários em algum projeto
  const managedProjects = await Promise.all(
    projects.map(async (proj): Promise<ManagedProject | null> => {
      const isManager = await isSalaryManagerInProject(session.user.id, proj.id);
      if (!isManager) return null;

      const projectUsers = await db.user.findMany({
        where: { id: { not: session.user.id }, permissions: { some: { projectId: proj.id } } },
        select: {
          id: true, name: true, email: true,
          permissions: { where: { projectId: proj.id, canViewSalary: true }, select: { id: true } },
        },
      });

      return {
        ...proj,
        users: projectUsers.map((u) => ({
          id: u.id, name: u.name, email: u.email, canViewSalary: u.permissions.length > 0,
        })),
      };
    })
  );
  const salaryProjects = managedProjects.filter((p): p is ManagedProject => p !== null);

  return (
    <div className="p-8 space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuários & Permissões</h1>
        <p className="text-sm text-muted-foreground">{users.length} usuários cadastrados</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Projetos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user: typeof users[number]) => {
                const rb = roleBadge[user.role as Role];
                const projectCodes: string[] = [...new Set(user.permissions.map((p) => p.project.code))];
                const userPerms = user.permissions.map((p: typeof user.permissions[number]) => ({
                  projectId: p.project.id,
                  canViewDashboard: p.canViewDashboard,
                  canViewOrganograma: p.canViewOrganograma,
                  canViewEfetivo: p.canViewEfetivo,
                  canEdit: p.canEdit,
                  isSalaryManager: p.isSalaryManager,
                }));

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={rb.variant}>{rb.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.role === "ADMIN" ? (
                          <Badge variant="default">Todos</Badge>
                        ) : projectCodes.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Nenhum</span>
                        ) : (
                          projectCodes.map((code) => (
                            <Badge key={code} variant="outline" className="font-mono text-xs">
                              #{code}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <UserEditDialog
                        userId={user.id}
                        userName={user.name}
                        userEmail={user.email}
                        userRole={roleToDisplay[user.role as Role]}
                        permissions={userPerms}
                        projects={projects}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {salaryProjects.length > 0 && (
        <SalaryAccessManager managedProjects={salaryProjects} />
      )}
    </div>
  );
}
