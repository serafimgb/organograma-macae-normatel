import { db } from "@/lib/db";

type Role = "ADMIN" | "MANAGER" | "VIEWER";
type Action = "view" | "edit" | "viewSalary";

interface PermissionContext {
  userId: string;
  role: Role;
  projectId: string;
  carteiraId?: string;
  baseId?: string;
}

interface DbPermission {
  scope: string;
  scopeRefId: string | null;
  canEdit: boolean;
  canViewSalary: boolean;
}

/**
 * Verifica se o usuário tem permissão para uma ação num projeto.
 * ADMINs têm acesso total. MANAGERs e VIEWERs dependem da tabela Permission.
 */
export async function requirePermission(ctx: PermissionContext, action: Action): Promise<boolean> {
  if (ctx.role === "ADMIN") return true;

  const permissions: DbPermission[] = await db.permission.findMany({
    where: { userId: ctx.userId, projectId: ctx.projectId },
  });

  if (permissions.length === 0) return false;

  const hasScopeMatch = (p: DbPermission) => {
    if (p.scope === "ALL") return true;
    if (p.scope === "CARTEIRA" && ctx.carteiraId && p.scopeRefId === ctx.carteiraId) return true;
    if (p.scope === "BASE" && ctx.baseId && p.scopeRefId === ctx.baseId) return true;
    return false;
  };

  const relevant = permissions.filter(hasScopeMatch);
  if (relevant.length === 0) return false;

  if (action === "view") return true;
  if (action === "edit") return relevant.some((p) => p.canEdit);
  if (action === "viewSalary") return relevant.some((p) => p.canViewSalary);

  return false;
}

/**
 * Retorna os projectIds que o usuário pode acessar.
 */
export async function getAccessibleProjectIds(userId: string, role: Role): Promise<string[]> {
  if (role === "ADMIN") {
    const projects: { id: string }[] = await db.project.findMany({ select: { id: true } });
    return projects.map((p) => p.id);
  }

  const perms: { projectId: string }[] = await db.permission.findMany({
    where: { userId },
    select: { projectId: true },
    distinct: ["projectId"],
  });
  return perms.map((p) => p.projectId);
}

/**
 * Verifica se o usuário pode ver salários em qualquer escopo do projeto.
 */
export async function canViewSalaryInProject(
  userId: string,
  role: Role,
  projectId: string
): Promise<boolean> {
  if (role === "ADMIN") return true;
  const perm = await db.permission.findFirst({
    where: { userId, projectId, canViewSalary: true },
  });
  return !!perm;
}
