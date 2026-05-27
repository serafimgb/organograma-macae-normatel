// Script de importação da estrutura de organograma
// Lê os sheets ORG RESUMIDO e cria OrgNodes no banco
// Executar: node scripts/import-organograma.js

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

// Sheets de organograma por código de projeto
const ORG_SHEETS = {
  "741": "ORG. RESUMIDO-741",
  "743": "ORG-RESUMIDO-743",
  "737": "02 - ORGANOGRAMA RESUMIDO -737 ",
  "736": "05 - ORGANOGRAMA RESUMIDO -736",
};

// Palavras que indicam que a célula é um título de cargo (não nome de pessoa)
const ROLE_KEYWORDS = [
  "gerente", "supervisor", "supervisora", "engenheiro", "engenheira",
  "coordenador", "coordenadora", "assistente", "preposto", "diretor",
  "diretora", "analista", "técnico", "técnica", "encarregado", "encarregada",
  "agronomo", "eletricista", "civil", "administrat",
];

function isRole(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.toLowerCase().trim();
  if (t.length < 4) return false;
  // Números e seções não são cargos
  if (/^\d+(\.\d+)?$/.test(t)) return false;
  // Seções em maiúsculas com palavras como "EQUIPE", "QUALIDADE", "MANUTENÇÃO" não são nós individuais
  const sectionWords = ["equipe", "qualidade", "saúde", "segurança", "software", "logística",
    "compras", "planejamento", "almoxarifado", "gerência de integração",
    "cabiunas", "barra do furado", "fazenda severina", "ute", "tapera",
    "áreas externas", "manutenção", "civil", "cons.", "áreas verdes", "rh"];
  if (sectionWords.some(w => t === w)) return false;
  return ROLE_KEYWORDS.some(k => t.includes(k));
}

function isName(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.trim();
  if (t.length < 3) return false;
  if (/^\d+(\.\d+)?$/.test(t)) return false;
  // Nomes em maiúsculas com pelo menos 2 palavras e sem keywords de cargo
  const words = t.split(/\s+/);
  if (words.length < 2) return false;
  if (isRole(t)) return false;
  // Não contém caracteres especiais de seção
  if (t.includes("SISTEMA") || t.includes("FORMULÁRIO") || t.includes("ORGANOGRAMA - ")) return false;
  return true;
}

function parseOrgSheet(ws) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const nodes = [];

  // Coleta todas as células não-vazias com posição
  const cells = [];
  data.forEach((row, ri) => {
    row.forEach((val, ci) => {
      const text = String(val || "").trim();
      if (text && text !== "0" && !/^\d+(\.\d+)?$/.test(text)) {
        cells.push({ row: ri, col: ci, text });
      }
    });
  });

  // Identifica pares (cargo na linha R, nome na linha R+1)
  // Padrão: célula com cargo em row R, col C; nome em row R+1, col C-1 (ou C ou C+1)
  const usedRows = new Set();

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!isRole(cell.text)) continue;
    if (usedRows.has(`${cell.row}-${cell.col}`)) continue;

    // Procura nome na próxima linha próximo à mesma coluna (±2 cols)
    const nameCandidates = cells.filter(
      c => c.row === cell.row + 1 && Math.abs(c.col - cell.col) <= 2 && isName(c.text)
    );

    if (nameCandidates.length === 0) {
      // Cargo sem pessoa vinculada (vaga)
      nodes.push({
        role: cell.text,
        name: null,
        row: cell.row,
        col: cell.col,
      });
    } else {
      const nameCell = nameCandidates[0];
      nodes.push({
        role: cell.text,
        name: nameCell.text,
        row: cell.row,
        col: cell.col,
      });
      usedRows.add(`${nameCell.row}-${nameCell.col}`);
    }
    usedRows.add(`${cell.row}-${cell.col}`);
  }

  return nodes;
}

function buildHierarchy(nodes) {
  if (nodes.length === 0) return nodes;

  // Ordena por row (nível hierárquico)
  const sorted = [...nodes].sort((a, b) => a.row - b.row || a.col - b.col);

  // Atribui parentId baseado em proximidade de coluna no nível anterior
  const levels = [];
  let currentLevel = [];
  let currentRow = sorted[0].row;

  for (const node of sorted) {
    if (node.row > currentRow + 3) {
      levels.push([...currentLevel]);
      currentLevel = [node];
      currentRow = node.row;
    } else {
      currentLevel.push(node);
      currentRow = node.row;
    }
  }
  if (currentLevel.length > 0) levels.push(currentLevel);

  // Atribui parentIndex dentro de cada nível
  const result = [];
  for (let li = 0; li < levels.length; li++) {
    for (const node of levels[li]) {
      let parentId = null;
      if (li > 0) {
        const parentLevel = levels[li - 1];
        // Encontra o pai mais próximo pela coluna
        let closest = parentLevel[0];
        let minDist = Math.abs(node.col - closest.col);
        for (const p of parentLevel) {
          const d = Math.abs(node.col - p.col);
          if (d < minDist) { minDist = d; closest = p; }
        }
        parentId = closest._tempId;
      }
      node._tempId = `${node.row}-${node.col}`;
      node._parentTempId = parentId;
      result.push(node);
    }
  }
  return result;
}

function calcPositions(nodes) {
  // Usa posição no Excel (col * fator_x, row * fator_y) para layout inicial
  const COL_FACTOR = 45;
  const ROW_FACTOR = 160;
  return nodes.map(n => ({
    ...n,
    x: n.col * COL_FACTOR,
    y: n.row * ROW_FACTOR,
  }));
}

async function importProject(code, sheetName, wb) {
  console.log(`\nImportando organograma projeto ${code} (sheet: ${sheetName})`);

  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.log(`  Sheet não encontrada`);
    return;
  }

  const project = await db.project.findUnique({ where: { code } });
  if (!project) {
    console.log(`  Projeto ${code} não encontrado no banco`);
    return;
  }

  // Limpa OrgNodes existentes
  await db.orgNode.deleteMany({ where: { projectId: project.id } });

  const rawNodes = parseOrgSheet(ws);
  console.log(`  Nós encontrados: ${rawNodes.length}`);

  if (rawNodes.length === 0) return;

  const hierarchyNodes = buildHierarchy(rawNodes);
  const positionedNodes = calcPositions(hierarchyNodes);

  // Carrega employees do projeto para vincular por nome
  const employees = await db.employee.findMany({
    where: { projectId: project.id },
    include: { funcao: true },
  });

  const empByNome = {};
  for (const e of employees) {
    empByNome[e.nome.trim().toUpperCase()] = e;
  }

  // Cria OrgNodes — primeiro sem parentId, depois atualiza
  const tempIdToDbId = {};

  for (const node of positionedNodes) {
    // Tenta vincular ao employee pelo nome
    let employeeId = null;
    if (node.name) {
      const nomeBusca = node.name.trim().toUpperCase();
      const emp = empByNome[nomeBusca];
      if (emp) employeeId = emp.id;
    }

    const label = node.role;
    const created = await db.orgNode.create({
      data: {
        projectId: project.id,
        employeeId,
        parentId: null,
        positionX: node.x,
        positionY: node.y,
        label,
      },
    });
    tempIdToDbId[node._tempId] = created.id;
    console.log(`  + [${node.role}] ${node.name || "VAGA"}${employeeId ? " ✓" : ""}`);
  }

  // Atualiza parentIds
  for (const node of positionedNodes) {
    if (node._parentTempId && tempIdToDbId[node._parentTempId]) {
      await db.orgNode.update({
        where: { id: tempIdToDbId[node._tempId] },
        data: { parentId: tempIdToDbId[node._parentTempId] },
      });
    }
  }

  console.log(`  Organograma ${code} importado com ${positionedNodes.length} nós`);
}

async function main() {
  console.log("Lendo arquivo Excel...");
  const wb = XLSX.readFile("ORGANOGRAMA MACAE -.xlsx");

  for (const [code, sheetName] of Object.entries(ORG_SHEETS)) {
    await importProject(code, sheetName, wb);
  }

  console.log("\n✓ Importação de organogramas concluída!");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
