import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSalaryManagerInProject } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserEditDialog } from "@/components/admin/user-edit-dialog";
import { SalaryAccessManager } from "@/components/admin/salary-access-manager";
import { UserApprovalDialog } from "@/components/admin/user-approval-dialog";
import { RejectUserButton } from "@/components/admin/reject-user-button";
import { Clock } from "lucide-react";

type Role = "ADMIN" | "MANAGER" | "VIEWER";
type UserStatus = "PENDING" | "APPROVED" | "REJECTED";
type DisplayRole = "Admin" | "Gestor" | "Visualizador";

interface PermWithProject {
  id: string;
  projectId: string;
  canViewDashboard: boolean;
  canViewOrganograma: boolean;
  canViewEfetivo: boolean;
  canEdit: boolean;
  isSalaryManager: boolean;
  canEditComments: boolean;
  project: { id: string; code: string; name: string };
}

interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
  status: UserStatus;
  permissions: PermWithProject[];
}

type ManagedProject = {
  id: string;
  code: string;
  name: string;
  users: { id: string; name: string | null; email: string; canViewSalary: boolean }[];
};

const roleBadge: Record<Role, { label: string; variant: "default" | "secondary" | "outline" }> = {
  ADMIN: { label: "Admin", variant: "default" },
  MANAGER: { label: "Gestor", variant: "secondary" },
  VIEWER: { label: "Visualizador", variant: "outline" },
};

const statusBadge: Record<UserStatus, { label: string; variant: "success" | "warning" | "destructive" }> = {
  APPROVED: { label: "Ativo", variant: "success" },
  PENDING: { label: "Pendente", variant: "warning" },
  REJECTED: { label: "Rejeitado", variant: "destructive" },
};

const roleToDisplay: Record<Role, DisplayRole> = {
  ADMIN: "Admin",
  MANAGER: "Gestor",
  VIEWER: "Visualizador",
};

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/projects");

  const [rawUsers, projects] = await Promise.all([
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

  // Cast to our explicit interface so IDE and build both work
  const users = rawUsers as unknown as UserRow[];

  const pendingUsers = users.filter((u) => u.status === "PENDING");
  const otherUsers = users.filter((u) => u.status !== "PENDING");

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
          id: u.id, name: u.name, email: u.email ?? "", canViewSalary: u.permissions.length > 0,
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

      {/* Pendentes */}
      {pendingUsers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <Clock className="h-5 w-5" />
              Aguardando aprovação
              <Badge variant="warning" className="ml-1">{pendingUsers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <RejectUserButton
                          userId={user.id}
                          userName={user.name}
                          userEmail={user.email ?? ""}
                        />
                        <UserApprovalDialog
                          userId={user.id}
                          userName={user.name}
                          userEmail={user.email ?? ""}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Usuários aprovados / rejeitados */}
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
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Projetos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {otherUsers.map((user) => {
                const rb = roleBadge[user.role] ?? roleBadge.VIEWER;
                const sb = statusBadge[user.status] ?? statusBadge.APPROVED;
                const projectCodes = [...new Set(user.permissions.map((p) => p.project.code))];
                const userPerms = user.permissions.map((p) => ({
                  projectId: p.project.id,
                  canViewDashboard: p.canViewDashboard,
                  canViewOrganograma: p.canViewOrganograma,
                  canViewEfetivo: p.canViewEfetivo,
                  canEdit: p.canEdit,
                  isSalaryManager: p.isSalaryManager,
                  canEditComments: (p as any).canEditComments ?? false,
                }));

                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </TableCell>
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
                        userEmail={user.email ?? ""}
                        userRole={roleToDisplay[user.role]}
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
