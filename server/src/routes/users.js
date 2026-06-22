import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authRequired, attachUser, requirePermission, sanitizeUser } from '../lib/auth.js';
import { PERMISSIONS, listAssignablePermissions } from '../lib/permissions.js';
import { sendClientCredentials } from '../lib/clientCredentials.js';

const router = Router();
router.use(authRequired, attachUser);

const roleEnum = z.enum([
  'ADMIN', 'DIRECTOR', 'MANAGER', 'EMPLOYEE', 'WAREHOUSE', 'SUPPLY', 'ACCOUNTANT', 'CONTRACTOR', 'CLIENT',
]);

function emailFromLogin(login) {
  return login.includes('@') ? login : `${login}@solargalaxy.kz`;
}

router.get('/permissions', requirePermission(PERMISSIONS.USERS_PERMISSIONS, PERMISSIONS.ADMIN_FULL), (_req, res) => {
  res.json(listAssignablePermissions());
});

router.get('/', requirePermission(PERMISSIONS.USERS_VIEW, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const { role } = req.query;
  const users = await prisma.user.findMany({
    where: role ? { role: String(role) } : undefined,
    include: { permissions: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users.map(sanitizeUser));
});

router.post('/', requirePermission(PERMISSIONS.USERS_CREATE, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  try {
    const schema = z.object({
      login: z.string().min(2).regex(/^[a-z0-9_-]+$/i, 'Логин: латиница, цифры, _ -'),
      password: z.string().min(6),
      fullName: z.string().min(2),
      phone: z.string().optional(),
      company: z.string().optional(),
      role: roleEnum,
      permissions: z.array(z.string()).optional(),
    });
    const data = schema.parse(req.body);
    const email = emailFromLogin(data.login);
    const exists = await prisma.user.findFirst({
      where: { OR: [{ email }, { login: data.login }] },
    });
    if (exists) return res.status(409).json({ error: 'Логин или email уже занят' });

    const user = await prisma.user.create({
      data: {
        login: data.login.toLowerCase(),
        email,
        fullName: data.fullName,
        phone: data.phone,
        company: data.company,
        role: data.role,
        passwordHash: await bcrypt.hash(data.password, 10),
        permissions: data.permissions?.length
          ? { create: data.permissions.map((key) => ({ key })) }
          : undefined,
      },
      include: { permissions: true },
    });

    let credentialsDelivery = null;
    if (data.role === 'CLIENT' && data.phone) {
      credentialsDelivery = await sendClientCredentials({
        fullName: user.fullName,
        phone: data.phone,
        login: user.login,
        password: data.password,
      });
    }

    res.status(201).json({ ...sanitizeUser(user), credentialsDelivery });
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/me', requirePermission(PERMISSIONS.PROFILE_EDIT), async (req, res) => {
  const schema = z.object({
    fullName: z.string().min(2).optional(),
    phone: z.string().optional().nullable(),
    password: z.string().min(6).optional(),
  });
  try {
    const data = schema.parse(req.body);
    const update = { fullName: data.fullName, phone: data.phone };
    if (data.password) update.passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: update,
      include: { permissions: true },
    });
    res.json(sanitizeUser(user));
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/me', async (req, res) => {
  res.json(sanitizeUser(req.dbUser));
});

router.patch('/:id', requirePermission(PERMISSIONS.USERS_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const schema = z.object({
    fullName: z.string().min(2).optional(),
    phone: z.string().optional().nullable(),
    company: z.string().optional().nullable(),
    role: roleEnum.optional(),
    password: z.string().min(6).optional(),
    isActive: z.boolean().optional(),
  });
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Не найден' });
    if (target.role === 'ADMIN' && req.dbUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Нельзя редактировать администратора' });
    }

    const data = schema.parse(req.body);
    const update = { ...data };
    delete update.password;
    if (data.password) update.passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: update,
      include: { permissions: true },
    });
    res.json(sanitizeUser(user));
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Не найден' });
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/:id/permissions', requirePermission(PERMISSIONS.USERS_PERMISSIONS, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const schema = z.object({ permissions: z.array(z.string()) });
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Не найден' });
    if (target.role === 'ADMIN') return res.status(403).json({ error: 'У администратора все права по умолчанию' });

    const { permissions } = schema.parse(req.body);
    await prisma.$transaction([
      prisma.userPermission.deleteMany({ where: { userId: req.params.id } }),
      ...(permissions.length
        ? [prisma.userPermission.createMany({ data: permissions.map((key) => ({ userId: req.params.id, key })) })]
        : []),
    ]);
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { permissions: true },
    });
    res.json(sanitizeUser(user));
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/:id/toggle', requirePermission(PERMISSIONS.USERS_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'Не найден' });
  if (user.role === 'ADMIN') return res.status(403).json({ error: 'Нельзя отключить администратора' });
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isActive: !user.isActive },
    include: { permissions: true },
  });
  res.json(sanitizeUser(updated));
});

router.delete('/:id', requirePermission(PERMISSIONS.USERS_DELETE, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'Не найден' });
    if (user.role === 'ADMIN') return res.status(403).json({ error: 'Нельзя удалить администратора' });
    if (user.id === req.user.id) return res.status(403).json({ error: 'Нельзя удалить себя' });
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2003') return res.status(409).json({ error: 'Пользователь связан с данными. Отключите аккаунт.' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
