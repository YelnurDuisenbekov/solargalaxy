import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { optionalAuth } from '../lib/optionalAuth.js';
import { normalizePhone, formatPhoneDisplay, findClientByPhone } from '../lib/phone.js';
import { syncLeadProposal } from '../lib/leadProposal.js';
import {
  phoneSchema,
  citySchema,
  objectTypeEnum,
  systemTypeEnum,
  formatZodError,
} from '../lib/leadValidation.js';
import { leadRateLimiter, trackRateLimiter } from '../lib/security.js';

const router = Router();

function sanitizeText(value, max) {
  if (value == null) return undefined;
  return String(value).trim().slice(0, max);
}

router.post('/leads', leadRateLimiter, optionalAuth, async (req, res) => {
  const schema = z.object({
    fullName: z.string({ required_error: 'укажите ФИО' }).min(2, 'минимум 2 символа').max(120),
    name: z.string().min(2).max(120).optional(),
    phone: phoneSchema,
    email: z.string().email().max(200).optional().or(z.literal('')),
    city: citySchema,
    objectType: objectTypeEnum.optional(),
    systemType: systemTypeEnum.optional(),
    capacityKw: z.number().positive().max(100000).optional(),
    notes: z.string().max(2000).optional(),
    source: z.string().max(100).optional(),
  });

  try {
    const data = schema.parse(req.body);
    const phoneNorm = normalizePhone(data.phone);
    if (!phoneNorm) {
      return res.status(400).json({ error: 'Неверный формат телефона', fields: { phone: 'формат +7 XXX XXX XXXX' } });
    }
    const phoneDisplay = formatPhoneDisplay(phoneNorm);

    let clientId = null;
    if (req.user?.role === 'CLIENT') {
      clientId = req.user.id;
    } else {
      const client = await findClientByPhone(prisma, data.phone);
      clientId = client?.id ?? null;
    }

    const fullName = sanitizeText(data.fullName || data.name, 120);
    const notes = sanitizeText(data.notes, 2000);
    const source = sanitizeText(data.source, 100) || 'Сайт';
    const email = data.email ? sanitizeText(data.email, 200) : null;

    let lead = await prisma.lead.create({
      data: {
        fullName,
        phone: phoneDisplay,
        email: email || null,
        city: data.city,
        objectType: data.objectType || 'OTHER',
        systemType: data.systemType || 'ON_GRID',
        capacityKw: data.capacityKw,
        source,
        notes,
        clientId,
      },
    });

    if (lead.capacityKw) {
      await syncLeadProposal(prisma, lead, { force: true });
      lead = await prisma.lead.findUnique({ where: { id: lead.id } });
    }

    // Минимум полей для публичной формы (alreadyClient через clientId)
    res.status(201).json({
      id: lead.id,
      fullName: lead.fullName,
      phone: lead.phone,
      city: lead.city,
      capacityKw: lead.capacityKw,
      clientId: lead.clientId,
    });
  } catch (e) {
    if (e.name === 'ZodError') {
      const { error, fields } = formatZodError(e);
      return res.status(400).json({ error, fields });
    }
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/track/pageview', trackRateLimiter, async (req, res) => {
  try {
    const path = String(req.body?.path || '/').slice(0, 200);
    const referrer = req.body?.referrer ? String(req.body.referrer).slice(0, 500) : null;
    const sessionId = req.body?.sessionId ? String(req.body.sessionId).slice(0, 64) : null;
    await prisma.pageView.create({
      data: { path, referrer, sessionId },
    });
    res.status(204).end();
  } catch (err) {
    console.error('[analytics] pageview', err.message);
    res.status(500).json({ error: 'Ошибка записи' });
  }
});

router.post('/track/form-event', trackRateLimiter, async (req, res) => {
  try {
    const formId = String(req.body?.formId || '').slice(0, 64);
    const event = String(req.body?.event || '').slice(0, 32);
    const allowed = ['view', 'start', 'submit', 'error'];
    if (!formId || !allowed.includes(event)) {
      return res.status(400).json({ error: 'Некорректные данные' });
    }
    const path = req.body?.path ? String(req.body.path).slice(0, 200) : null;
    const sessionId = req.body?.sessionId ? String(req.body.sessionId).slice(0, 64) : null;
    await prisma.formEvent.create({
      data: { formId, event, path, sessionId },
    });
    res.status(204).end();
  } catch (err) {
    console.error('[analytics] form-event', err.message);
    res.status(500).json({ error: 'Ошибка записи' });
  }
});

export default router;
