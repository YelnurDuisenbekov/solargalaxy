import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authRequired, requireRoles } from '../lib/auth.js';

const router = Router();
router.use(authRequired, requireRoles('ADMIN', 'EMPLOYEE'));

router.get('/products', async (_req, res) => {
  const products = await prisma.product.findMany({
    include: { stock: true },
    orderBy: { name: 'asc' },
  });
  res.json(products);
});

router.post('/products', requireRoles('ADMIN'), async (req, res) => {
  const schema = z.object({
    sku: z.string().min(2),
    name: z.string().min(2),
    category: z.string().optional(),
    unit: z.string().optional(),
    price: z.number().optional(),
    minStock: z.number().optional(),
    initialQty: z.number().optional(),
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
        minStock: data.minStock ?? 0,
        stock: { create: { quantity: data.initialQty ?? 0 } },
      },
      include: { stock: true },
    });
    res.status(201).json(product);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'SKU уже существует' });
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/movements', async (_req, res) => {
  const movements = await prisma.stockMovement.findMany({
    include: { product: true, author: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(movements);
});

router.post('/movements', async (req, res) => {
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

router.get('/summary', async (_req, res) => {
  const items = await prisma.stockItem.findMany({ include: { product: true } });
  const lowStock = items.filter((i) => i.quantity <= i.product.minStock);
  const totalValue = items.reduce((s, i) => s + i.quantity * i.product.price, 0);
  res.json({ totalSkus: items.length, totalValue, lowStockCount: lowStock.length, lowStock });
});

export default router;
