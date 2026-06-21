/** Шаблоны удельных расходов КП по умолчанию (по типам систем). */
export const DEFAULT_PROPOSAL_TEMPLATES = [
  // ── Сетевая ──
  { systemType: 'ON_GRID', category: 'PANEL', allocation: 'PER_PANEL', qtyMultiplier: 1, sortOrder: 10 },
  { systemType: 'ON_GRID', category: 'INVERTER', allocation: 'PER_PROJECT', qtyMultiplier: 1, sortOrder: 20 },
  { systemType: 'ON_GRID', category: 'MOUNTING', allocation: 'PER_PANEL', qtyMultiplier: 1, sortOrder: 30 },
  { systemType: 'ON_GRID', category: 'CABLE', allocation: 'PERCENT_EQUIPMENT', qtyMultiplier: 12.5, sortOrder: 40 },
  { systemType: 'ON_GRID', category: 'COMMISSIONING', allocation: 'PERCENT_EQUIPMENT', qtyMultiplier: 20, sortOrder: 50 },

  // ── Автономная ──
  { systemType: 'OFF_GRID', category: 'PANEL', allocation: 'PER_PANEL', qtyMultiplier: 1, sortOrder: 10 },
  { systemType: 'OFF_GRID', category: 'INVERTER', allocation: 'PER_PROJECT', qtyMultiplier: 1, sortOrder: 20 },
  { systemType: 'OFF_GRID', category: 'BATTERY', allocation: 'PER_PROJECT', qtyMultiplier: 1, sortOrder: 30 },
  { systemType: 'OFF_GRID', category: 'MOUNTING', allocation: 'PER_PANEL', qtyMultiplier: 1, sortOrder: 40 },
  { systemType: 'OFF_GRID', category: 'CABLE', allocation: 'PERCENT_EQUIPMENT', qtyMultiplier: 12.5, sortOrder: 50 },
  { systemType: 'OFF_GRID', category: 'COMMISSIONING', allocation: 'PERCENT_EQUIPMENT', qtyMultiplier: 20, sortOrder: 60 },

  // ── Гибридная ──
  { systemType: 'HYBRID', category: 'PANEL', allocation: 'PER_PANEL', qtyMultiplier: 1, sortOrder: 10 },
  { systemType: 'HYBRID', category: 'INVERTER', allocation: 'PER_PROJECT', qtyMultiplier: 1, sortOrder: 20 },
  { systemType: 'HYBRID', category: 'BATTERY', allocation: 'PER_PROJECT', qtyMultiplier: 1, sortOrder: 30 },
  { systemType: 'HYBRID', category: 'MOUNTING', allocation: 'PER_PANEL', qtyMultiplier: 1, sortOrder: 40 },
  { systemType: 'HYBRID', category: 'CABLE', allocation: 'PERCENT_EQUIPMENT', qtyMultiplier: 12.5, sortOrder: 50 },
  { systemType: 'HYBRID', category: 'COMMISSIONING', allocation: 'PERCENT_EQUIPMENT', qtyMultiplier: 20, sortOrder: 60 },
];

/** Обновить существующие шаблоны кабеля/ПНР на процент от оборудования. */
export async function applyPercentEquipmentDefaults(prisma) {
  await prisma.proposalCostLine.updateMany({
    where: { category: 'CABLE' },
    data: { allocation: 'PERCENT_EQUIPMENT', qtyMultiplier: 12.5, unitPriceOverride: null },
  });
  await prisma.proposalCostLine.updateMany({
    where: { category: 'COMMISSIONING' },
    data: { allocation: 'PERCENT_EQUIPMENT', qtyMultiplier: 20, unitPriceOverride: null },
  });
}

export async function ensureDefaultProposalTemplates(prisma, productsBySku = {}) {
  const count = await prisma.proposalCostLine.count();
  if (count > 0) {
    await applyPercentEquipmentDefaults(prisma);
    return;
  }

  const skuByCategory = {
    PANEL: 'LONGI-650',
    INVERTER: null,
    BATTERY: 'PYL-US3K',
    MOUNTING: 'MOUNT-KIT',
    CABLE: 'CABLE-SET',
    COMMISSIONING: 'COMM-STD',
  };

  for (const tpl of DEFAULT_PROPOSAL_TEMPLATES) {
    const sku = skuByCategory[tpl.category];
    const productId = sku && productsBySku[sku] ? productsBySku[sku].id : null;
    await prisma.proposalCostLine.create({
      data: {
        systemType: tpl.systemType,
        category: tpl.category,
        allocation: tpl.allocation,
        productId,
        qtyMultiplier: tpl.qtyMultiplier,
        unitPriceOverride: tpl.unitPriceOverride ?? null,
        label: tpl.label ?? null,
        sortOrder: tpl.sortOrder,
      },
    });
  }
}
