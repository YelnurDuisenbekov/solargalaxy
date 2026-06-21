import { buildProposalKit } from './proposalCalculator.js';
import { ensureDefaultProposalTemplates } from './defaultProposalTemplates.js';

export async function loadProposalKit(prisma, systemType, capacityKw) {
  const [products, templates] = await Promise.all([
    prisma.product.findMany({ include: { stock: true } }),
    prisma.proposalCostLine.findMany({ where: { enabled: true }, orderBy: [{ systemType: 'asc' }, { sortOrder: 'asc' }] }),
  ]);

  let lines = templates;
  if (lines.length === 0) {
    const bySku = Object.fromEntries(products.map((p) => [p.sku, p]));
    await ensureDefaultProposalTemplates(prisma, bySku);
    lines = await prisma.proposalCostLine.findMany({
      where: { enabled: true },
      orderBy: [{ systemType: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  return buildProposalKit(systemType, capacityKw, products, lines);
}
