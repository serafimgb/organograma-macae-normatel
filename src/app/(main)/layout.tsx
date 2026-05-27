import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAccessibleProjectIds } from "@/lib/permissions";
import { Sidebar } from "@/components/layout/sidebar";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const projectIds = await getAccessibleProjectIds(session.user.id, session.user.role);
  const projects = await db.project.findMany({
    where: { id: { in: projectIds } },
    select: { code: true, name: true },
    orderBy: { code: "asc" },
  });

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        projects={projects}
        userRole={session.user.role}
        userName={session.user.name ?? session.user.email}
      />
      <main className="flex-1 overflow-y-auto bg-muted/20">
        {children}
      </main>
    </div>
  );
}
