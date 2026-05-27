// Script de importação do efetivo do Excel para o banco de dados
// Executar: node scripts/import-efetivo.js

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");

let db = new PrismaClient();

async function withRetry(fn, maxRetries = 6) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err.message || "";
      const isConnErr = msg.includes("Server has closed") || msg.includes("Can't reach") || msg.includes("Connection") || msg.includes("ECONNRESET") || msg.includes("socket");
      if (isConnErr && attempt < maxRetries) {
        const wait = attempt * 3000;
        process.stdout.write(` [retry ${attempt}/${maxRetries} wait ${wait/1000}s]`);
        await new Promise(r => setTimeout(r, wait));
        await db.$disconnect().catch(() => {});
        db = new PrismaClient();
      } else {
        throw err;
      }
    }
  }
}

const SIT_MAP = {
  A: "ATIVO",
  D: "DESLIGADO",
  F: "FERIAS",
  P: "LICENCA",  // INSS
  T: "AFASTADO", // Acidente de Trabalho
  M: "LICENCA",  // Serviço Militar
  E: "AFASTADO", // outros afastamentos
  C: "AFASTADO", // Cedido/outros
};

function excelDateToJS(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" && value > 1000) {
    // Excel serial date: (serial - 25569) * 86400000
    return new Date((value - 25569) * 86400000);
  }
  // Try string parse
  const str = String(value).trim();
  if (!str || str === " ") return null;
  // dd/MM/yyyy or dd-MM-yyyy
  const m1 = str.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (m1) return new Date(`${m1[3]}-${m1[2]}-${m1[1]}`);
  // yyyy-MM-dd
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return new Date(str);
  return null;
}

function extractProjectCode(projetoName) {
  const m = String(projetoName || "").match(/PROJETO\s+(\d+)/i);
  return m ? m[1] : null;
}

async function main() {
  console.log("Lendo arquivo Excel...");
  const wb = XLSX.readFile("ORGANOGRAMA MACAE -.xlsx");
  const ws = wb.Sheets["EFETIVO 11.05.2026"];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

  console.log(`Total de linhas: ${rows.length}`);

  // Carrega todos os projetos
  const projects = await db.project.findMany();
  const projectByCode = {};
  for (const p of projects) projectByCode[p.code] = p;

  // Caches para funcao, carteira, base
  const funcaoCache = {};
  const carteiraCache = {};
  const baseCache = {};

  let created = 0, updated = 0, skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i % 100 === 0) process.stdout.write(`\rProcessando ${i}/${rows.length}...`);
    // Pause every 50 rows to avoid overwhelming Transaction Pooler
    if (i > 0 && i % 50 === 0) await new Promise(r => setTimeout(r, 1000));

    try {
      const chapa = String(row["CHAPA"] || "").trim();
      const nome = String(row["NOME"] || "").trim();
      const funcaoName = String(row["FUNÇÃO"] || row["FUNCAO"] || "").trim().toUpperCase() || "SEM FUNÇÃO";
      const sitCode = String(row["SIT"] || "A").trim().toUpperCase();
      const situacao = SIT_MAP[sitCode] || "ATIVO";
      const projetoRaw = String(row["PROJETO"] || "").trim();
      const baseName = String(row["BASE"] || "").trim().toUpperCase();
      const carteiraName = String(row["CARTEIRA"] || "").trim().toUpperCase();
      const cpfRaw = row["CPF"];
      const cpf = cpfRaw ? String(cpfRaw).replace(/\D/g, "").padStart(11, "0") : null;

      const admissao = excelDateToJS(row["ADMISSÃO"] || row["ADMISSAO"]);
      const demissao = excelDateToJS(row["DEMISSÃO"] || row["DEMISSAO"]);

      if (!chapa || !nome) { skipped++; continue; }
      if (!admissao) {
        errors.push(`Linha ${i + 2}: CHAPA ${chapa} - data de admissão inválida (${row["ADMISSÃO"]})`);
        skipped++;
        continue;
      }

      const code = extractProjectCode(projetoRaw);
      if (!code || !projectByCode[code]) {
        errors.push(`Linha ${i + 2}: projeto não encontrado: "${projetoRaw}"`);
        skipped++;
        continue;
      }
      const project = projectByCode[code];

      // Upsert Funcao
      if (!funcaoCache[funcaoName]) {
        funcaoCache[funcaoName] = await withRetry(() => db.funcao.upsert({
          where: { name: funcaoName },
          create: { name: funcaoName },
          update: {},
        }));
      }
      const funcaoId = funcaoCache[funcaoName].id;

      // Upsert Carteira
      let carteiraId = null;
      if (carteiraName) {
        const ck = `${carteiraName}::${project.id}`;
        if (!carteiraCache[ck]) {
          carteiraCache[ck] = await withRetry(() => db.carteira.upsert({
            where: { name_projectId: { name: carteiraName, projectId: project.id } },
            create: { name: carteiraName, projectId: project.id },
            update: {},
          }));
        }
        carteiraId = carteiraCache[ck].id;
      }

      // Upsert Base
      let baseId = null;
      if (baseName) {
        const bk = `${baseName}::${project.id}`;
        if (!baseCache[bk]) {
          baseCache[bk] = await withRetry(() => db.base.upsert({
            where: { name_projectId: { name: baseName, projectId: project.id } },
            create: { name: baseName, projectId: project.id },
            update: {},
          }));
        }
        baseId = baseCache[bk].id;
      }

      const payload = {
        nome,
        cpf,
        funcaoId,
        carteiraId,
        baseId,
        admissao,
        demissao: demissao || null,
        situacao,
      };

      const existing = await withRetry(() => db.employee.findUnique({
        where: { chapa_projectId: { chapa, projectId: project.id } },
      }));

      if (existing) {
        await withRetry(() => db.employee.update({ where: { id: existing.id }, data: payload }));
        updated++;
      } else {
        await withRetry(() => db.employee.create({ data: { chapa, projectId: project.id, ...payload } }));
        created++;
      }
    } catch (err) {
      errors.push(`Linha ${i + 2}: ${err.message}`);
    }
  }

  console.log(`\n\nResultado:`);
  console.log(`  ✓ Criados: ${created}`);
  console.log(`  ✓ Atualizados: ${updated}`);
  console.log(`  ✗ Ignorados: ${skipped}`);
  if (errors.length > 0) {
    console.log(`\nErros (${errors.length}):`);
    errors.slice(0, 20).forEach(e => console.log("  ", e));
    if (errors.length > 20) console.log(`  ... e mais ${errors.length - 20} erros`);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
