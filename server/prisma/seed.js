import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { syncLeadProposal } from '../src/lib/leadProposal.js';
import { nextProjectNumber } from '../src/lib/projectIdentity.js';
import { normalizePhone } from '../src/lib/phone.js';
import { seedProductCatalog } from './seedCatalog.js';

const prisma = new PrismaClient();

async function createUser({ login, password, fullName, role, phone, company, extraPerms = [] }) {
  return prisma.user.create({
    data: {
      login,
      email: `${login}@solargalaxy.kz`,
      passwordHash: await bcrypt.hash(password, 10),
      fullName,
      phone,
      role,
      company,
      permissions: extraPerms.length
        ? { create: extraPerms.map((key) => ({ key })) }
        : undefined,
    },
  });
}

async function main() {
  await prisma.notification.deleteMany();
  await prisma.projectAttachment.deleteMany();
  await prisma.contractorBid.deleteMany();
  await prisma.dealKitItem.deleteMany();
  await prisma.leadProposalItem.deleteMany();
  await prisma.proposalCostLine.deleteMany();
  await prisma.userPermission.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.projectMaterial.deleteMany();
  await prisma.stockReservation.deleteMany();
  await prisma.materialTransferActItem.deleteMany();
  await prisma.materialTransferAct.deleteMany();
  await prisma.materialWriteOffBatchItem.deleteMany();
  await prisma.materialWriteOffBatch.deleteMany();
  await prisma.stockAdjustmentItem.deleteMany();
  await prisma.stockAdjustmentBatch.deleteMany();
  await prisma.stockReceiptItem.deleteMany();
  await prisma.stockReceipt.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.project.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.user.deleteMany();

  const admin = await createUser({
    login: 'admin',
    password: 'admin123',
    fullName: 'Администратор системы',
    role: 'ADMIN',
    phone: '+7 700 000 0001',
    extraPerms: ['users.delete', 'users.permissions'],
  });

  const director = await createUser({
    login: 'director',
    password: 'director123',
    fullName: 'Директор',
    role: 'DIRECTOR',
    phone: '+7 700 000 0002',
  });

  const manager1 = await createUser({
    login: 'menedzher1',
    password: 'menedzher123',
    fullName: 'Айгуль Сатпаева',
    role: 'MANAGER',
    phone: '+7 700 000 0010',
  });

  const manager2 = await createUser({
    login: 'menedzher2',
    password: 'menedzher123',
    fullName: 'Данияр Касымов',
    role: 'MANAGER',
    phone: '+7 700 000 0011',
  });

  const sklad = await createUser({
    login: 'sklad',
    password: 'sklad123',
    fullName: 'Серик Нурланов',
    role: 'WAREHOUSE',
    phone: '+7 700 000 0020',
  });

  const logistika = await createUser({
    login: 'logistika',
    password: 'logistika123',
    fullName: 'Мадина Оспанова',
    role: 'SUPPLY',
    phone: '+7 700 000 0030',
  });

  const buh = await createUser({
    login: 'buh',
    password: 'buh123',
    fullName: 'Алия Жаксылыкова',
    role: 'ACCOUNTANT',
    phone: '+7 700 000 0040',
  });

  const podryadchik = await createUser({
    login: 'podryadchik',
    password: 'podryadchik123',
    fullName: 'ТОО «SolarMont»',
    role: 'CONTRACTOR',
    phone: '+7 700 000 0050',
    company: 'ТОО «SolarMont»',
  });

  const klient = await createUser({
    login: 'klient',
    password: 'klient123',
    fullName: 'ТОО «Green Energy»',
    role: 'CLIENT',
    phone: '+7 700 000 0060',
    company: 'ТОО «Green Energy»',
  });

  const createdProducts = await seedProductCatalog(prisma);

  const panelSku = 'LR8-66HVD-650M';
  const inverterSku = 'DEYE-10-P1';

  const leads = [
    { fullName: 'Ерлан Беков', phone: '+7 777 123 4567', city: 'Шымкент', objectType: 'OFFICE', systemType: 'ON_GRID', capacityKw: 10, source: 'Сайт', notes: 'Сетевая СЭС 10 кВт', status: 'QUALIFIED', assigneeId: manager1.id },
    { fullName: 'Асель Нурланова', phone: '+7 701 555 8899', city: 'Туркестан', objectType: 'FARM', systemType: 'OFF_GRID', capacityKw: 5, source: 'Сайт', notes: 'Автономная СЭС', status: 'NEW' },
    { fullName: 'Болат Жумабеков', phone: '+7 705 222 3344', city: 'Алматы', objectType: 'HOUSE', systemType: 'HYBRID', capacityKw: 8, source: 'Реклама', notes: 'Google Ads', status: 'NEW' },
    { fullName: 'Гульнара Сейитова', phone: '+7 747 888 9900', city: 'Астана', objectType: 'INDUSTRIAL', systemType: 'ON_GRID', capacityKw: 50, source: 'Соцсети', status: 'CONTACTED' },
  ];

  const createdLeads = [];
  for (const l of leads) createdLeads.push(await prisma.lead.create({ data: l }));

  for (const l of createdLeads) {
    if (l.capacityKw) await syncLeadProposal(prisma, l, { force: true });
  }

  const lead = createdLeads[0];
  const deal = await prisma.deal.create({
    data: {
      title: 'СЭС для офиса — 10 кВт',
      fullName: lead.fullName,
      phone: lead.phone,
      city: lead.city,
      objectType: lead.objectType,
      systemType: lead.systemType,
      capacityKw: 10,
      amount: 4850000,
      status: 'IN_PROGRESS',
      address: 'ул. Байтурсынова 85',
      leadId: lead.id,
      clientId: klient.id,
      assigneeId: manager1.id,
    },
  });

  await prisma.dealKitItem.createMany({
    data: [
      { dealId: deal.id, productId: createdProducts[panelSku].id, category: 'PANEL', name: createdProducts[panelSku].name, quantity: 16, unitPrice: createdProducts[panelSku].price, stockAvailable: 120 },
      { dealId: deal.id, productId: createdProducts[inverterSku].id, category: 'INVERTER', name: createdProducts[inverterSku].name, quantity: 1, unitPrice: createdProducts[inverterSku].price, stockAvailable: 8 },
      { dealId: deal.id, productId: createdProducts['MOUNT-KIT'].id, category: 'MOUNTING', name: 'Опорная конструкция', quantity: 19, unitPrice: 18000, stockAvailable: 999 },
      { dealId: deal.id, productId: createdProducts['COMM-STD'].id, category: 'COMMISSIONING', name: 'Пусконаладка', quantity: 1, unitPrice: 150000, stockAvailable: 999 },
      { dealId: deal.id, productId: createdProducts['CABLE-SET'].id, category: 'CABLE', name: 'Кабельный комплект MC4', quantity: 2, unitPrice: 45000, stockAvailable: 30 },
    ],
  });

  const project = await prisma.project.create({
    data: {
      projectNumber: await nextProjectNumber(prisma),
      title: 'Монтаж СЭС 10 кВт — Green Energy',
      phase: 'DESIGN',
      capacityKw: 10,
      city: 'Шымкент',
      address: 'ул. Байтурсынова 85',
      dealId: deal.id,
      clientId: klient.id,
      clientPhone: normalizePhone(lead.phone),
      assigneeId: manager1.id,
      startDate: new Date(),
    },
  });

  await prisma.project.create({
    data: {
      projectNumber: await nextProjectNumber(prisma),
      title: 'Монтаж СЭС 8 кВт — гибрид (торги)',
      phase: 'DESIGN',
      capacityKw: 8,
      city: 'Алматы',
      clientPhone: normalizePhone(createdLeads[2].phone),
      auctionOpen: true,
      auctionLaunched: true,
      auctionDeadline: new Date(Date.now() + 7 * 86400000),
      assigneeId: manager2.id,
      notes: 'Монтаж на крыше частного дома',
      startDate: new Date(),
    },
  });

  await prisma.projectMaterial.createMany({
    data: [
      { projectId: project.id, productId: createdProducts[panelSku].id, quantityPlanned: 16, quantityIssued: 0 },
      { projectId: project.id, productId: createdProducts[inverterSku].id, quantityPlanned: 1, quantityIssued: 0 },
    ],
  });

  await prisma.invoice.create({
    data: {
      number: 'SG-2025-001',
      amount: 2425000,
      status: 'SENT',
      dueDate: new Date(Date.now() + 14 * 86400000),
      projectId: project.id,
      clientId: klient.id,
      notes: 'Аванс 50%',
    },
  });

  await prisma.notification.create({
    data: {
      userId: logistika.id,
      type: 'PURCHASE_REQUIRED',
      title: 'Докупка: LONGI Hi-Mo X10 645W',
      message: 'Проверьте остатки панелей для проекта 50 кВт.',
      projectId: project.id,
      productId: createdProducts[panelSku].id,
    },
  });

  console.log('Seed OK');
  console.log('admin / admin123 — полный доступ');
  console.log('director / director123 — директор');
  console.log('menedzher1 / menedzher123 — менеджер 1');
  console.log('menedzher2 / menedzher123 — менеджер 2');
  console.log('sklad / sklad123 — завсклад');
  console.log('logistika / logistika123 — снабжение');
  console.log('buh / buh123 — бухгалтерия');
  console.log('podryadchik / podryadchik123 — подрядчик');
  console.log('klient / klient123 — клиент');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
