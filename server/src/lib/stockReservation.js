import prisma from './prisma.js';

const INACTIVE_PHASES = new Set(['COMPLETED', 'CANCELLED']);

let lastSyncAt = 0;
let syncInFlight = null;
const SYNC_TTL_MS = 30_000;

export async function ensureReservationsSynced(force = false) {
  const now = Date.now();
  if (!force && now - lastSyncAt < SYNC_TTL_MS) return;
  if (syncInFlight) return syncInFlight;

  syncInFlight = syncAllProjectReservations()
    .then(() => {
      lastSyncAt = Date.now();
    })
    .catch((err) => {
      console.error('Stock reservation sync failed:', err);
      throw err;
    })
    .finally(() => {
      syncInFlight = null;
    });

  return syncInFlight;
}

export async function syncProjectReservations(projectId, tx = prisma) {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: {
      phase: true,
      materials: {
        select: { productId: true, quantityPlanned: true, quantityIssued: true },
      },
    },
  });
  if (!project) return;

  if (INACTIVE_PHASES.has(project.phase)) {
    await tx.stockReservation.deleteMany({ where: { projectId } });
    return;
  }

  const materialProductIds = new Set();

  for (const material of project.materials) {
    materialProductIds.add(material.productId);
    const quantity = Math.max(0, material.quantityPlanned - material.quantityIssued);

    if (quantity > 0) {
      await tx.stockReservation.upsert({
        where: {
          projectId_productId: { projectId, productId: material.productId },
        },
        create: { projectId, productId: material.productId, quantity },
        update: { quantity },
      });
    } else {
      await tx.stockReservation.deleteMany({
        where: { projectId, productId: material.productId },
      });
    }
  }

  await tx.stockReservation.deleteMany({
    where: {
      projectId,
      ...(materialProductIds.size
        ? { productId: { notIn: [...materialProductIds] } }
        : {}),
    },
  });
}

export async function syncAllProjectReservations(tx = prisma) {
  const projects = await tx.project.findMany({
    where: { phase: { notIn: [...INACTIVE_PHASES] } },
    select: { id: true },
  });

  for (const project of projects) {
    await syncProjectReservations(project.id, tx);
  }
}

export async function getReservedTotalsByProduct(tx = prisma) {
  const rows = await tx.stockReservation.groupBy({
    by: ['productId'],
    _sum: { quantity: true },
  });
  return new Map(rows.map((row) => [row.productId, row._sum.quantity ?? 0]));
}

export function attachStockAvailability(product, reservedMap) {
  const reserved = reservedMap.get(product.id) ?? 0;
  const quantity = product.stock?.quantity ?? 0;
  const available = Math.max(0, quantity - reserved);

  return {
    ...product,
    reserved,
    available,
    stock: product.stock
      ? { ...product.stock, reserved, available }
      : { quantity: 0, reserved, available, location: 'Основной склад' },
  };
}

export async function enrichProductsWithReservations(products, tx = prisma) {
  const reservedMap = await getReservedTotalsByProduct(tx);
  return products.map((product) => attachStockAvailability(product, reservedMap));
}
