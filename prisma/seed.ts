/* eslint-disable @typescript-eslint/no-require-imports */
// Run with: npm run db:seed
const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminName = process.env.SEED_ADMIN_NAME ?? "Administrador";

  if (!adminEmail) {
    throw new Error("SEED_ADMIN_EMAIL não definido no .env");
  }

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, name: adminName, role: "ADMIN" },
    update: { role: "ADMIN" },
  });
  console.log(`✓ Admin criado/atualizado: ${admin.email}`);

  const projects = [
    { code: "741", name: "Projeto 741", description: "Manutenção industrial" },
    { code: "743", name: "Projeto 743", description: "Operações integradas" },
    { code: "736", name: "Projeto 736", description: "Conservação e limpeza" },
    { code: "737", name: "Projeto 737", description: "Obras civis" },
  ];

  for (const p of projects) {
    await db.project.upsert({
      where: { code: p.code },
      create: p,
      update: { name: p.name, description: p.description },
    });
  }
  console.log(`✓ ${projects.length} projetos criados`);

  const project743 = await db.project.findUnique({ where: { code: "743" } });
  if (project743) {
    const carteiras = [
      "Civil",
      "Áreas Verdes",
      "Conservação e Limpeza",
      "Elétrica",
      "Mecânica",
      "Logística",
      "SMS",
      "Suprimentos",
      "RH",
      "Compras",
      "Engenharia",
    ];

    for (const name of carteiras) {
      await db.carteira.upsert({
        where: { name_projectId: { name, projectId: project743.id } },
        create: { name, projectId: project743.id },
        update: {},
      });
    }
    console.log(`✓ ${carteiras.length} carteiras criadas para projeto 743`);

    const bases = [
      "CABIÚNAS",
      "BARRA DO FURADO",
      "FAZENDA SEVERINA",
      "UTE",
      "AE",
      "TAPERA",
      "VAGA UTE",
    ];

    for (const name of bases) {
      await db.base.upsert({
        where: { name_projectId: { name, projectId: project743.id } },
        create: { name, projectId: project743.id },
        update: {},
      });
    }
    console.log(`✓ ${bases.length} bases criadas para projeto 743`);
  }

  console.log("\nSeed concluído!");
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
