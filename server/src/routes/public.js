import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import {
  phoneSchema,
  citySchema,
  objectTypeEnum,
  systemTypeEnum,
  formatZodError,
} from '../lib/leadValidation.js';

const router = Router();

router.post('/leads', async (req, res) => {
  const schema = z.object({
    fullName: z.string({ required_error: 'укажите ФИО' }).min(2, 'минимум 2 символа'),
    name: z.string().min(2).optional(),
    phone: phoneSchema,
    email: z.string().email().optional().or(z.literal('')),
    city: citySchema,
    objectType: objectTypeEnum.optional(),
    systemType: systemTypeEnum.optional(),
    capacityKw: z.number().positive().optional(),
    notes: z.string().optional(),
    source: z.string().optional(),
  });
  try {
    const data = schema.parse(req.body);
    const lead = await prisma.lead.create({
      data: {
        fullName: data.fullName || data.name,
        phone: data.phone,
        email: data.email || null,
        city: data.city,
        objectType: data.objectType || 'OTHER',
        systemType: data.systemType || 'ON_GRID',
        capacityKw: data.capacityKw,
        source: data.source || 'Сайт',
        notes: data.notes,
      },
    });
    res.status(201).json(lead);
  } catch (e) {
    if (e.name === 'ZodError') {
      const { error, fields } = formatZodError(e);
      return res.status(400).json({ error, fields });
    }
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
