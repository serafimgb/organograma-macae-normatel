import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSalaryManagerInProject } from "@/lib/permissions";

function normalize(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Encontra o valor de uma coluna tentando vários aliases de cabeçalho (sem distinguir maiúsculas/acentos). */
function col(row: Record<string, unknown>, ...aliases: string[]): unknown {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const aliasNorm = normalize(alias);
    const found = keys.find((k) => normalize(k) === aliasNorm);
    if (found !== undefined) return row[found];
  }
  return undefined;
}

function toNumber(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."));
  return isNaN(n) ? null : n;
}

export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ errors: ["Unauthorized"] }, { status: 401 });
  }

  const project = await db.project.findUnique({ where: { code: params.code } });
  if (!project) {
    return NextResponse.json({ errors: ["Projeto não encontrado"] }, { status: 404 });
  }

  const canManage = await isSalaryManagerInProject(session.user.id, project.id);
  if (!canManage) {
    return NextResponse.json(
      { errors: ["Acesso negado. Você não é gestor de salários neste projeto."] },
      { status: 403 }
    );
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const matchBy = form.get("matchBy") === "FUNCAO" ? "FUNCAO" : "CHAPA";

  if (!file) {
    return NextResponse.json({ errors: ["Arquivo é obrigatório"] }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: true, defval: "" });

  let updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;

    try {
      const salary = toNumber(col(row, "SALARIO", "SALÁRIO", "VENCIMENTO", "REMUNERACAO", "REMUNERAÇÃO"));
      const planoSaude = toNumber(col(row, "PLANO SAUDE", "PLANO DE SAUDE", "PLANO SAÚDE"));
      const planoOdontologico = toNumber(col(row, "PLANO ODONTOLOGICO", "ODONTOLOGICO", "PLANO ODONTOLÓGICO"));
      const seguroVida = toNumber(col(row, "SEGURO VIDA", "SEGURO DE VIDA"));

      const benefitData = {
        ...(planoSaude !== null && { planoSaude }),
        ...(planoOdontologico !== null && { planoOdontologico }),
        ...(seguroVida !== null && { seguroVida }),
      };

      let targets: { id: string }[] = [];

      if (matchBy === "CHAPA") {
        const chapa = normalize(col(row, "CHAPA", "MAT", "MATRICULA", "MATRÍCULA"));
        if (!chapa) {
          errors.push(`Linha ${lineNum}: CHAPA obrigatória`);
          continue;
        }
        const employee = await db.employee.findUnique({
          where: { chapa_projectId: { chapa, projectId: project.id } },
        });
        if (!employee) {
          errors.push(`Linha ${lineNum}: colaborador com CHAPA ${chapa} não encontrado neste projeto`);
          continue;
        }
        targets = [employee];
      } else {
        const funcaoName = String(col(row, "FUNÇÃO", "FUNCAO", "CARGO") ?? "").trim();
        if (!funcaoName) {
          errors.push(`Linha ${lineNum}: FUNÇÃO obrigatória`);
          continue;
        }
        targets = await db.employee.findMany({
          where: { projectId: project.id, situacao: "ATIVO", funcao: { name: funcaoName } },
          select: { id: true },
        });
        if (targets.length === 0) {
          errors.push(`Linha ${lineNum}: nenhum colaborador ativo com função "${funcaoName}"`);
          continue;
        }
      }

      for (const employee of targets) {
        if (salary !== null) {
          await db.employee.update({ where: { id: employee.id }, data: { salary } });
        }
        if (Object.keys(benefitData).length > 0) {
          await db.salaryBenefit.upsert({
            where: { employeeId: employee.id },
            update: benefitData,
            create: { employeeId: employee.id, ...benefitData },
          });
        }
        updated++;
      }
    } catch (err) {
      errors.push(`Linha ${lineNum}: ${(err as Error).message}`);
    }
  }

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: "IMPORT_SALARIES",
      entityType: "SalaryBenefit",
      entityId: project.id,
      changes: { matchBy, updated, errorsCount: errors.length },
    },
  });

  return NextResponse.json({ created: 0, updated, errors });
}
