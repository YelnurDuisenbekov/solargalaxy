import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';

const router = Router();

router.post('/leads', async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    phone: z.string().min(10),
    email: z.string().email().optional().or(z.literal('')),
    notes: z.string().optional(),
  });
  try {
    const data = schema.parse(req.body);
    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        source: 'Сайт',
        notes: data.notes,
      },
    });
    res.status(201).json(lead);
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
