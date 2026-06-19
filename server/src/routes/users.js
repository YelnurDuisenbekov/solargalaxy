import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authRequired, requireRoles, sanitizeUser } from '../lib/auth.js';

const router = Router();

router.use(authRequired);

router.get('/', requireRoles('ADMIN', 'EMPLOYEE'), async (req, res) => {
  const { role } = req.query;
  const users = await prisma.user.findMany({
    where: role ? { role: String(role) } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  res.json(users.map(sanitizeUser));
});

router.post('/', requireRoles('ADMIN'), async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      fullName: z.string().min(2),
      phone: z.string().optional(),
      company: z.string().optional(),
      role: z.enum(['ADMIN', 'EMPLOYEE', 'CLIENT']),
    });
    const data = schema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) return res.status(409).json({ error: 'Email уже занят' });

    const user = await prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        phone: data.phone,
        company: data.company,
        role: data.role,
        passwordHash: await bcrypt.hash(data.password, 10),
      },
    });
    res.status(201).json(sanitizeUser(user));
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/:id/toggle', requireRoles('ADMIN'), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'Не найден' });
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isActive: !user.isActive },
  });
  res.json(sanitizeUser(updated));
});

router.get('/me', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return res.status(404).json({ error: 'Не найден' });
  res.json(sanitizeUser(user));
});

export default router;
