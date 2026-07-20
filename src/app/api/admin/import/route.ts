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
  const projectId = form.get("projectId") as string | null;

  if (!file || !projectId) {
    return NextResponse.json({ errors: ["Arquivo e projeto são obrigatórios"] }, { status: 400 });
  }

  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ errors: ["Projeto não encontrado"] }, { status: 404 });
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
      const chapa = normalize(col(row, "CHAPA", "MAT", "MATRICULA", "MATRÍCULA"));
      const nome = String(col(row, "NOME", "NOME COMPLETO", "COLABORADOR") ?? "").trim();
      const funcaoName = String(
        col(row, "FUNÇÃO", "FUNCAO", "CARGO", "FUNÇÃO/CARGO", "FUNCAO/CARGO", "OCUPACAO", "OCUPAÇÃO") ?? ""
      ).trim();
      const carteiraName = String(col(row, "CARTEIRA", "GERÊNCIA", "GERENCIA", "SETOR") ?? "").trim();
      const baseName = String(col(row, "BASE", "LOCAL", "LOCALIDADE", "UNIDADE") ?? "").trim();
      const sitRaw = normalize(col(row, "SIT", "SITUAÇÃO", "SITUACAO", "STATUS", "SITUACAO ATUAL") ?? "ATIVO");
      const situacao: Situacao = SIT_MAP[sitRaw] ?? "ATIVO";
      const admissao = parseDate(col(row, "ADMISSÃO", "ADMISSAO", "DT ADMISSÃO", "DT ADMISSAO", "DATA ADMISSAO", "DATA ADMISSÃO"));
      const demissao = parseDate(col(row, "DEMISSÃO", "DEMISSAO", "DT DEMISSÃO", "DT DEMISSAO", "DATA DEMISSAO", "DATA DEMISSÃO"));
      const cpf = String(col(row, "CPF") ?? "").trim() || null;

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
        funcaoId: funcao.id,
        carteiraId: carteiraId ?? null,
        baseId: baseId ?? null,
        admissao,
        demissao: demissao ?? null,
        situacao,
      };

      if (existing) {
        await db.employee.update({ where: { id: existing.id }, data: payload });
        updated++;
      } else {
        await db.employee.create({ data: { chapa, projectId, ...payload } });
        created++;
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
