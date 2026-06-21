import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.activity.deleteMany({
    where: { OR: [{ leadId: { not: null } }, { dealId: { not: null } }, { projectId: { not: null } }] },
  });
  await prisma.contractorBid.deleteMany();
  await prisma.dealKitItem.deleteMany();
  await prisma.invoice.deleteMany({ where: { projectId: { not: null } } });
  await prisma.stockMovement.deleteMany({ where: { projectId: { not: null } } });
  await prisma.notification.deleteMany();
  await prisma.projectMaterial.deleteMany();
  await prisma.project.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.lead.deleteMany();

  console.log('Лиды, сделки и проекты удалены. Склад и пользователи сохранены.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
