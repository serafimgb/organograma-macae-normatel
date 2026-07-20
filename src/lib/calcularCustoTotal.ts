import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type Money = Prisma.Decimal | number | null | undefined;

/**
 * Custo total "carregado" de um colaborador: salary + planoSaude + planoOdontologico + seguroVida + diariaAlimentacao.
 */
export function calcularCustoTotalColaborador(input: {
  salary: Money;
  benefit?: { planoSaude: Money; planoOdontologico: Money; seguroVida: Money } | null;
  diariaAlimentacao: Money;
}): number {
  const n = (v: Money) => (v == null ? 0 : Number(v));
  return (
    n(input.salary) +
    n(input.benefit?.planoSaude) +
    n(input.benefit?.planoOdontologico) +
    n(input.benefit?.seguroVida) +
    n(input.diariaAlimentacao)
  );
}

/**
 * Busca no banco e calcula o custo total carregado de um único colaborador.
 */
export async function getEmployeeTotalCost(employeeId: string): Promise<number | null> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: { salaryBenefit: true, project: { include: { sindicatoConfig: true } } },
  });
  if (!employee) return null;

  return calcularCustoTotalColaborador({
    salary: employee.salary,
    benefit: employee.salaryBenefit,
    diariaAlimentacao: employee.project.sindicatoConfig?.diariaAlimentacao,
  });
}
