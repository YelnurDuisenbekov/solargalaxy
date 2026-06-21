import { PrismaClient } from '@prisma/client';
import { nextProjectNumber } from '../src/lib/projectIdentity.js';
import { normalizePhone } from '../src/lib/phone.js';

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    include: { lead: { select: { phone: true } }, deal: { select: { phone: true } } },
    orderBy: { createdAt: 'asc' },
  });

  for (const p of projects) {
    const updates = {};
    if (!p.projectNumber) updates.projectNumber = await nextProjectNumber(prisma);
    if (!p.clientPhone) {
      const phone = p.lead?.phone || p.deal?.phone;
      if (phone) updates.clientPhone = normalizePhone(phone);
    }
    if (Object.keys(updates).length) {
      await prisma.project.update({ where: { id: p.id }, data: updates });
      console.log('Updated', p.id, updates);
    }
  }
  console.log('Backfill OK');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
