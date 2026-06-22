import prisma from '../src/lib/prisma.js';

const result = await prisma.product.updateMany({
  data: { purchasePrice: 100_000 },
});

console.log(`Updated ${result.count} products → purchasePrice 100 000`);
await prisma.$disconnect();
