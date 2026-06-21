import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.notification.deleteMany();
  await prisma.contractorBid.deleteMany();
  await prisma.dealKitItem.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.projectMaterial.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.project.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.oneCSyncLog.deleteMany();

  console.log('Все данные удалены. Аккаунты пользователей сохранены — можно войти и добавить новые записи.');
  console.log('Логины: admin, director, menedzher1, menedzher2, sklad, logistika, buh, podryadchik, klient');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
