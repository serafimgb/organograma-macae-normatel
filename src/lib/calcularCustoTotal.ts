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
  return resolveDiariaInfo(sindicatoConfigs, employeeSindicato).rate;
}

export interface DiariaInfo {
  rate: number;
  /** "exact": tem SindicatoConfig pro sindicato do colaborador. "default": caiu no valor padrão do projeto.
   *  "missing": não tem sindicato cadastrado E não tem valor padrão — o vale sai zerado sem o gestor saber por quê. */
  source: "exact" | "default" | "missing";
}

export function resolveDiariaInfo(
  sindicatoConfigs: { sindicato: string; diariaAlimentacao: Money }[],
  employeeSindicato: string | null | undefined
): DiariaInfo {
  const key = normalizeSindicato(employeeSindicato);
  const exact = sindicatoConfigs.find((c) => normalizeSindicato(c.sindicato) === key);
  if (exact) return { rate: Number(exact.diariaAlimentacao ?? 0), source: "exact" };
  const fallback = sindicatoConfigs.find((c) => normalizeSindicato(c.sindicato) === "");
  if (fallback) return { rate: Number(fallback.diariaAlimentacao ?? 0), source: "default" };
  return { rate: 0, source: "missing" };
}

/**
 * Salário efetivo do colaborador, incluindo o adicional (insalubridade, periculosidade
 * etc, informado em % sobre o salário-base). Esse valor entra na parcela "salário" do
 * custo total — não afeta a diária de alimentação, que é calculada à parte por sindicato.
 */
export function salarioComAdicional(salary: Money, adicionalPercentual: Money): number {
  const base = salary == null ? 0 : Number(salary);
  const pct = adicionalPercentual == null ? 0 : Number(adicionalPercentual);
  return base * (1 + pct / 100);
}

export interface CustoTotalBreakdown {
  salario: number;
  encargos: number;
  vale: number;
  total: number;
}

/**
 * Custo total "carregado" de um colaborador, separado por natureza:
 * - salário: salary + adicional (insalubridade/periculosidade) sobre o salário
 * - encargos: planoSaude + planoOdontologico + seguroVida
 * - vale: diária do sindicato x dias úteis do mês
 */
export function calcularCustoTotalColaborador(input: {
  salary: Money;
  adicionalPercentual?: Money;
  benefit?: { planoSaude: Money; planoOdontologico: Money; seguroVida: Money } | null;
  diariaRate: Money;
  diasUteis?: number;
}): CustoTotalBreakdown {
  const n = (v: Money) => (v == null ? 0 : Number(v));
  const dias = input.diasUteis ?? diasUteisNoMes();

  const salario = salarioComAdicional(input.salary, input.adicionalPercentual);
  const encargos = n(input.benefit?.planoSaude) + n(input.benefit?.planoOdontologico) + n(input.benefit?.seguroVida);
  const vale = n(input.diariaRate) * dias;

  return { salario, encargos, vale, total: salario + encargos + vale };
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

  const breakdown = calcularCustoTotalColaborador({
    salary: employee.salary,
    adicionalPercentual: employee.adicionalPercentual,
    benefit: employee.salaryBenefit,
    diariaRate,
    diasUteis: diasUteisNoMes(new Date(), holidayDates),
  });
  return breakdown.total;
}
