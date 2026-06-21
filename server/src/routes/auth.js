import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { signToken, sanitizeUser } from '../lib/auth.js';
import {
  normalizePhone,
  formatPhoneDisplay,
  leadPhoneDbFilter,
  clientAccountLogin,
  clientAccountEmail,
} from '../lib/phone.js';
import { linkProjectsToClient } from '../lib/projectIdentity.js';
import { phoneSchema } from '../lib/leadValidation.js';
import { sendClientCredentials } from '../lib/clientCredentials.js';

const router = Router();

async function attachClientProjects(user) {
  if (user.role !== 'CLIENT' || !user.phone) return;
  await linkProjectsToClient(prisma, user.id, user.phone);
}

async function findUserByPhone(rawPhone) {
  const phoneNorm = normalizePhone(rawPhone);
  const filter = leadPhoneDbFilter(rawPhone);
  if (!phoneNorm || !filter) return null;

  const candidates = await prisma.user.findMany({
    where: { ...filter, isActive: true },
    include: { permissions: true },
  });

  return candidates.find((u) => normalizePhone(u.phone) === phoneNorm) || null;
}

router.post('/login', async (req, res) => {
  try {
    const schema = z.object({
      login: z.string().min(2),
      password: z.string().min(6),
    });
    const { login, password } = schema.parse(req.body);

    let user = await findUserByPhone(login);

    if (!user) {
      const normalized = login.toLowerCase().trim();
      user = await prisma.user.findFirst({
        where: {
          isActive: true,
          OR: [
            { login: normalized },
            { email: normalized },
            { email: `${normalized}@solargalaxy.kz` },
          ],
        },
        include: { permissions: true },
      });
    }

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Неверные данные для входа' });
    }

    await attachClientProjects(user);
    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/register-client', async (req, res) => {
  try {
    const schema = z.object({
      password: z.string().min(6),
      fullName: z.string().min(2),
      phone: phoneSchema,
      company: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const phoneNorm = normalizePhone(data.phone);
    if (!phoneNorm) {
      return res.status(400).json({ error: 'Неверный формат телефона' });
    }

    const phoneDisplay = formatPhoneDisplay(phoneNorm);
    const existingByPhone = await findUserByPhone(data.phone);
    if (existingByPhone) {
      return res.status(409).json({ error: 'Клиент с этим телефоном уже зарегистрирован' });
    }

    const login = clientAccountLogin(phoneNorm);
    const email = clientAccountEmail(phoneNorm);

    const user = await prisma.user.create({
      data: {
        login,
        email,
        fullName: data.fullName,
        phone: phoneDisplay,
        company: data.company,
        passwordHash: await bcrypt.hash(data.password, 10),
        role: 'CLIENT',
      },
      include: { permissions: true },
    });
    await linkProjectsToClient(prisma, user.id, data.phone);
    const credentialsDelivery = await sendClientCredentials({
      fullName: user.fullName,
      phone: phoneDisplay,
      password: data.password,
    });
    const token = signToken(user);
    res.status(201).json({
      token,
      user: sanitizeUser(user),
      credentialsDelivery,
    });
  } catch (e) {
    if (e.name === 'ZodError') {
      return res.status(400).json({ error: 'Неверные данные. Телефон: +7 XXX XXX XXXX' });
    }
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
