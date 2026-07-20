import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSalaryManagerInProject } from "@/lib/permissions";

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await db.project.findUnique({ where: { code: params.code } });
  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  const canManage = await isSalaryManagerInProject(session.user.id, project.id);
  if (!canManage) {
    return NextResponse.json(
      { error: "Acesso negado. Você não é gestor de salários neste projeto." },
      { status: 403 }
    );
  }

  const { diariaAlimentacao } = await req.json();
  if (diariaAlimentacao === undefined || diariaAlimentacao === null || isNaN(Number(diariaAlimentacao))) {
    return NextResponse.json({ error: "diariaAlimentacao inválida" }, { status: 400 });
  }

  await db.sindicatoConfig.upsert({
    where: { projectId: project.id },
    update: { diariaAlimentacao: Number(diariaAlimentacao) },
    create: { projectId: project.id, diariaAlimentacao: Number(diariaAlimentacao) },
  });

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "UPDATE_SINDICATO_CONFIG",
      entityType: "SindicatoConfig",
      entityId: project.id,
      changes: { diariaAlimentacao },
    },
  });

  return NextResponse.json({ success: true });
}
