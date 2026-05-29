import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";

export async function PUT(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canEdit = await requirePermission(
    { userId: session.user.id, role: session.user.role, projectId: params.projectId },
    "edit"
  );
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { nodes, edges } = await req.json();

  // Build parent map from edges
  const parentMap = new Map<string, string>();
  for (const edge of edges ?? []) {
    parentMap.set(edge.target, edge.source);
  }

  // Delete nodes that no longer exist in the saved layout
  const nodeIds = (nodes ?? []).map((n: any) => n.id as string);
  if (nodeIds.length > 0) {
    await db.orgNode.deleteMany({
      where: { projectId: params.projectId, id: { notIn: nodeIds } },
    });
  }

  // Upsert each node
  for (const node of nodes ?? []) {
    const edgeParent = parentMap.get(node.id) as string | undefined;
    const reactFlowParent = (node as any).parentId as string | undefined;
    const dbParentId = edgeParent ?? reactFlowParent ?? null;

    const nodeType = (node.type as string) ?? "orgNode";
    const color = (node.data?.color as string) ?? null;
    const slots = nodeType === "positionGroup" ? ((node.data?.slots as any) ?? null) : null;

    await db.orgNode.upsert({
      where: { id: node.id },
      create: {
        id: node.id,
        projectId: params.projectId,
        label: node.data?.label ?? "",
        positionX: node.position?.x ?? 0,
        positionY: node.position?.y ?? 0,
        parentId: dbParentId,
        employeeId: (node.data?.employeeId as string) ?? null,
        displayNome: (node.data?.displayNome as string) ?? null,
        comment: (node.data?.comment as string) ?? null,
        isGroup: nodeType === "carteiraGroup",
        nodeType,
        color,
        slots,
      },
      update: {
        label: node.data?.label ?? "",
        positionX: node.position?.x ?? 0,
        positionY: node.position?.y ?? 0,
        parentId: dbParentId,
        displayNome: (node.data?.displayNome as string) ?? null,
        comment: (node.data?.comment as string) ?? null,
        nodeType,
        color,
        slots,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
