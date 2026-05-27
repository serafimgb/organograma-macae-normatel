import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Role = "ADMIN" | "MANAGER" | "VIEWER";

const roleBadge: Record<Role, { label: string; variant: "default" | "secondary" | "outline" }> = {
  ADMIN: { label: "Admin", variant: "default" },
  MANAGER: { label: "Gerente", variant: "secondary" },
  VIEWER: { label: "Visualizador", variant: "outline" },
};

interface Permission {
  canViewSalary: boolean;
  canEdit: boolean;
  project: { code: string; name: string };
}

interface User {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  permissions: Permission[];
}

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/projects");

  const users: User[] = await db.user.findMany({
    include: {
      permissions: {
        include: { project: { select: { code: true, name: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="p-8 space-y-6">
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
                <TableHead>Projetos com acesso</TableHead>
                <TableHead>Pode ver salário</TableHead>
                <TableHead>Pode editar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const rb = roleBadge[user.role];
                const projectsWithSalary = user.permissions.filter((p) => p.canViewSalary);
                const projectsWithEdit = user.permissions.filter((p) => p.canEdit);
                const uniqueProjectCodes = Array.from(new Set(user.permissions.map((p) => p.project.code)));
                const salaryProjectCodes = Array.from(new Set(projectsWithSalary.map((p) => p.project.code)));
                const editProjectCodes = Array.from(new Set(projectsWithEdit.map((p) => p.project.code)));

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
                        ) : uniqueProjectCodes.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Nenhum</span>
                        ) : (
                          uniqueProjectCodes.map((code) => (
                            <Badge key={code} variant="outline" className="font-mono text-xs">
                              #{code}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.role === "ADMIN" ? (
                        <Badge variant="success">Todos</Badge>
                      ) : salaryProjectCodes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {salaryProjectCodes.map((code) => (
                            <Badge key={code} variant="success" className="text-xs font-mono">
                              #{code}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.role === "ADMIN" ? (
                        <Badge variant="success">Todos</Badge>
                      ) : editProjectCodes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {editProjectCodes.map((code) => (
                            <Badge key={code} variant="secondary" className="text-xs font-mono">
                              #{code}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
