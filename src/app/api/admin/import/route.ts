import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as XLSX from "xlsx";
import { parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

type Situacao = "ATIVO" | "DESLIGADO" | "AFASTADO" | "FERIAS" | "LICENCA";

const SIT_MAP: Record<string, Situacao> = {
  ATIVO: "ATIVO",
  DESLIGADO: "DESLIGADO",
  AFASTADO: "AFASTADO",
  FERIAS: "FERIAS",
  FÉRIAS: "FERIAS",
  LICENCA: "LICENCA",
  LICENÇA: "LICENCA",
  AFAS: "AFASTADO",
  "FÉR": "FERIAS",
  FER: "FERIAS",
  LIC: "LICENCA",
  DES: "DESLIGADO",
  AT: "ATIVO",
  // Códigos de uma letra usados na planilha real (aba EFETIVO): A=ativo, D=desligado,
  // F=férias. Sem esses, "D" e "A" caem no default "ATIVO" e desligados somem da conta.
  A: "ATIVO",
  D: "DESLIGADO",
  F: "FERIAS",
};

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return isValid(raw) ? raw : null;
  const n = Number(raw);
  if (!isNaN(n) && n > 1000) {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(n);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  const str = String(raw).trim();
  for (const fmt of ["dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "yyyy-MM-dd", "dd/MM/yy"]) {
    const d = parse(str, fmt, new Date(), { locale: ptBR });
    if (isValid(d)) return d;
  }
  return null;
}

function normalize(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalizeSexo(raw: unknown): string | null {
  const v = normalize(raw);
  if (!v) return null;
  if (v.startsWith("M")) return "M";
  if (v.startsWith("F")) return "F";
  return v;
}

function toNumber(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."));
  return isNaN(n) ? null : n;
}

/** Parseia a coluna ADICIONAL (insalubridade/periculosidade), aceitando "30%", "30" ou "0,3" — sempre normalizado para um percentual (ex: 30). */
function toPercentual(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const str = String(raw).trim().replace("%", "").replace(",", ".");
  const n = parseFloat(str);
  if (isNaN(n)) return null;
  // Se veio como fração (ex: 0.3 vindo de célula formatada como %), converte pra percentual
  return n > 0 && n < 1 ? n * 100 : n;
}

/** Finds column value by trying multiple header aliases (case-insensitive, accent-insensitive) */
function col(row: Record<string, unknown>, ...aliases: string[]): unknown {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const aliasNorm = normalize(alias);
    const found = keys.find((k) => normalize(k) === aliasNorm);
    if (found !== undefined) return row[found];
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ errors: ["Arquivo é obrigatório"] }, { status: 400 });
  }

  const projects = await db.project.findMany({ select: { id: true, code: true, name: true } });
  const projectByCode = new Map(projects.map((p) => [normalize(p.code), p]));
  const projectByName = new Map(projects.map((p) => [normalize(p.name), p]));

  /** Extrai o sindicato (último trecho após hífen) de um texto "... - NOME-SINDICATO", se houver. */
  function extractSindicato(raw: string): string | null {
    const parts = raw.split("-");
    if (parts.length < 2) return null;
    return parts[parts.length - 1].trim() || null;
  }

  /** A coluna PROJETO costuma vir como "PROJETO 736 - MANUTENCAO ... -SINDMETAL":
   *  extrai o código (736) em vez de comparar a string inteira, e também o
   *  sindicato (último trecho após hífen), usado na diária de alimentação por sindicato. */
  function resolveProject(raw: string): { project: { id: string }; sindicato: string | null } | null {
    const normRaw = normalize(raw);

    const prefixMatch = raw.match(/PROJETO\s+([A-Za-zÀ-ú0-9-]+)\s*-?\s*(.*)/i);
    if (prefixMatch) {
      const hit = projectByCode.get(normalize(prefixMatch[1]));
      if (hit) return { project: hit, sindicato: extractSindicato(prefixMatch[2]) };
    }

    const exactCode = projectByCode.get(normRaw);
    if (exactCode) return { project: exactCode, sindicato: extractSindicato(raw) };

    for (const [code, project] of projectByCode) {
      const token = new RegExp(`(^|[^A-Z0-9])${code}([^A-Z0-9]|$)`);
      if (token.test(normRaw)) return { project, sindicato: extractSindicato(raw) };
    }

    const nameHit = projectByName.get(normRaw);
    return nameHit ? { project: nameHit, sindicato: extractSindicato(raw) } : null;
  }

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: true, defval: "" });

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;

    try {
      const projetoName = String(col(row, "PROJETO", "PROJETO/OBRA", "OBRA") ?? "").trim();
      if (!projetoName) {
        errors.push(`Linha ${lineNum}: PROJETO obrigatório`);
        continue;
      }
      const resolved = resolveProject(projetoName);
      if (!resolved) {
        errors.push(`Linha ${lineNum}: projeto "${projetoName}" não encontrado`);
        continue;
      }
      const projectId = resolved.project.id;
      // Coluna SINDICATO explícita tem prioridade sobre o trecho extraído do texto do PROJETO.
      const sindicatoCol = String(col(row, "SINDICATO") ?? "").trim();
      const sindicato = sindicatoCol || resolved.sindicato;

      const chapa = normalize(col(row, "CHAPA", "MAT", "MATRICULA", "MATRÍCULA"));
      const nome = String(col(row, "NOME", "NOME COMPLETO", "COLABORADOR") ?? "").trim();
      const funcaoName = String(
        col(row, "FUNÇÃO", "FUNCAO", "CARGO", "FUNÇÃO/CARGO", "FUNCAO/CARGO", "OCUPACAO", "OCUPAÇÃO") ?? ""
      ).trim();
      const carteiraName = String(col(row, "CARTEIRA", "GERÊNCIA", "GERENCIA", "SETOR") ?? "").trim();
      const baseName = String(
        col(row, "LOTAÇÃO", "LOTACAO", "BASE", "LOCAL", "LOCALIDADE", "UNIDADE") ?? ""
      ).trim();
      const sitRaw = normalize(col(row, "SIT", "SITUAÇÃO", "SITUACAO", "STATUS", "SITUACAO ATUAL") ?? "ATIVO");
      const situacao: Situacao = SIT_MAP[sitRaw] ?? "ATIVO";
      const admissao = parseDate(col(row, "ADMISSÃO", "ADMISSAO", "DT ADMISSÃO", "DT ADMISSAO", "DATA ADMISSAO", "DATA ADMISSÃO"));
      const demissao = parseDate(col(row, "DEMISSÃO", "DEMISSAO", "DT DEMISSÃO", "DT DEMISSAO", "DATA DEMISSAO", "DATA DEMISSÃO"));
      const nascimento = parseDate(col(row, "NASCIMENTO", "DATA NASCIMENTO", "DT NASCIMENTO", "DATA DE NASCIMENTO"));
      const cpf = String(col(row, "CPF") ?? "").trim() || null;
      const sexo = normalizeSexo(col(row, "SEXO", "GENERO", "GÊNERO"));
      const salary = toNumber(col(row, "SALARIO ATUAL", "SALARIO", "SALÁRIO", "VENCIMENTO", "REMUNERACAO", "REMUNERAÇÃO"));
      const adicionalPercentual = toPercentual(col(row, "ADICIONAL", "ADICIONAL %", "% ADICIONAL", "ADICIONAL INSALUBRIDADE/PERICULOSIDADE"));
      // ENCARGOS: total já somado de plano saúde + odontológico + seguro de vida, quando a
      // planilha não quebra em colunas separadas pra cada benefício.
      const encargosTotal = toNumber(col(row, "ENCARGOS", "ENCARGOS TOTAL", "TOTAL ENCARGOS"));

      if (!chapa || !nome) {
        errors.push(`Linha ${lineNum}: CHAPA e NOME são obrigatórios`);
        continue;
      }
      if (!admissao) {
        errors.push(`Linha ${lineNum}: data de ADMISSÃO inválida`);
        continue;
      }

      const funcao = await db.funcao.upsert({
        where: { name: funcaoName || "SEM FUNÇÃO" },
        create: { name: funcaoName || "SEM FUNÇÃO" },
        update: {},
      });

      let carteiraId: string | undefined;
      if (carteiraName) {
        const carteira = await db.carteira.upsert({
          where: { name_projectId: { name: carteiraName, projectId } },
          create: { name: carteiraName, projectId },
          update: {},
        });
        carteiraId = carteira.id;
      }

      let baseId: string | undefined;
      if (baseName) {
        const base = await db.base.upsert({
          where: { name_projectId: { name: baseName, projectId } },
          create: { name: baseName, projectId },
          update: {},
        });
        baseId = base.id;
      }

      const existing = await db.employee.findUnique({
        where: { chapa_projectId: { chapa, projectId } },
      });

      const payload = {
        nome,
        cpf,
        sexo,
        nascimento,
        funcaoId: funcao.id,
        carteiraId: carteiraId ?? null,
        baseId: baseId ?? null,
        admissao,
        demissao: demissao ?? null,
        situacao,
        ...(salary !== null && { salary }),
        ...(adicionalPercentual !== null && { adicionalPercentual }),
        // Só sobrescreve o sindicato quando a planilha traz um valor novo — evita apagar
        // um sindicato já resolvido antes caso essa linha não tenha o sufixo/coluna dessa vez.
        ...(sindicato !== null && { sindicato }),
      };

      let employeeId: string;
      if (existing) {
        await db.employee.update({ where: { id: existing.id }, data: payload });
        employeeId = existing.id;
        updated++;
      } else {
        const created_ = await db.employee.create({ data: { chapa, projectId, ...payload } });
        employeeId = created_.id;
        created++;
      }

      if (encargosTotal !== null) {
        await db.salaryBenefit.upsert({
          where: { employeeId },
          update: { encargosTotal },
          create: { employeeId, encargosTotal },
        });
      }

      await db.auditLog.create({
        data: {
          userId: session.user.id,
          action: existing ? "UPDATE" : "CREATE",
          entityType: "Employee",
          entityId: chapa,
          changes: { ...payload, projectId },
        },
      });
    } catch (err) {
      errors.push(`Linha ${lineNum}: ${(err as Error).message}`);
    }
  }

  return NextResponse.json({ created, updated, errors });
}
