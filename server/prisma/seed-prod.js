import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedProductCatalog } from './seedCatalog.js';
import { syncLeadProposal } from '../src/lib/leadProposal.js';

const prisma = new PrismaClient();

async function createUser({ login, password, fullName, role, phone, extraPerms = [] }) {
  return prisma.user.create({
    data: {
      login,
      email: `${login}@solargalaxy.kz`,
      passwordHash: await bcrypt.hash(password, 10),
      fullName,
      phone,
      role,
      permissions: extraPerms.length
        ? { create: extraPerms.map((key) => ({ key })) }
        : undefined,
    },
  });
}

async function main() {
  if ((await prisma.user.count()) === 0) {
    await createUser({
      login: 'admin',
      password: 'admin123',
      fullName: 'Администратор системы',
      role: 'ADMIN',
      phone: '+7 700 000 0001',
      extraPerms: ['users.delete', 'users.permissions'],
    });
    await createUser({
      login: 'director',
      password: 'director123',
      fullName: 'Директор',
      role: 'DIRECTOR',
      phone: '+7 700 000 0002',
    });
    await createUser({
      login: 'menedzher1',
      password: 'menedzher123',
      fullName: 'Айгуль Сатпаева',
      role: 'MANAGER',
      phone: '+7 700 000 0010',
    });
    console.log('seed-prod: admin, director, menedzher1');
  }

  if ((await prisma.product.count()) === 0) {
    await seedProductCatalog(prisma);
    console.log('seed-prod: каталог товаров и шаблоны КП');
  } else {
    console.log('seed-prod: каталог уже есть');
  }

  await backfillLeadProposals(prisma);

  console.log('seed-prod OK');
}

async function backfillLeadProposals(prisma) {
  if ((await prisma.product.count()) === 0) return;

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
  if (updated > 0) {
    console.log(`seed-prod: пересчитано КП для ${updated} заявок`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
