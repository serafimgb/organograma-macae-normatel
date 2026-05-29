import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission, canViewTab } from "@/lib/permissions";
import { OrgFlowEditor } from "@/components/organograma/org-flow-editor";
import type { Node, Edge } from "@xyflow/react";

interface OrgNodeData extends Record<string, unknown> {
  label: string;
  displayNome: string | null;
  comment: string | null;
  isGroup: boolean;
  employeeNome: string | null;
  employeeChapa: string | null;
  situacao: string | null;
  color: string | null;
}

export default async function OrganoGramaPage({ params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const project = await db.project.findUnique({
    where: { code: params.code },
    select: { id: true, code: true, name: true },
  });
  if (!project) notFound();

  const hasAccess = await requirePermission(
    { userId: session.user.id, role: session.user.role, projectId: project.id },
    "view"
  );
  if (!hasAccess) redirect("/projects");

  const tabOk = await canViewTab(session.user.id, session.user.role, project.id, "organograma");
  if (!tabOk) redirect("/projects");

  const canEdit = await requirePermission(
    { userId: session.user.id, role: session.user.role, projectId: project.id },
    "edit"
  );

  const dbNodes = await db.orgNode.findMany({
    where: { projectId: project.id },
    include: { employee: { select: { nome: true, chapa: true, situacao: true } } },
  });

  // Determine each node's React Flow type from nodeType field (backward compat with isGroup)
  const getNodeType = (n: typeof dbNodes[number]): "orgNode" | "carteiraGroup" | "sectionLabel" => {
    const stored = (n as any).nodeType as string | null | undefined;
    if (stored === "sectionLabel") return "sectionLabel";
    if (stored === "carteiraGroup" || (!stored && n.isGroup)) return "carteiraGroup";
    return "orgNode";
  };

  const groupIds = new Set(dbNodes.filter((n) => getNodeType(n) === "carteiraGroup").map((n) => n.id));

  const NODE_W_EST = 240;
  const NODE_H_EST = 170;
  const HEADER_H = 56;
  const PAD = 20;
  const groupDims = new Map<string, { width: number; height: number }>();
  for (const n of dbNodes) {
    if (n.parentId && groupIds.has(n.parentId)) {
      const prev = groupDims.get(n.parentId) ?? { width: 0, height: 0 };
      groupDims.set(n.parentId, {
        width: Math.max(prev.width, n.positionX + NODE_W_EST + PAD),
        height: Math.max(prev.height, n.positionY + NODE_H_EST + PAD),
      });
    }
  }

  const groupNodes = dbNodes.filter((n) => getNodeType(n) === "carteiraGroup");
  const childNodes = dbNodes.filter((n) => getNodeType(n) !== "carteiraGroup");

  const initialNodes: Node<OrgNodeData>[] = [
    ...groupNodes.map((n) => {
      const dims = groupDims.get(n.id);
      const w = dims ? Math.max(dims.width, 300) : 300;
      const h = dims ? Math.max(dims.height, HEADER_H + PAD * 2 + NODE_H_EST) : 260;
      return {
        id: n.id,
        type: "carteiraGroup" as const,
        position: { x: n.positionX, y: n.positionY },
        style: { width: w, height: h },
        data: {
          label: n.label,
          displayNome: (n as any).displayNome ?? null,
          comment: null,
          isGroup: true,
          employeeNome: null,
          employeeChapa: null,
          situacao: null,
          color: (n as any).color ?? null,
        },
      };
    }),
    ...childNodes.map((n) => {
      const nType = getNodeType(n);
      const parentIsGroup = !!n.parentId && groupIds.has(n.parentId);
      return {
        id: n.id,
        type: nType as "orgNode" | "sectionLabel",
        position: { x: n.positionX, y: n.positionY },
        ...(parentIsGroup ? { parentId: n.parentId! } : {}),
        data: {
          label: n.label,
          displayNome: (n as any).displayNome ?? null,
          comment: (n as any).comment ?? null,
          isGroup: false,
          employeeNome: n.employee?.nome ?? null,
          employeeChapa: n.employee?.chapa ?? null,
          situacao: (n.employee?.situacao as string) ?? null,
          color: (n as any).color ?? null,
        },
      };
    }),
  ];

  const initialEdges: Edge[] = dbNodes
    .filter((n) => n.parentId && !groupIds.has(n.parentId) && !groupIds.has(n.id))
    .map((n) => ({
      id: `e-${n.parentId}-${n.id}`,
      source: n.parentId!,
      target: n.id,
      type: "smoothstep",
    }));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-8 py-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organograma</h1>
          <p className="text-sm text-muted-foreground">Projeto #{params.code}</p>
        </div>
        {canEdit && (
          <span className="rounded-md bg-primary/10 px-3 py-1 text-xs text-primary font-medium">
            Modo Edição ativo
          </span>
        )}
      </div>
      <div className="flex-1">
        <OrgFlowEditor
          projectId={project.id}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
