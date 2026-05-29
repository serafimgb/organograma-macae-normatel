import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAccessibleProjectIds } from "@/lib/permissions";
import { Sidebar } from "@/components/layout/sidebar";

export type TabFlags = {
  dashboard: boolean;
  organograma: boolean;
  efetivo: boolean;
  salarios: boolean;
};
export type TabMap = Record<string, TabFlags>;

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const status = session.user.status;
  if (status === "PENDING") redirect("/pending");
  if (status === "REJECTED") redirect("/rejected");

  const projectIds = await getAccessibleProjectIds(session.user.id, session.user.role);
  const projects = await db.project.findMany({
    where: { id: { in: projectIds } },
    orderBy: { code: "asc" },
  }) as unknown as Array<{ id: string; code: string; name: string; organogramUrl: string | null }>;

  let tabMap: TabMap | null = null;

  if (session.user.role !== "ADMIN") {
    const perms = await db.permission.findMany({
      where: { userId: session.user.id, scope: "ALL" },
      select: {
        projectId: true,
        canViewDashboard: true,
        canViewOrganograma: true,
        canViewEfetivo: true,
        canViewSalary: true,
      },
    });
    tabMap = {};
    for (const p of perms as Array<{ projectId: string; canViewDashboard: boolean; canViewOrganograma: boolean; canViewEfetivo: boolean; canViewSalary: boolean }>) {
      tabMap[p.projectId] = {
        dashboard: p.canViewDashboard,
        organograma: p.canViewOrganograma,
        efetivo: p.canViewEfetivo,
        salarios: p.canViewSalary,
      };
    }
  } else {
    // ADMIN: verifica explicitamente canViewSalary (sem bypass)
    const salaryPerms = await db.permission.findMany({
      where: { userId: session.user.id, scope: "ALL", canViewSalary: true },
      select: { projectId: true },
    });
    const salaryProjectIds = new Set(salaryPerms.map((p) => p.projectId));
    tabMap = {};
    for (const proj of projects) {
      tabMap[proj.id] = {
        dashboard: true,
        organograma: true,
        efetivo: true,
        salarios: salaryProjectIds.has(proj.id),
      };
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        projects={projects}
        userRole={session.user.role}
        userName={session.user.name ?? session.user.email}
        tabMap={tabMap}
      />
      <main className="flex-1 overflow-y-auto bg-muted/20">
        {children}
      </main>
    </div>
  );
}
