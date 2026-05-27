import { db } from "@/lib/db";

type Role = "ADMIN" | "MANAGER" | "VIEWER";
type Action = "view" | "edit" | "viewSalary";
type Tab = "dashboard" | "organograma" | "efetivo";

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

/** LGPD: sem bypass para ADMIN — todos precisam de permissão explícita */
export async function canViewSalaryInProject(
  userId: string,
  _role: Role,
  projectId: string
): Promise<boolean> {
  const perm = await db.permission.findFirst({
    where: { userId, projectId, canViewSalary: true },
  });
  return !!perm;
}

/** Visibilidade de aba por projeto. ADMIN vê tudo. Outros: checa flag na Permission ALL. */
export async function canViewTab(
  userId: string,
  role: Role,
  projectId: string,
  tab: Tab
): Promise<boolean> {
  if (role === "ADMIN") return true;

  const perm = await db.permission.findFirst({
    where: { userId, projectId, scope: "ALL" },
    select: { canViewDashboard: true, canViewOrganograma: true, canViewEfetivo: true },
  });
  if (!perm) return false;

  if (tab === "dashboard") return perm.canViewDashboard;
  if (tab === "organograma") return perm.canViewOrganograma;
  if (tab === "efetivo") return perm.canViewEfetivo;
  return false;
}

/** Verifica se o usuário é gestor de salários nesse projeto */
export async function isSalaryManagerInProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const perm = await db.permission.findFirst({
    where: { userId, projectId, isSalaryManager: true },
  });
  return !!perm;
}
