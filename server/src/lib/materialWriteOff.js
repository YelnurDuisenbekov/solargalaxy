import prisma from './prisma.js';
import { notifyDirectors, notifyUser } from './notifyDirectors.js';
import { canAcceptTransferAct } from './materialTransferAct.js';

const batchInclude = {
  requestedBy: { select: { id: true, fullName: true } },
  directorApprovedBy: { select: { id: true, fullName: true } },
  accountantApprovedBy: { select: { id: true, fullName: true } },
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
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
      projectMaterial: { select: { id: true, quantityAccepted: true, quantityWrittenOff: true } },
    },
  },
};

export { batchInclude };

function isOversightRole(role) {
  return ['ADMIN', 'DIRECTOR'].includes(role);
}

export async function listAcceptedTransferActsForUser(user, tx = prisma) {
  const acts = await tx.materialTransferAct.findMany({
    where: { status: 'ACCEPTED' },
    include: {
      issuedBy: { select: { id: true, fullName: true } },
      acceptedBy: { select: { id: true, fullName: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
        },
      },
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
    },
    orderBy: { acceptedAt: 'desc' },
    take: 100,
  });

  if (isOversightRole(user.role)) return acts;
  return acts.filter(
    (act) => act.project?.assigneeId === user.id || act.acceptedById === user.id,
  );
}

export async function getManagerMaterialBalance(userId, tx = prisma) {
  const materials = await tx.projectMaterial.findMany({
    where: {
      project: { assigneeId: userId },
    },
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
      project: { select: { id: true, title: true, projectNumber: true, phase: true } },
    },
  });

  const rows = materials
    .map((m) => ({
      projectMaterialId: m.id,
      projectId: m.projectId,
      project: m.project,
      productId: m.productId,
      product: m.product,
      quantityAccepted: m.quantityAccepted,
      quantityWrittenOff: m.quantityWrittenOff,
      balance: m.quantityAccepted - m.quantityWrittenOff,
    }))
    .filter((m) => m.balance > 0);

  const byProduct = new Map();
  for (const row of rows) {
    const key = row.productId;
    if (!byProduct.has(key)) {
      byProduct.set(key, {
        productId: row.productId,
        product: row.product,
        quantityAccepted: 0,
        quantityWrittenOff: 0,
        balance: 0,
        projects: [],
      });
    }
    const agg = byProduct.get(key);
    agg.quantityAccepted += row.quantityAccepted;
    agg.quantityWrittenOff += row.quantityWrittenOff;
    agg.balance += row.balance;
    agg.projects.push({
      projectId: row.projectId,
      project: row.project,
      balance: row.balance,
      quantityAccepted: row.quantityAccepted,
      quantityWrittenOff: row.quantityWrittenOff,
    });
  }

  return {
    rows,
    summary: [...byProduct.values()].sort((a, b) => a.product.name.localeCompare(b.product.name, 'ru')),
  };
}

async function notifyAccountants({ type, title, message, projectId, fromUserId }) {
  const accountants = await prisma.user.findMany({
    where: { role: { in: ['ACCOUNTANT', 'ADMIN'] }, isActive: true },
  });
  if (!accountants.length) return;
  await prisma.notification.createMany({
    data: accountants.map((u) => ({
      userId: u.id,
      fromUserId: fromUserId ?? null,
      type,
      title,
      message,
      projectId: projectId ?? null,
    })),
  });
}

export async function createWriteOffRequest(projectId, user, note) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { materials: true, assignee: { select: { id: true } } },
  });
  if (!project) throw new Error('PROJECT_NOT_FOUND');
  if (!['COMPLETED', 'COMMISSIONING'].includes(project.phase)) {
    throw new Error('PROJECT_NOT_FINISHED');
  }
  if (!canAcceptTransferAct(user, project)) throw new Error('FORBIDDEN');

  const pending = await prisma.materialWriteOffBatch.findFirst({
    where: {
      projectId,
      status: { in: ['PENDING_DIRECTOR', 'PENDING_ACCOUNTANT'] },
    },
  });
  if (pending) throw new Error('REQUEST_PENDING');

  const items = project.materials
    .filter((m) => m.quantityAccepted > m.quantityWrittenOff)
    .map((m) => ({
      projectMaterialId: m.id,
      productId: m.productId,
      quantity: m.quantityAccepted - m.quantityWrittenOff,
    }));

  if (!items.length) throw new Error('NOTHING_TO_WRITE_OFF');

  const batch = await prisma.materialWriteOffBatch.create({
    data: {
      projectId,
      requestedById: user.id,
      note: note?.trim() || null,
      items: { create: items },
    },
    include: batchInclude,
  });

  const label = project.projectNumber || project.title;
  await notifyDirectors({
    fromUserId: user.id,
    type: 'MATERIAL_WRITE_OFF',
    title: `Списание материалов: ${label}`,
    message: `${user.fullName || 'Менеджер'} запросил списание материалов по проекту «${label}». Требуется согласование директора.`,
    projectId,
  });

  return batch;
}

export async function approveWriteOffByDirector(batchId, user) {
  if (!['DIRECTOR', 'ADMIN'].includes(user.role)) throw new Error('FORBIDDEN');

  const batch = await prisma.materialWriteOffBatch.findUnique({
    where: { id: batchId },
    include: { project: { select: { title: true, projectNumber: true, assigneeId: true } } },
  });
  if (!batch) throw new Error('NOT_FOUND');
  if (batch.status !== 'PENDING_DIRECTOR') throw new Error('ALREADY_PROCESSED');

  const updated = await prisma.materialWriteOffBatch.update({
    where: { id: batchId },
    data: {
      status: 'PENDING_ACCOUNTANT',
      directorApprovedAt: new Date(),
      directorApprovedById: user.id,
    },
    include: batchInclude,
  });

  const label = batch.project.projectNumber || batch.project.title;
  await notifyAccountants({
    fromUserId: user.id,
    type: 'MATERIAL_WRITE_OFF',
    title: `Списание: согласование бухгалтера — ${label}`,
    message: `Директор согласовал списание материалов по проекту «${label}». Требуется подтверждение бухгалтера.`,
    projectId: batch.projectId,
  });

  if (batch.project.assigneeId) {
    await notifyUser({
      userId: batch.project.assigneeId,
      fromUserId: user.id,
      type: 'MATERIAL_WRITE_OFF',
      title: `Списание: директор согласовал — ${label}`,
      message: `Запрос на списание материалов по проекту «${label}» согласован директором. Ожидается подтверждение бухгалтера.`,
      projectId: batch.projectId,
    });
  }

  return updated;
}

export async function approveWriteOffByAccountant(batchId, user) {
  if (!['ACCOUNTANT', 'ADMIN'].includes(user.role)) throw new Error('FORBIDDEN');

  const batch = await prisma.materialWriteOffBatch.findUnique({
    where: { id: batchId },
    include: {
      items: true,
      project: { select: { title: true, projectNumber: true, assigneeId: true } },
    },
  });
  if (!batch) throw new Error('NOT_FOUND');
  if (batch.status !== 'PENDING_ACCOUNTANT') throw new Error('ALREADY_PROCESSED');

  await prisma.$transaction(async (tx) => {
    for (const item of batch.items) {
      const material = await tx.projectMaterial.findUnique({ where: { id: item.projectMaterialId } });
      if (!material) continue;
      const maxWrite = material.quantityAccepted - material.quantityWrittenOff;
      const qty = Math.min(item.quantity, maxWrite);
      if (qty <= 0) continue;
      await tx.projectMaterial.update({
        where: { id: material.id },
        data: { quantityWrittenOff: material.quantityWrittenOff + qty },
      });
    }

    await tx.materialWriteOffBatch.update({
      where: { id: batchId },
      data: {
        status: 'APPROVED',
        accountantApprovedAt: new Date(),
        accountantApprovedById: user.id,
      },
    });
  });

  const updated = await prisma.materialWriteOffBatch.findUnique({
    where: { id: batchId },
    include: batchInclude,
  });

  const label = batch.project.projectNumber || batch.project.title;
  if (batch.project.assigneeId) {
    await notifyUser({
      userId: batch.project.assigneeId,
      fromUserId: user.id,
      type: 'MATERIAL_WRITE_OFF',
      title: `Материалы списаны: ${label}`,
      message: `Бухгалтер подтвердил списание материалов по проекту «${label}».`,
      projectId: batch.projectId,
    });
  }

  return updated;
}

export async function rejectWriteOffBatch(batchId, user, rejectNote) {
  const batch = await prisma.materialWriteOffBatch.findUnique({
    where: { id: batchId },
    include: { project: { select: { title: true, projectNumber: true, assigneeId: true } } },
  });
  if (!batch) throw new Error('NOT_FOUND');
  if (!['PENDING_DIRECTOR', 'PENDING_ACCOUNTANT'].includes(batch.status)) {
    throw new Error('ALREADY_PROCESSED');
  }

  const canReject =
    ['ADMIN'].includes(user.role)
    || (batch.status === 'PENDING_DIRECTOR' && user.role === 'DIRECTOR')
    || (batch.status === 'PENDING_ACCOUNTANT' && user.role === 'ACCOUNTANT');
  if (!canReject) throw new Error('FORBIDDEN');

  const updated = await prisma.materialWriteOffBatch.update({
    where: { id: batchId },
    data: {
      status: 'REJECTED',
      rejectNote: rejectNote?.trim() || null,
      rejectedAt: new Date(),
    },
    include: batchInclude,
  });

  const label = batch.project.projectNumber || batch.project.title;
  if (batch.project.assigneeId) {
    await notifyUser({
      userId: batch.project.assigneeId,
      fromUserId: user.id,
      type: 'MATERIAL_WRITE_OFF',
      title: `Списание отклонено: ${label}`,
      message: rejectNote?.trim() || `Запрос на списание материалов по проекту «${label}» отклонён.`,
      projectId: batch.projectId,
    });
  }

  return updated;
}

export async function listWriteOffBatches(user, { status } = {}) {
  const where = status ? { status } : {};
  const batches = await prisma.materialWriteOffBatch.findMany({
    where,
    include: batchInclude,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  if (isOversightRole(user.role)) return batches;
  if (user.role === 'ACCOUNTANT') {
    return batches.filter((b) =>
      b.status === 'PENDING_ACCOUNTANT'
      || b.requestedById === user.id
      || b.project?.assigneeId === user.id,
    );
  }
  if (user.role === 'MANAGER' || user.role === 'EMPLOYEE') {
    return batches.filter((b) => b.requestedById === user.id || b.project?.assigneeId === user.id);
  }
  return batches.filter((b) => b.requestedById === user.id);
}
