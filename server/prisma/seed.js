import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const employeeHash = await bcrypt.hash('employee123', 10);
  const clientHash = await bcrypt.hash('client123', 10);

  await prisma.user.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.lead.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: 'admin@solargalaxy.kz',
      passwordHash: adminHash,
      fullName: 'Администратор',
      phone: '+7 (700) 000 0001',
      role: 'ADMIN',
    },
  });

  await prisma.user.create({
    data: {
      email: 'employee@solargalaxy.kz',
      passwordHash: employeeHash,
      fullName: 'Айгуль Сатпаева',
      phone: '+7 (700) 000 0002',
      role: 'EMPLOYEE',
    },
  });

  const client = await prisma.user.create({
    data: {
      email: 'client@solargalaxy.kz',
      passwordHash: clientHash,
      fullName: 'ТОО «Green Energy»',
      phone: '+7 (700) 000 0003',
      role: 'CLIENT',
      company: 'ТОО «Green Energy»',
    },
  });

  const lead = await prisma.lead.create({
    data: {
      name: 'Ерлан Беков',
      phone: '+7 (777) 123 4567',
      email: 'erlan@example.kz',
      source: 'Сайт',
      notes: 'Интересует сетевая СЭС 10 кВт',
    },
  });

  await prisma.deal.create({
    data: {
      title: 'СЭС для офиса — 10 кВт',
      amount: 4500000,
      status: 'IN_PROGRESS',
      leadId: lead.id,
      clientId: client.id,
    },
  });

  const products = [
    { sku: 'LONGI-550', name: 'Longi Hi-MO 550W', category: 'Панели', price: 42000, qty: 120 },
    { sku: 'DEYE-5K', name: 'Deye SUN-5K-G03', category: 'Инверторы', price: 185000, qty: 15 },
    { sku: 'PYL-US3K', name: 'Pylontech US3000C', category: 'АКБ', price: 380000, qty: 8 },
  ];

  for (const p of products) {
    const product = await prisma.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        category: p.category,
        price: p.price,
        minStock: 5,
      },
    });
    await prisma.stockItem.create({
      data: { productId: product.id, quantity: p.qty, location: 'Шымкент' },
    });
  }

  console.log('Seed OK. Admin id:', admin.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
