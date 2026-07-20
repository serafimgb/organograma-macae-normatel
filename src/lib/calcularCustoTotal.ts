import type { Prisma } from "@prisma/client";
import { eachDayOfInterval, endOfMonth, isWeekend, startOfMonth } from "date-fns";
import { db } from "@/lib/db";

type Money = Prisma.Decimal | number | null | undefined;

function normalizeSindicato(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Conta os dias úteis (segunda a sexta, descontando feriados do calendário informado) do mês de referência. */
export function diasUteisNoMes(ref: Date = new Date(), holidayDates: Date[] = []): number {
  const holidaySet = new Set(holidayDates.map((d) => d.toISOString().slice(0, 10)));
  const dias = eachDayOfInterval({ start: startOfMonth(ref), end: endOfMonth(ref) });
  return dias.filter((d) => !isWeekend(d) && !holidaySet.has(d.toISOString().slice(0, 10))).length;
}

/** Acha a diária do sindicato do colaborador; cai no valor "padrão" (sindicato "") do projeto se não achar. */
export function resolveDiariaRate(
  sindicatoConfigs: { sindicato: string; diariaAlimentacao: Money }[],
  employeeSindicato: string | null | undefined
): number {
  const key = normalizeSindicato(employeeSindicato);
  const exact = sindicatoConfigs.find((c) => normalizeSindicato(c.sindicato) === key);
  if (exact) return Number(exact.diariaAlimentacao ?? 0);
  const fallback = sindicatoConfigs.find((c) => normalizeSindicato(c.sindicato) === "");
  return fallback ? Number(fallback.diariaAlimentacao ?? 0) : 0;
}

/**
 * Custo total "carregado" de um colaborador: salary + planoSaude + planoOdontologico + seguroVida
 * + (diária do sindicato x dias úteis do mês).
 */
export function calcularCustoTotalColaborador(input: {
  salary: Money;
  benefit?: { planoSaude: Money; planoOdontologico: Money; seguroVida: Money } | null;
  diariaRate: Money;
  diasUteis?: number;
}): number {
  const n = (v: Money) => (v == null ? 0 : Number(v));
  const dias = input.diasUteis ?? diasUteisNoMes();
  return (
    n(input.salary) +
    n(input.benefit?.planoSaude) +
    n(input.benefit?.planoOdontologico) +
    n(input.benefit?.seguroVida) +
    n(input.diariaRate) * dias
  );
}

/**
 * Busca no banco e calcula o custo total carregado de um único colaborador.
 */
export async function getEmployeeTotalCost(employeeId: string): Promise<number | null> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    include: {
      salaryBenefit: true,
      project: { include: { sindicatoConfigs: true, holidayCalendar: { include: { holidays: true } } } },
    },
  });
  if (!employee) return null;

  const diariaRate = resolveDiariaRate(employee.project.sindicatoConfigs, employee.sindicato);
  const holidayDates = employee.project.holidayCalendar?.holidays.map((h) => h.date) ?? [];

  return calcularCustoTotalColaborador({
    salary: employee.salary,
    benefit: employee.salaryBenefit,
    diariaRate,
    diasUteis: diasUteisNoMes(new Date(), holidayDates),
  });
}
