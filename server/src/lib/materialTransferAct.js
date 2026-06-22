import prisma from './prisma.js';
import { notifyUser, notifyAdmins } from './notifyDirectors.js';
import { syncProjectReservations } from './stockReservation.js';

export async function nextTransferActNumber(tx = prisma) {
  const year = new Date().getFullYear();
  const prefix = `AP-${year}-`;
  const last = await tx.materialTransferAct.findFirst({
    where: { actNumber: { startsWith: prefix } },
    orderBy: { actNumber: 'desc' },
    select: { actNumber: true },
  });
  const nextNum = last ? Number.parseInt(last.actNumber.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

const actInclude = {
  issuedBy: { select: { id: true, fullName: true } },
  acceptedBy: { select: { id: true, fullName: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
    },
  },
};

export const actListInclude = {
  ...actInclude,
  project: {
    select: {
      id: true,
      title: true,
      projectNumber: true,
      phase: true,
      assigneeId: true,
      assignee: { select: { id: true, fullName: true } },
    },
  },
};

export function canAcceptTransferAct(user, project) {
  if (!user || !project?.assigneeId) return false;
  return project.assigneeId === user.id;
}

export async function listAllTransferActs(tx = prisma) {
  return tx.materialTransferAct.findMany({
    include: actListInclude,
    orderBy: { issuedAt: 'desc' },
    take: 100,
  });
}

export async function getPendingTransferActsForUser(user, tx = prisma) {
  const acts = await tx.materialTransferAct.findMany({
    where: { status: 'PENDING_MANAGER' },
    include: actListInclude,
    orderBy: { issuedAt: 'desc' },
  });
  return acts.filter((act) => canAcceptTransferAct(user, act.project));
}

export async function countPendingTransferActsForUser(user, tx = prisma) {
  const pending = await getPendingTransferActsForUser(user, tx);
  return pending.length;
}

export async function createMaterialTransferAct({
  projectId,
  items,
  note,
  issuer,
}) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      materials: true,
      assignee: { select: { id: true, fullName: true } },
    },
  });
  if (!project) throw new Error('PROJECT_NOT_FOUND');

  const materialByProduct = new Map(project.materials.map((m) => [m.productId, m]));
  const productIds = items.map((i) => i.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new Error('DUPLICATE_PRODUCT');
  }

  const stocks = await prisma.stockItem.findMany({
    where: { productId: { in: productIds } },
    include: { product: true },
  });
  const stockByProduct = new Map(stocks.map((s) => [s.productId, s]));

  for (const item of items) {
    const material = materialByProduct.get(item.productId);
    if (!material) throw new Error('NOT_IN_KIT');
    const remaining = material.quantityPlanned - material.quantityIssued;
    if (item.quantity > remaining) throw new Error('EXCEEDS_PLAN');
    const stock = stockByProduct.get(item.productId);
    if (!stock || stock.quantity < item.quantity) throw new Error('INSUFFICIENT_STOCK');
  }

  const act = await prisma.$transaction(async (tx) => {
    const actNumber = await nextTransferActNumber(tx);
    const created = await tx.materialTransferAct.create({
      data: {
        actNumber,
        projectId,
        issuedById: issuer.id,
        note: note?.trim() || null,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: actInclude,
    });

    for (const item of items) {
      const stock = stockByProduct.get(item.productId);
      const material = materialByProduct.get(item.productId);

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          note: `Акт ${actNumber}: выдача на проект «${project.title}»`,
          projectId,
          authorId: issuer.id,
        },
      });

      await tx.stockItem.update({
        where: { productId: item.productId },
        data: { quantity: stock.quantity - item.quantity },
      });

      await tx.projectMaterial.update({
        where: { id: material.id },
        data: { quantityIssued: material.quantityIssued + item.quantity },
      });
    }

    await syncProjectReservations(projectId, tx);
    return created;
  });

  const recipientId = project.assigneeId;
  if (recipientId) {
    await notifyUser({
      userId: recipientId,
      fromUserId: issuer.id,
      type: 'MATERIAL_TRANSFER',
      title: `Акт ${act.actNumber} — приём материалов`,
      message: `${issuer.fullName || 'Завсклад'} передал материалы по проекту «${project.title}». Примите акт приём-передачи.`,
      projectId,
    });
  } else {
    await notifyAdmins({
      fromUserId: issuer.id,
      type: 'MATERIAL_TRANSFER',
      title: `Акт ${act.actNumber} — нет менеджера`,
      message: `${issuer.fullName || 'Завсклад'} передал материалы по проекту «${project.title}», но менеджер не назначен. Назначьте ответственного.`,
      projectId,
    });
  }

  return act;
}

export async function acceptMaterialTransferAct(actId, user) {
  const act = await prisma.materialTransferAct.findUnique({
    where: { id: actId },
    include: {
      project: { include: { materials: true, assignee: { select: { id: true } } } },
      items: true,
    },
  });
  if (!act) throw new Error('NOT_FOUND');
  if (act.status === 'ACCEPTED') {
    if (!canAcceptTransferAct(user, act.project)) throw new Error('FORBIDDEN');
    return prisma.materialTransferAct.findUnique({
      where: { id: actId },
      include: actInclude,
    });
  }
  if (act.status !== 'PENDING_MANAGER') throw new Error('ALREADY_PROCESSED');
  if (!canAcceptTransferAct(user, act.project)) throw new Error('FORBIDDEN');

  const materialByProduct = new Map(act.project.materials.map((m) => [m.productId, m]));

  const updated = await prisma.$transaction(async (tx) => {
    for (const item of act.items) {
      const material = materialByProduct.get(item.productId);
      if (!material) continue;
      await tx.projectMaterial.update({
        where: { id: material.id },
        data: { quantityAccepted: material.quantityAccepted + item.quantity },
      });
    }

    return tx.materialTransferAct.update({
      where: { id: act.id },
      data: {
        status: 'ACCEPTED',
        acceptedById: user.id,
        acceptedAt: new Date(),
      },
      include: actInclude,
    });
  });

  await notifyUser({
    userId: act.issuedById,
    fromUserId: user.id,
    type: 'MATERIAL_TRANSFER',
    title: `Акт ${act.actNumber} принят`,
    message: `${user.fullName || 'Менеджер'} принял материалы по проекту «${act.project.title}».`,
    projectId: act.projectId,
  });

  return updated;
}

export async function writeOffProjectMaterials(projectId, user, note) {
  const { createWriteOffRequest } = await import('./materialWriteOff.js');
  return createWriteOffRequest(projectId, user, note);
}

export { actInclude };
