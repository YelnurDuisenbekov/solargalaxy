/**
 * Пересчёт КП для заявок без позиций (например после первого seed каталога на Render).
 * Запуск: node scripts/backfill-lead-proposals.js
 */
import { PrismaClient } from '@prisma/client';
import { syncLeadProposal } from '../src/lib/leadProposal.js';

const prisma = new PrismaClient();

async function main() {
  const productCount = await prisma.product.count();
  if (productCount === 0) {
    console.error('Каталог пуст — сначала: node prisma/seedCatalog.js');
    process.exit(1);
  }

  const leads = await prisma.lead.findMany({
    where: {
      capacityKw: { not: null },
      status: { notIn: ['CONVERTED', 'LOST'] },
    },
    include: { proposalItems: true },
  });

  let updated = 0;
  for (const lead of leads) {
    if (!lead.proposalItems.length || !lead.proposalAmount) {
      await syncLeadProposal(prisma, lead, { force: true });
      updated += 1;
    }
  }

  console.log(`backfill OK: пересчитано ${updated} из ${leads.length} заявок`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
