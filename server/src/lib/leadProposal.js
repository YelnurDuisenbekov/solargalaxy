import { loadProposalKit } from './loadProposalKit.js';
import { kitAmount, lineTotal } from './proposalCalculator.js';

export function kitToProposalRows(items) {
  return items.map((item, i) => ({
    productId: item.productId ?? null,
    category: item.category,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discountPct: item.discountPct ?? 0,
    sortOrder: (i + 1) * 10,
  }));
}

export async function saveLeadProposalItems(tx, leadId, rows) {
  await tx.leadProposalItem.deleteMany({ where: { leadId } });
  if (!rows.length) {
    await tx.lead.update({ where: { id: leadId }, data: { proposalAmount: 0 } });
    return [];
  }
  await tx.leadProposalItem.createMany({
    data: rows.map((r, i) => ({
      leadId,
      productId: r.productId || null,
      category: r.category,
      name: r.name,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      discountPct: r.discountPct ?? 0,
      sortOrder: r.sortOrder ?? (i + 1) * 10,
    })),
  });
  const amount = rows.reduce((s, r) => s + lineTotal(r), 0);
  await tx.lead.update({ where: { id: leadId }, data: { proposalAmount: amount } });
  return tx.leadProposalItem.findMany({
    where: { leadId },
    include: { product: { include: { stock: true } } },
    orderBy: { sortOrder: 'asc' },
  });
}

/** Автогенерация КП из шаблонов (перезаписывает позиции, сбрасывает флаг ручной правки). */
export async function regenerateLeadProposal(prisma, lead) {
  const systemType = lead.systemType || 'ON_GRID';
  const capacityKw = lead.capacityKw || 5;
  const kit = await loadProposalKit(prisma, systemType, capacityKw);
  const rows = kitToProposalRows(kit.items);

  return prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: lead.id },
      data: { proposalCustomized: false },
    });
    const items = await saveLeadProposalItems(tx, lead.id, rows);
    return { items, amount: kit.amount, meta: kit.meta };
  });
}

/**
 * Синхронизация КП: создаёт, если пусто; пересчитывает при смене мощности/типа,
 * если менеджер ещё не правил вручную.
 */
export async function syncLeadProposal(prisma, lead, { force = false } = {}) {
  if (!lead.capacityKw) return null;

  const existing = await prisma.leadProposalItem.count({ where: { leadId: lead.id } });
  if (!force && existing > 0 && lead.proposalCustomized) return null;
  if (!force && existing > 0) return null;

  return regenerateLeadProposal(prisma, lead);
}

export async function getLeadProposal(prisma, leadId) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      systemType: true,
      capacityKw: true,
      proposalAmount: true,
      proposalCustomized: true,
      proposalItems: {
        include: { product: { include: { stock: true } } },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
  if (!lead) return null;

  if (!lead.proposalItems.length && lead.capacityKw) {
    const full = await prisma.lead.findUnique({ where: { id: leadId } });
    await regenerateLeadProposal(prisma, full);
    return getLeadProposal(prisma, leadId);
  }

  return lead;
}

export function proposalItemsForProject(items) {
  return items.filter((i) => i.productId && i.quantity > 0);
}
