import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import { ensureDefaultProposalTemplates } from '../src/lib/defaultProposalTemplates.js';
import { getCatalogProducts } from './catalogTemplate.js';

export { CATALOG_TEMPLATE, getCatalogProducts } from './catalogTemplate.js';

/** Каталог товаров + шаблоны КП (нужны для расчёта коммерческих предложений). */
export async function seedProductCatalog(prisma) {
  const createdProducts = {};
  for (const p of getCatalogProducts()) {
    const { qty, powerW, capacityKw, capacityKwh, description, ...rest } = p;
    const product = await prisma.product.create({
      data: { ...rest, powerW, capacityKw, capacityKwh, description },
    });
    await prisma.stockItem.create({
      data: { productId: product.id, quantity: qty, location: 'Шымкент' },
    });
    createdProducts[p.sku] = product;
  }
  await ensureDefaultProposalTemplates(prisma, createdProducts);
  return createdProducts;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const count = await prisma.product.count();
    if (count > 0 && process.env.FORCE !== '1') {
      console.log(`seed-catalog: пропуск — в БД уже ${count} товаров (FORCE=1 для перезаписи)`);
      return;
    }
    if (count > 0) {
      await prisma.proposalCostLine.deleteMany();
      await prisma.stockItem.deleteMany();
      await prisma.product.deleteMany();
    }
    const products = await seedProductCatalog(prisma);
    console.log(`seed-catalog OK — загружено ${Object.keys(products).length} товаров`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
