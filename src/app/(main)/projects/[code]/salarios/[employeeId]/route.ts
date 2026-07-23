import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSalaryManagerInProject } from "@/lib/permissions";

export async function PUT(
  req: NextRequest,
  { params }: { params: { code: string; employeeId: string } }
) {
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

  const employee = await db.employee.findUnique({ where: { id: params.employeeId } });
  if (!employee || employee.projectId !== project.id) {
    return NextResponse.json({ error: "Colaborador não encontrado neste projeto" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { salary, adicionalPercentual, planoSaude, planoOdontologico, seguroVida } = body;

    if (salary !== undefined || adicionalPercentual !== undefined) {
      await db.employee.update({
        where: { id: employee.id },
        data: {
          ...(salary !== undefined && { salary: salary === null ? null : Number(salary) }),
          ...(adicionalPercentual !== undefined && {
            adicionalPercentual: adicionalPercentual === null ? null : Number(adicionalPercentual),
          }),
        },
      });
      await db.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE_SALARY",
          entityType: "Employee",
          entityId: employee.id,
          changes: { salary, adicionalPercentual },
        },
      });
    }

    if (planoSaude !== undefined || planoOdontologico !== undefined || seguroVida !== undefined) {
      const benefitData = {
        ...(planoSaude !== undefined && { planoSaude: Number(planoSaude) }),
        ...(planoOdontologico !== undefined && { planoOdontologico: Number(planoOdontologico) }),
        ...(seguroVida !== undefined && { seguroVida: Number(seguroVida) }),
      };
      await db.salaryBenefit.upsert({
        where: { employeeId: employee.id },
        update: benefitData,
        create: { employeeId: employee.id, ...benefitData },
      });
      await db.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE_SALARY",
          entityType: "SalaryBenefit",
          entityId: employee.id,
          changes: benefitData,
        },
      });
    }

    return NextResponse.json({ success: true, message: "Salário e benefícios atualizados com sucesso" });
  } catch (err) {
    console.error("Erro ao atualizar salário:", err);
    return NextResponse.json({ error: "Falha ao processar atualização de salário" }, { status: 500 });
  }
}
