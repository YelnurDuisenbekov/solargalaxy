import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authRequired, attachUser, requirePermission } from '../lib/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';

const router = Router();
router.use(authRequired, attachUser, requirePermission(PERMISSIONS.FINANCE_VIEW, PERMISSIONS.ADMIN_FULL));

const userSelect = { id: true, fullName: true, company: true };

router.get('/invoices', async (_req, res) => {
  const invoices = await prisma.invoice.findMany({
    include: {
      client: { select: userSelect },
      project: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(invoices);
});

router.post('/invoices', requirePermission(PERMISSIONS.FINANCE_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const schema = z.object({
    number: z.string().min(3),
    amount: z.number().positive(),
    clientId: z.string().optional().nullable(),
    projectId: z.string().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    notes: z.string().optional(),
    status: z.enum(['DRAFT', 'SENT', 'PAID', 'CANCELLED']).optional(),
  });
  try {
    const data = schema.parse(req.body);
    const invoice = await prisma.invoice.create({
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
      include: { client: { select: userSelect }, project: { select: { id: true, title: true } } },
    });
    res.status(201).json(invoice);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Номер счёта уже существует' });
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/invoices/:id', requirePermission(PERMISSIONS.FINANCE_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const schema = z.object({
    status: z.enum(['DRAFT', 'SENT', 'PAID', 'CANCELLED']).optional(),
    amount: z.number().positive().optional(),
    dueDate: z.string().datetime().optional().nullable(),
    notes: z.string().optional().nullable(),
  });
  try {
    const data = schema.parse(req.body);
    const update = { ...data };
    if (data.dueDate !== undefined) update.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.status === 'PAID') update.paidAt = new Date();

    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: update,
      include: { client: { select: userSelect }, project: { select: { id: true, title: true } } },
    });
    res.json(invoice);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Не найден' });
    res.status(400).json({ error: 'Неверные данные' });
  }
});

router.get('/summary', async (_req, res) => {
  const invoices = await prisma.invoice.findMany();
  const total = invoices.reduce((s, i) => s + i.amount, 0);
  const paid = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.amount, 0);
  const pending = invoices.filter((i) => ['DRAFT', 'SENT'].includes(i.status)).reduce((s, i) => s + i.amount, 0);
  res.json({ totalInvoices: invoices.length, total, paid, pending });
});

export default router;
