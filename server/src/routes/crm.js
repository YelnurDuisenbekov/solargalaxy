import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authRequired, requireRoles } from '../lib/auth.js';

const router = Router();
router.use(authRequired, requireRoles('ADMIN', 'EMPLOYEE'));

router.get('/leads', async (_req, res) => {
  const leads = await prisma.lead.findMany({ include: { deal: true }, orderBy: { createdAt: 'desc' } });
  res.json(leads);
});

router.post('/leads', async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    phone: z.string().min(10),
    email: z.string().email().optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
  });
  try {
    const data = schema.parse(req.body);
    const lead = await prisma.lead.create({ data });
    res.status(201).json(lead);
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/deals', async (_req, res) => {
  const deals = await prisma.deal.findMany({
    include: { client: { select: { id: true, fullName: true, company: true } }, lead: true },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(deals);
});

router.post('/deals', async (req, res) => {
  const schema = z.object({
    title: z.string().min(2),
    amount: z.number().optional(),
    clientId: z.string().optional(),
    leadId: z.string().optional(),
    notes: z.string().optional(),
  });
  try {
    const data = schema.parse(req.body);
    const deal = await prisma.deal.create({ data: { ...data, amount: data.amount ?? 0 } });
    res.status(201).json(deal);
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/deals/:id/status', async (req, res) => {
  const schema = z.object({ status: z.enum(['NEW', 'IN_PROGRESS', 'WON', 'LOST']) });
  try {
    const { status } = schema.parse(req.body);
    const deal = await prisma.deal.update({ where: { id: req.params.id }, data: { status } });
    res.json(deal);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Не найдена' });
    res.status(400).json({ error: 'Неверные данные' });
  }
});

export default router;
