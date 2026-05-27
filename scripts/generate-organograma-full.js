// Gera o organograma completo a partir do banco para todos os projetos.
// Agrupamento primário: carteira (se o projeto tiver ≥2 carteiras distintas)
// Agrupamento fallback: função (quando não há carteiras configuradas)
//
// Execução: node scripts/generate-organograma-full.js
// PRÉ-REQUISITO — colunas devem existir na tabela OrgNode:
//   ALTER TABLE "OrgNode" ADD COLUMN IF NOT EXISTS "displayNome" TEXT;
//   ALTER TABLE "OrgNode" ADD COLUMN IF NOT EXISTS "comment" TEXT;
//   ALTER TABLE "OrgNode" ADD COLUMN IF NOT EXISTS "isGroup" BOOLEAN NOT NULL DEFAULT false;
// Depois: npx prisma generate (com dev server parado)

require("dotenv").config({ path: ".env" });
const { PrismaClient } = require("@prisma/client");
const { randomUUID } = require("crypto");

const db = new PrismaClient();

// Layout (px) — baseado no OrgNodeComponent
const HEADER_H = 56;   // altura do header verde do container
const PAD = 20;        // padding interno
const NODE_W = 220;    // largura do nó de colaborador
const NODE_H = 150;    // altura estimada do nó
const H_GAP = 20;      // gap horizontal entre nós
const V_GAP = 20;      // gap vertical entre linhas
const CART_GAP = 80;   // espaço entre containers no canvas

function inferLevel(funcaoName) {
  const n = (funcaoName || "").toLowerCase();
  if (/gerente|diretor/.test(n)) return 1;
  if (/coordenador|preposto|gest[aã]o/.test(n)) return 2;
  if (/supervisor|encarregado|l[ií]der/.test(n)) return 3;
  if (/t[eé]cnico|engenheiro|eletricista|analista|agr[oô]nomo/.test(n)) return 4;
  return 5;
}

function buildGroupRows(emps) {
  // Grade quadrada, nível hierárquico mais alto primeiro
  const sorted = [...emps].sort((a, b) => inferLevel(a.funcaoName) - inferLevel(b.funcaoName));
  const COLS = Math.max(2, Math.ceil(Math.sqrt(sorted.length)));
  return { sorted, COLS, ROWS: Math.ceil(sorted.length / COLS) };
}

function buildDbRows(projectId, groups) {
  const rows = [];
  let curX = 0;

  for (const { label, emps } of groups) {
    const { sorted, COLS, ROWS } = buildGroupRows(emps);

    const containerW = PAD * 2 + COLS * NODE_W + (COLS - 1) * H_GAP;
    const containerH = HEADER_H + PAD * 2 + ROWS * NODE_H + (ROWS - 1) * V_GAP;

    const headerId = randomUUID();
    rows.push({
      id: headerId,
      projectId,
      isGroup: true,
      label,
      displayNome: `${emps.length} colaboradores`,
      employeeId: null,
      parentId: null,
      positionX: curX,
      positionY: 0,
    });

    for (let i = 0; i < sorted.length; i++) {
      const emp = sorted[i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      rows.push({
        id: randomUUID(),
        projectId,
        isGroup: false,
        label: emp.funcaoName,
        displayNome: null,
        employeeId: emp.id,
        parentId: headerId,
        positionX: PAD + col * (NODE_W + H_GAP),
        positionY: HEADER_H + PAD + row * (NODE_H + V_GAP),
      });
    }

    curX += containerW + CART_GAP;
  }

  return rows;
}

async function generateProject(code) {
  console.log(`\n── Projeto ${code} ──`);

  const project = await db.project.findUnique({ where: { code } });
  if (!project) { console.log(`  Não encontrado`); return; }

  const employees = await db.employee.findMany({
    where: { projectId: project.id, situacao: { not: "DESLIGADO" } },
    include: { funcao: true, carteira: true },
    orderBy: { nome: "asc" },
  });
  console.log(`  ${employees.length} colaboradores ativos`);

  if (employees.length === 0) {
    console.log(`  Nenhum colaborador — pulando`);
    return;
  }

  // Decide agrupamento: carteira (se ≥2 distintas) ou função
  const distinctCarteiras = new Set(
    employees.map((e) => e.carteira?.name).filter(Boolean)
  );

  let groups;
  if (distinctCarteiras.size >= 2) {
    console.log(`  Agrupando por carteira (${distinctCarteiras.size} carteiras)`);
    const carteiraMap = new Map();
    for (const emp of employees) {
      const key = emp.carteira?.name ?? "Sem Carteira";
      if (!carteiraMap.has(key)) carteiraMap.set(key, []);
      carteiraMap.get(key).push({ id: emp.id, funcaoName: emp.funcao.name });
    }
    groups = [...carteiraMap.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([label, emps]) => ({ label, emps }));
  } else {
    console.log(`  Agrupando por função (sem carteiras configuradas)`);
    const funcaoMap = new Map();
    for (const emp of employees) {
      const key = emp.funcao.name;
      if (!funcaoMap.has(key)) funcaoMap.set(key, []);
      funcaoMap.get(key).push({ id: emp.id, funcaoName: emp.funcao.name });
    }
    groups = [...funcaoMap.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([label, emps]) => ({ label, emps }));
  }

  // Apaga dados anteriores
  const deleted = await db.orgNode.deleteMany({ where: { projectId: project.id } });
  console.log(`  Removidos ${deleted.count} nós anteriores`);

  // Monta lista de linhas a inserir
  const dbRows = buildDbRows(project.id, groups);

  // Insere todos com parentId=null primeiro (evita FK violation)
  for (const row of dbRows) {
    await db.orgNode.create({
      data: {
        id: row.id,
        projectId: row.projectId,
        isGroup: row.isGroup,
        label: row.label,
        displayNome: row.displayNome,
        employeeId: row.employeeId,
        parentId: null,
        positionX: row.positionX,
        positionY: row.positionY,
      },
    });
  }

  // Segunda passagem: define parentIds
  for (const row of dbRows) {
    if (row.parentId) {
      await db.orgNode.update({
        where: { id: row.id },
        data: { parentId: row.parentId },
      });
    }
  }

  const groupCount = dbRows.filter((r) => r.isGroup).length;
  const nodeCount = dbRows.filter((r) => !r.isGroup).length;
  console.log(`  ✓ ${groupCount} containers + ${nodeCount} nós`);
}

async function main() {
  const projects = ["743", "741", "736", "737"];
  let ok = 0, fail = 0;

  for (const code of projects) {
    try {
      await generateProject(code);
      ok++;
    } catch (err) {
      fail++;
      console.error(`  ✗ Erro no projeto ${code}:`, err.message);
      // Continua para o próximo projeto mesmo com erro
    }
  }

  console.log(`\n✓ Concluído: ${ok} projetos gerados, ${fail} com erro`);
}

main().catch(console.error).finally(() => db.$disconnect());
