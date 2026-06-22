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



const router = Router();



router.post('/leads', optionalAuth, async (req, res) => {

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



    let lead = await prisma.lead.create({

      data: {

        fullName: data.fullName || data.name,

        phone: phoneDisplay,

        email: data.email || null,

        city: data.city,

        objectType: data.objectType || 'OTHER',

        systemType: data.systemType || 'ON_GRID',

        capacityKw: data.capacityKw,

        source: data.source || 'Сайт',

        notes: data.notes,

        clientId,

      },

    });



    if (lead.capacityKw) {

      await syncLeadProposal(prisma, lead, { force: true });

      lead = await prisma.lead.findUnique({ where: { id: lead.id } });

    }



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
