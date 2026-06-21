import prisma from './prisma.js';

export async function notifySupplyUsers({ type, title, message, projectId, productId }) {
  const supplyUsers = await prisma.user.findMany({
    where: { role: { in: ['SUPPLY', 'ADMIN'] }, isActive: true },
  });
  if (!supplyUsers.length) return;

  await prisma.notification.createMany({
    data: supplyUsers.map((u) => ({
      userId: u.id,
      type,
      title,
      message,
      projectId: projectId ?? null,
      productId: productId ?? null,
    })),
  });
}

export async function checkProjectStock(projectId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      materials: { include: { product: { include: { stock: true } } } },
      deal: { include: { kitItems: { include: { product: { include: { stock: true } } } } } },
    },
  });
  if (!project) return;

  const needs = [];
  if (project.materials.length) {
    for (const m of project.materials) {
      const stock = m.product.stock?.quantity ?? 0;
      const required = m.quantityPlanned - m.quantityIssued;
      if (required > stock) {
        needs.push({ product: m.product, required, stock, shortage: required - stock });
      }
    }
  } else if (project.deal?.kitItems?.length) {
    for (const k of project.deal.kitItems) {
      if (!k.product) continue;
      const stock = k.product.stock?.quantity ?? 0;
      if (k.quantity > stock) {
        needs.push({ product: k.product, required: k.quantity, stock, shortage: k.quantity - stock });
      }
    }
  }

  for (const n of needs) {
    await notifySupplyUsers({
      type: 'PURCHASE_REQUIRED',
      title: `Докупка: ${n.product.name}`,
      message: `Проект «${project.title}»: нужно ${n.required} шт., на складе ${n.stock} шт. Не хватает ${n.shortage} шт.`,
      projectId,
      productId: n.product.id,
    });
  }

  return needs;
}
