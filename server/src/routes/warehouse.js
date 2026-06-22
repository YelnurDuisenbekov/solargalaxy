import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authRequired, attachUser, requirePermission } from '../lib/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { notifyDirectors, notifyUser } from '../lib/notifyDirectors.js';
import { enrichProductsWithReservations, ensureReservationsSynced } from '../lib/stockReservation.js';
import {
  acceptMaterialTransferAct,
  actListInclude,
  canAcceptTransferAct,
  countPendingTransferActsForUser,
  createMaterialTransferAct,
  getPendingTransferActsForUser,
  listAllTransferActs,
} from '../lib/materialTransferAct.js';
import {
  listAcceptedTransferActsForUser,
  getManagerMaterialBalance,
  listWriteOffBatches,
  approveWriteOffByDirector,
  approveWriteOffByAccountant,
  rejectWriteOffBatch,
} from '../lib/materialWriteOff.js';

const router = Router();
router.use(authRequired, attachUser);

const viewPerms = [PERMISSIONS.WAREHOUSE_VIEW, PERMISSIONS.SUPPLY_VIEW, PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.ADMIN_FULL];

function formatSupplierName(orgType, rawName) {
  const cleaned = rawName
    .trim()
    .replace(/^ТОО\s*[«"]?/i, '')
    .replace(/[»"]\s*$/i, '')
    .replace(/^ИП\s+/i, '')
    .trim();
  if (!cleaned) return '';
  if (orgType === 'IP') return `ИП ${cleaned}`;
  return `ТОО «${cleaned}»`;
}

router.get('/products', requirePermission(...viewPerms), async (_req, res) => {
  await ensureReservationsSynced();
  const products = await prisma.product.findMany({
    include: { stock: true },
    orderBy: { name: 'asc' },
  });
  res.json(await enrichProductsWithReservations(products));
});

router.get('/products/:productId/reservations', requirePermission(...viewPerms), async (req, res) => {
  await ensureReservationsSynced();

  const product = await prisma.product.findUnique({
    where: { id: req.params.productId },
    select: { id: true, name: true, sku: true, unit: true },
  });
  if (!product) return res.status(404).json({ error: 'Товар не найден' });

  const reservations = await prisma.stockReservation.findMany({
    where: { productId: product.id, quantity: { gt: 0 } },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          projectNumber: true,
          phase: true,
          client: { select: { fullName: true } },
        },
      },
    },
  });

  const projects = reservations
    .map((row) => ({
      projectId: row.projectId,
      projectNumber: row.project.projectNumber,
      title: row.project.title,
      phase: row.project.phase,
      clientName: row.project.client?.fullName || null,
      quantity: row.quantity,
    }))
    .sort((a, b) => {
      const labelA = a.projectNumber || a.title;
      const labelB = b.projectNumber || b.title;
      return labelA.localeCompare(labelB, 'ru');
    });

  res.json({
    product,
    totalReserved: projects.reduce((sum, row) => sum + row.quantity, 0),
    projects,
  });
});

router.post('/products', requirePermission(PERMISSIONS.WAREHOUSE_EDIT, PERMISSIONS.WAREHOUSE_ISSUE, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const schema = z.object({
    sku: z.string().min(2),
    name: z.string().min(2),
    category: z.string().optional(),
    unit: z.string().optional(),
    price: z.number().min(0).optional(),
    purchasePrice: z.number().optional(),
    minStock: z.number().optional(),
    initialQty: z.number().optional(),
    kitCategory: z.enum(['PANEL', 'INVERTER', 'BATTERY', 'MOUNTING', 'COMMISSIONING', 'CABLE', 'OTHER']).optional().nullable(),
    powerW: z.number().positive().optional().nullable(),
    capacityKw: z.number().positive().optional().nullable(),
    capacityKwh: z.number().positive().optional().nullable(),
  });
  try {
    const data = schema.parse(req.body);
    const product = await prisma.product.create({
      data: {
        sku: data.sku,
        name: data.name,
        category: data.category,
        unit: data.unit ?? 'шт',
        price: data.price ?? 0,
        purchasePrice: data.purchasePrice ?? 0,
        minStock: data.minStock ?? 0,
        kitCategory: data.kitCategory ?? null,
        powerW: data.powerW ?? null,
        capacityKw: data.capacityKw ?? null,
        capacityKwh: data.capacityKwh ?? null,
        stock: { create: { quantity: data.initialQty ?? 0 } },
      },
      include: { stock: true },
    });
    res.status(201).json(product);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'SKU уже существует' });
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    console.error('POST /warehouse/products', e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/suppliers', requirePermission(...viewPerms), async (_req, res) => {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(suppliers);
});

router.post('/suppliers', requirePermission(PERMISSIONS.WAREHOUSE_EDIT, PERMISSIONS.WAREHOUSE_ISSUE, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const schema = z.object({
    orgType: z.enum(['TOO', 'IP']).default('TOO'),
    name: z.string().min(1).max(280),
    bin: z.string().regex(/^\d{12}$/, 'БИН должен содержать 12 цифр'),
  });
  try {
    const data = schema.parse(req.body);
    const fullName = formatSupplierName(data.orgType, data.name);
    if (!fullName) return res.status(400).json({ error: 'Укажите наименование' });

    const supplier = await prisma.supplier.create({
      data: {
        name: fullName,
        bin: data.bin.trim(),
      },
    });
    res.status(201).json(supplier);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Поставщик с таким БИН уже есть' });
    if (e.name === 'ZodError') {
      const msg = e.issues?.[0]?.message || e.errors?.[0]?.message;
      return res.status(400).json({ error: msg || 'Неверные данные' });
    }
    console.error('POST /warehouse/suppliers', e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/movements', requirePermission(...viewPerms), async (_req, res) => {
  const movements = await prisma.stockMovement.findMany({
    include: {
      product: true,
      author: { select: { fullName: true } },
      project: {
        select: {
          id: true,
          title: true,
          projectNumber: true,
          assignee: { select: { fullName: true } },
        },
      },
      receipt: {
        select: {
          invoiceNumber: true,
          invoiceDate: true,
          seller: true,
          supplier: { select: { name: true, bin: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(movements);
});

router.get('/receipts', requirePermission(...viewPerms), async (req, res) => {
  const supplierId = typeof req.query.supplierId === 'string' && req.query.supplierId
    ? req.query.supplierId
    : undefined;

  const receipts = await prisma.stockReceipt.findMany({
    where: supplierId ? { supplierId } : undefined,
    include: {
      author: { select: { fullName: true } },
      supplier: { select: { id: true, name: true, bin: true } },
      items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
    },
    orderBy: { receivedAt: 'desc' },
    take: 50,
  });
  res.json(receipts);
});

router.post('/receipts', requirePermission(PERMISSIONS.WAREHOUSE_EDIT, PERMISSIONS.WAREHOUSE_ISSUE, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const itemSchema = z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().min(0),
  });
  const schema = z.object({
    invoiceDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    invoiceNumber: z.string().min(1).max(100),
    supplierId: z.string(),
    priceIncludesVat: z.boolean().default(true),
    items: z.array(itemSchema).min(1),
  });

  try {
    const data = schema.parse(req.body);
    const invoiceDate = new Date(data.invoiceDate);
    if (Number.isNaN(invoiceDate.getTime())) {
      return res.status(400).json({ error: 'Неверная дата накладной' });
    }

    const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
    if (!supplier) return res.status(404).json({ error: 'Поставщик не найден' });

    const productIds = data.items.map((i) => i.productId);
    if (new Set(productIds).size !== productIds.length) {
      return res.status(400).json({ error: 'Один товар указан несколько раз — объедините количество в одну строку' });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { stock: true },
    });
    if (products.length !== productIds.length) {
      return res.status(404).json({ error: 'Один или несколько товаров не найдены' });
    }
    const productById = new Map(products.map((p) => [p.id, p]));

    const note = `Накладная №${data.invoiceNumber} от ${invoiceDate.toLocaleDateString('ru-RU')}, ${supplier.name}`;

    const receipt = await prisma.$transaction(async (tx) => {
      const created = await tx.stockReceipt.create({
        data: {
          invoiceDate,
          invoiceNumber: data.invoiceNumber.trim(),
          supplierId: supplier.id,
          seller: supplier.name,
          priceIncludesVat: data.priceIncludesVat,
          authorId: req.user.id,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: {
          supplier: true,
          items: { include: { product: true } },
          author: { select: { fullName: true } },
        },
      });

      for (const item of data.items) {
        const product = productById.get(item.productId);
        const stock = product.stock;
        if (!stock) {
          await tx.stockItem.create({
            data: { productId: item.productId, quantity: item.quantity },
          });
        } else {
          await tx.stockItem.update({
            where: { productId: item.productId },
            data: { quantity: stock.quantity + item.quantity },
          });
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { purchasePrice: item.unitPrice },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'IN',
            quantity: item.quantity,
            note,
            receiptId: created.id,
            authorId: req.user.id,
          },
        });
      }

      return created;
    });

    res.status(201).json(receipt);
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Заполните накладную и добавьте товары' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/receipts/:id', requirePermission(PERMISSIONS.WAREHOUSE_EDIT, PERMISSIONS.WAREHOUSE_ISSUE, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const itemSchema = z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().min(0),
  });
  const schema = z.object({
    invoiceDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    invoiceNumber: z.string().min(1).max(100),
    supplierId: z.string(),
    priceIncludesVat: z.boolean().default(true),
    items: z.array(itemSchema).min(1),
  });

  try {
    const data = schema.parse(req.body);
    const invoiceDate = new Date(data.invoiceDate);
    if (Number.isNaN(invoiceDate.getTime())) {
      return res.status(400).json({ error: 'Неверная дата накладной' });
    }

    const existing = await prisma.stockReceipt.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!existing) return res.status(404).json({ error: 'Накладная не найдена' });

    const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
    if (!supplier) return res.status(404).json({ error: 'Поставщик не найден' });

    const productIds = data.items.map((i) => i.productId);
    if (new Set(productIds).size !== productIds.length) {
      return res.status(400).json({ error: 'Один товар указан несколько раз — объедините количество в одну строку' });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { stock: true },
    });
    if (products.length !== productIds.length) {
      return res.status(404).json({ error: 'Один или несколько товаров не найдены' });
    }
    const productById = new Map(products.map((p) => [p.id, p]));

    const oldByProduct = new Map(existing.items.map((i) => [i.productId, i.quantity]));
    const newByProduct = new Map(data.items.map((i) => [i.productId, i.quantity]));
    const affectedIds = new Set([...oldByProduct.keys(), ...newByProduct.keys()]);

    const stocks = await prisma.stockItem.findMany({
      where: { productId: { in: [...affectedIds] } },
    });
    const stockByProduct = new Map(stocks.map((s) => [s.productId, s.quantity]));

    for (const productId of affectedIds) {
      const current = stockByProduct.get(productId) ?? 0;
      const oldQty = oldByProduct.get(productId) ?? 0;
      const newQty = newByProduct.get(productId) ?? 0;
      if (current - oldQty + newQty < 0) {
        const product = await prisma.product.findUnique({ where: { id: productId }, select: { name: true } });
        return res.status(400).json({
          error: `Недостаточно остатка для изменения накладной: ${product?.name || 'товар'}`,
        });
      }
    }

    const note = `Накладная №${data.invoiceNumber} от ${invoiceDate.toLocaleDateString('ru-RU')}, ${supplier.name}`;

    const receipt = await prisma.$transaction(async (tx) => {
      for (const item of existing.items) {
        const stock = await tx.stockItem.findUnique({ where: { productId: item.productId } });
        if (stock) {
          await tx.stockItem.update({
            where: { productId: item.productId },
            data: { quantity: stock.quantity - item.quantity },
          });
        }
      }

      await tx.stockMovement.deleteMany({ where: { receiptId: existing.id } });
      await tx.stockReceiptItem.deleteMany({ where: { receiptId: existing.id } });

      const updated = await tx.stockReceipt.update({
        where: { id: existing.id },
        data: {
          invoiceDate,
          invoiceNumber: data.invoiceNumber.trim(),
          supplierId: supplier.id,
          seller: supplier.name,
          priceIncludesVat: data.priceIncludesVat,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: {
          supplier: true,
          items: { include: { product: true } },
          author: { select: { fullName: true } },
        },
      });

      for (const item of data.items) {
        const product = productById.get(item.productId);
        const stock = product.stock;
        if (!stock) {
          await tx.stockItem.create({
            data: { productId: item.productId, quantity: item.quantity },
          });
        } else {
          const fresh = await tx.stockItem.findUnique({ where: { productId: item.productId } });
          await tx.stockItem.update({
            where: { productId: item.productId },
            data: { quantity: fresh.quantity + item.quantity },
          });
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { purchasePrice: item.unitPrice },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'IN',
            quantity: item.quantity,
            note: `${note} (изм.)`,
            receiptId: existing.id,
            authorId: req.user.id,
          },
        });
      }

      return updated;
    });

    res.json(receipt);
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Заполните накладную и добавьте товары' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/stock/bulk', requirePermission(PERMISSIONS.WAREHOUSE_EDIT, PERMISSIONS.WAREHOUSE_ISSUE, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const schema = z.object({
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().min(0),
    })).min(1),
    sendForApproval: z.boolean().optional().default(false),
  });

  try {
    const { items, sendForApproval } = schema.parse(req.body);
    const productIds = items.map((i) => i.productId);
    if (new Set(productIds).size !== productIds.length) {
      return res.status(400).json({ error: 'Дублирующиеся позиции' });
    }

    const stocks = await prisma.stockItem.findMany({
      where: { productId: { in: productIds } },
    });
    const stockByProduct = new Map(stocks.map((s) => [s.productId, s]));
    if (stocks.length !== productIds.length) {
      return res.status(404).json({ error: 'Товар не найден на складе' });
    }

    const changedItems = items.filter((item) => {
      const stock = stockByProduct.get(item.productId);
      return stock.quantity !== item.quantity;
    });

    if (!changedItems.length) {
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { stock: true },
        orderBy: { name: 'asc' },
      });
      return res.json({ products, approval: null });
    }

    const isDirector = req.user.role === 'DIRECTOR' || req.user.role === 'ADMIN';
    const needsApproval = sendForApproval && !isDirector;

    let batchId = null;

    await prisma.$transaction(async (tx) => {
      const adjustmentRows = [];

      for (const item of changedItems) {
        const stock = stockByProduct.get(item.productId);
        adjustmentRows.push({
          productId: item.productId,
          quantityBefore: stock.quantity,
          quantityAfter: item.quantity,
        });

        await tx.stockItem.update({
          where: { productId: item.productId },
          data: { quantity: item.quantity },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'ADJUST',
            quantity: item.quantity,
            note: needsApproval
              ? `Редактирование остатка (на согласовании): ${stock.quantity} → ${item.quantity}`
              : `Редактирование остатка: ${stock.quantity} → ${item.quantity}`,
            authorId: req.user.id,
          },
        });
      }

      if (needsApproval) {
        const batch = await tx.stockAdjustmentBatch.create({
          data: {
            authorId: req.user.id,
            status: 'PENDING_DIRECTOR',
            items: { create: adjustmentRows },
          },
          include: { items: { include: { product: { select: { name: true } } } } },
        });
        batchId = batch.id;
      } else if (isDirector) {
        await tx.stockAdjustmentBatch.create({
          data: {
            authorId: req.user.id,
            status: 'APPROVED',
            approvedAt: new Date(),
            items: { create: adjustmentRows },
          },
        });
      }
    });

    if (needsApproval && batchId) {
      const summary = changedItems.length === 1
        ? 'изменена 1 позиция'
        : `изменено ${changedItems.length} позиций`;
      await notifyDirectors({
        type: 'STOCK_ADJUSTMENT',
        title: 'Согласование остатков на складе',
        message: `${req.user.fullName || 'Сотрудник'}: ${summary}. Требуется согласование директора.`,
        fromUserId: req.user.id,
      });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { stock: true },
      orderBy: { name: 'asc' },
    });

    res.json({
      products,
      approval: needsApproval
        ? { status: 'PENDING_DIRECTOR', message: 'Изменения направлены директору на согласование.' }
        : null,
    });
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/stock/adjustments', requirePermission(...viewPerms), async (req, res) => {
  const status = req.query.status === 'PENDING_DIRECTOR' ? 'PENDING_DIRECTOR' : undefined;
  const batches = await prisma.stockAdjustmentBatch.findMany({
    where: status ? { status } : undefined,
    include: {
      author: { select: { fullName: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json(batches);
});

router.post('/stock/adjustments/:id/approve', requirePermission(PERMISSIONS.WAREHOUSE_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  try {
    if (req.user.role !== 'DIRECTOR' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Согласование доступно директору' });
    }

    const batch = await prisma.stockAdjustmentBatch.findUnique({
      where: { id: req.params.id },
      include: { author: { select: { id: true } } },
    });
    if (!batch) return res.status(404).json({ error: 'Не найдено' });
    if (batch.status !== 'PENDING_DIRECTOR') {
      return res.status(400).json({ error: 'Уже обработано' });
    }

    const updated = await prisma.stockAdjustmentBatch.update({
      where: { id: batch.id },
      data: { status: 'APPROVED', approvedAt: new Date() },
      include: {
        author: { select: { fullName: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
    });

    await notifyUser({
      userId: batch.authorId,
      fromUserId: req.user.id,
      type: 'PROJECT_UPDATE',
      title: 'Остатки согласованы',
      message: 'Директор согласовал редактирование остатков на складе.',
    });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/stock/adjustments/:id/reject', requirePermission(PERMISSIONS.WAREHOUSE_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const schema = z.object({ note: z.string().max(2000).optional() });
  try {
    if (req.user.role !== 'DIRECTOR' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Доступно директору' });
    }

    const { note } = schema.parse(req.body);
    const batch = await prisma.stockAdjustmentBatch.findUnique({
      where: { id: req.params.id },
      include: { items: true, author: { select: { id: true } } },
    });
    if (!batch) return res.status(404).json({ error: 'Не найдено' });
    if (batch.status !== 'PENDING_DIRECTOR') {
      return res.status(400).json({ error: 'Уже обработано' });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of batch.items) {
        await tx.stockItem.update({
          where: { productId: item.productId },
          data: { quantity: item.quantityBefore },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'ADJUST',
            quantity: item.quantityBefore,
            note: `Отклонено директором: возврат ${item.quantityAfter} → ${item.quantityBefore}`,
            authorId: req.user.id,
          },
        });
      }

      await tx.stockAdjustmentBatch.update({
        where: { id: batch.id },
        data: { status: 'REJECTED', note: note?.trim() || null },
      });
    });

    await notifyUser({
      userId: batch.authorId,
      fromUserId: req.user.id,
      type: 'PROJECT_UPDATE',
      title: 'Остатки возвращены',
      message: note?.trim() || 'Директор отклонил редактирование остатков. Значения восстановлены.',
    });

    res.json({ ok: true });
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/movements', requirePermission(PERMISSIONS.WAREHOUSE_EDIT, PERMISSIONS.WAREHOUSE_ISSUE, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const schema = z.object({
    productId: z.string(),
    type: z.enum(['IN', 'OUT', 'ADJUST']),
    quantity: z.number().int().positive(),
    note: z.string().optional(),
  });
  try {
    const data = schema.parse(req.body);
    const stock = await prisma.stockItem.findUnique({ where: { productId: data.productId } });
    if (!stock) return res.status(404).json({ error: 'Товар не на складе' });

    let newQty = stock.quantity;
    if (data.type === 'IN') newQty += data.quantity;
    else if (data.type === 'OUT') {
      if (stock.quantity < data.quantity) return res.status(400).json({ error: 'Недостаточно на складе' });
      newQty -= data.quantity;
    } else newQty = data.quantity;

    const [movement] = await prisma.$transaction([
      prisma.stockMovement.create({
        data: { ...data, authorId: req.user.id },
      }),
      prisma.stockItem.update({
        where: { productId: data.productId },
        data: { quantity: newQty },
      }),
    ]);
    res.status(201).json(movement);
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/transfer-acts', requirePermission(...viewPerms), async (_req, res) => {
  const acts = await listAllTransferActs();
  res.json(acts);
});

router.get('/accepted-inventory', requirePermission(...viewPerms), async (req, res) => {
  const acts = await listAcceptedTransferActsForUser(req.user);
  const isManagerLike = ['MANAGER', 'EMPLOYEE'].includes(req.user.role);
  const inventory = isManagerLike || req.user.role === 'ADMIN'
    ? await getManagerMaterialBalance(req.user.id)
    : { rows: [], summary: [] };
  const writeOffs = await listWriteOffBatches(req.user);
  res.json({ acts, inventory, writeOffs });
});

router.get('/write-offs', requirePermission(...viewPerms, PERMISSIONS.FINANCE_VIEW), async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const batches = await listWriteOffBatches(req.user, { status });
  res.json(batches);
});

router.post('/write-offs/:id/approve-director', requirePermission(PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  try {
    if (req.user.role !== 'DIRECTOR' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Согласование доступно директору' });
    }
    const batch = await approveWriteOffByDirector(req.params.id, req.user);
    res.json(batch);
  } catch (e) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ error: 'Не найдено' });
    if (e.message === 'ALREADY_PROCESSED') return res.status(400).json({ error: 'Уже обработано' });
    if (e.message === 'FORBIDDEN') return res.status(403).json({ error: 'Недостаточно прав' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/write-offs/:id/approve-accountant', requirePermission(PERMISSIONS.FINANCE_VIEW, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  try {
    if (req.user.role !== 'ACCOUNTANT' && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Подтверждение доступно бухгалтеру' });
    }
    const batch = await approveWriteOffByAccountant(req.params.id, req.user);
    res.json(batch);
  } catch (e) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ error: 'Не найдено' });
    if (e.message === 'ALREADY_PROCESSED') return res.status(400).json({ error: 'Уже обработано' });
    if (e.message === 'FORBIDDEN') return res.status(403).json({ error: 'Недостаточно прав' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/write-offs/:id/reject', requirePermission(PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.FINANCE_VIEW, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const schema = z.object({ note: z.string().max(2000).optional() });
  try {
    const { note } = schema.parse(req.body || {});
    const batch = await rejectWriteOffBatch(req.params.id, req.user, note);
    res.json(batch);
  } catch (e) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ error: 'Не найдено' });
    if (e.message === 'ALREADY_PROCESSED') return res.status(400).json({ error: 'Уже обработано' });
    if (e.message === 'FORBIDDEN') return res.status(403).json({ error: 'Недостаточно прав' });
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/transfer-acts/:id/accept', requirePermission(PERMISSIONS.ERP_EDIT, PERMISSIONS.ERP_VIEW, PERMISSIONS.WAREHOUSE_VIEW, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  try {
    const act = await acceptMaterialTransferAct(req.params.id, req.user);
    res.json(act);
  } catch (e) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ error: 'Акт не найден' });
    if (e.message === 'ALREADY_PROCESSED') return res.status(400).json({ error: 'Акт уже обработан' });
    if (e.message === 'FORBIDDEN') return res.status(403).json({ error: 'Принять акт может только назначенный менеджер проекта' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/products/pricing', requirePermission(PERMISSIONS.PRICING_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const itemSchema = z.object({
    productId: z.string(),
    price: z.number().min(0).optional(),
    purchasePrice: z.number().min(0).optional(),
    marginPct: z.number().optional(),
  });
  const schema = z.object({
    applyMarginPct: z.number().optional(),
    productIds: z.array(z.string()).optional(),
    updates: z.array(itemSchema).optional(),
  });

  try {
    const data = schema.parse(req.body);

    if (data.applyMarginPct != null) {
      const where = data.productIds?.length ? { id: { in: data.productIds } } : {};
      const products = await prisma.product.findMany({ where });
      for (const product of products) {
        if (product.purchasePrice <= 0) continue;
        const price = Math.round(product.purchasePrice * (1 + data.applyMarginPct / 100) * 100) / 100;
        await prisma.product.update({ where: { id: product.id }, data: { price } });
      }
    }

    if (data.updates?.length) {
      for (const row of data.updates) {
        const product = await prisma.product.findUnique({ where: { id: row.productId } });
        if (!product) continue;
        let nextPrice = row.price;
        if (row.marginPct != null && product.purchasePrice > 0) {
          nextPrice = Math.round(product.purchasePrice * (1 + row.marginPct / 100) * 100) / 100;
        }
        if (nextPrice == null) continue;
        await prisma.product.update({
          where: { id: product.id },
          data: {
            price: nextPrice,
            ...(row.purchasePrice != null ? { purchasePrice: row.purchasePrice } : {}),
          },
        });
      }
    }

    if (data.applyMarginPct == null && !data.updates?.length) {
      return res.status(400).json({ error: 'Укажите цены или маржу' });
    }

    const products = await prisma.product.findMany({
      include: { stock: true },
      orderBy: { name: 'asc' },
    });
    res.json(await enrichProductsWithReservations(products));
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/issuable-projects', requirePermission(PERMISSIONS.WAREHOUSE_ISSUE, PERMISSIONS.ADMIN_FULL), async (_req, res) => {
  await ensureReservationsSynced();
  const projects = await prisma.project.findMany({
    where: { phase: { notIn: ['COMPLETED', 'CANCELLED'] } },
    include: {
      materials: { select: { quantityPlanned: true, quantityIssued: true } },
      assignee: { select: { id: true, fullName: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const issuable = projects
    .filter((p) => p.materials.some((m) => m.quantityPlanned > m.quantityIssued))
    .map(({ materials, ...project }) => ({
      ...project,
      issuableLines: materials.filter((m) => m.quantityPlanned > m.quantityIssued).length,
    }));

  res.json(issuable);
});

router.get('/issuable-projects/:id', requirePermission(PERMISSIONS.WAREHOUSE_ISSUE, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      assignee: { select: { id: true, fullName: true } },
      materials: { include: { product: { include: { stock: true } } } },
    },
  });
  if (!project) return res.status(404).json({ error: 'Проект не найден' });
  res.json(project);
});

router.post('/issuable-projects/:id/transfer-acts', requirePermission(PERMISSIONS.WAREHOUSE_ISSUE, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const schema = z.object({
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
    })).min(1),
    note: z.string().max(500).optional(),
  });

  try {
    const { items, note } = schema.parse(req.body);
    const act = await createMaterialTransferAct({
      projectId: req.params.id,
      items,
      note,
      issuer: req.user,
    });
    res.status(201).json(act);
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Укажите материалы для выдачи' });
    if (e.message === 'PROJECT_NOT_FOUND') return res.status(404).json({ error: 'Проект не найден' });
    if (e.message === 'NOT_IN_KIT') return res.status(400).json({ error: 'Товар не входит в комплект проекта' });
    if (e.message === 'EXCEEDS_PLAN') return res.status(400).json({ error: 'Количество превышает план комплекта' });
    if (e.message === 'INSUFFICIENT_STOCK') return res.status(400).json({ error: 'Недостаточно на складе' });
    if (e.message === 'DUPLICATE_PRODUCT') return res.status(400).json({ error: 'Один товар указан несколько раз' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/summary', requirePermission(...viewPerms), async (req, res) => {
  const products = await prisma.product.findMany({ include: { stock: true } });
  const enriched = await enrichProductsWithReservations(products);
  const lowStock = enriched.filter((item) => item.available <= item.minStock);
  const totalValue = enriched.reduce((sum, item) => sum + item.stock.quantity * item.price, 0);
  const pendingTransferActsTotal = await prisma.materialTransferAct.count({
    where: { status: 'PENDING_MANAGER' },
  });
  const pendingTransferActsForUser = await countPendingTransferActsForUser(req.user);
  const pendingTransferActs = await getPendingTransferActsForUser(req.user);
  res.json({
    totalSkus: enriched.length,
    totalValue,
    lowStockCount: lowStock.length,
    lowStock,
    pendingTransferActsTotal,
    pendingTransferActsForUser,
    pendingTransferActs: pendingTransferActs.slice(0, 10),
  });
});

export default router;
