import { Router } from 'express';

import prisma from '../lib/prisma.js';

import { authRequired, requireRoles } from '../lib/auth.js';

import { normalizePhone, leadPhoneDbFilter } from '../lib/phone.js';

import { linkProjectsToClient } from '../lib/projectIdentity.js';



const router = Router();

router.use(authRequired);



const userBrief = { select: { id: true, fullName: true, phone: true, company: true } };



async function clientContext(req) {

  const clientId = req.user.id;

  const dbUser = await prisma.user.findUnique({

    where: { id: clientId },

    select: { phone: true },

  });

  const phoneRaw = dbUser?.phone ?? null;

  const phone = normalizePhone(phoneRaw);

  await linkProjectsToClient(prisma, clientId, phoneRaw);

  const projectWhere = phone

    ? { OR: [{ clientId }, { clientPhone: phone }] }

    : { clientId };

  return { clientId, phone, phoneRaw, projectWhere };

}



const leadListSelect = {

  id: true,

  fullName: true,

  city: true,

  objectType: true,

  systemType: true,

  capacityKw: true,

  status: true,

  source: true,

  createdAt: true,

  updatedAt: true,

};



async function clientLeads(phoneRaw) {

  const phoneNorm = normalizePhone(phoneRaw);

  const filter = leadPhoneDbFilter(phoneRaw);

  if (!phoneNorm || !filter) return [];

  const candidates = await prisma.lead.findMany({

    where: filter,

    select: leadListSelect,

    orderBy: { createdAt: 'desc' },

  });

  return candidates.filter((l) => normalizePhone(l.phone) === phoneNorm);

}



function projectAccessWhere(id, { clientId, phone, projectWhere }) {

  return { id, ...projectWhere };

}



router.get('/dashboard', requireRoles('CLIENT'), async (req, res) => {

  const { clientId, phoneRaw, projectWhere } = await clientContext(req);



  const [deals, projects, invoices, leads] = await Promise.all([

    prisma.deal.findMany({

      where: { clientId },

      select: {

        id: true,

        title: true,

        amount: true,

        status: true,

        capacityKw: true,

        city: true,

        updatedAt: true,

      },

      orderBy: { updatedAt: 'desc' },

    }),

    prisma.project.findMany({

      where: projectWhere,

      select: {

        id: true,

        projectNumber: true,

        title: true,

        phase: true,

        capacityKw: true,

        city: true,

        address: true,

        startDate: true,

        updatedAt: true,

      },

      orderBy: { updatedAt: 'desc' },

    }),

    prisma.invoice.findMany({

      where: { clientId },

      select: {

        id: true,

        number: true,

        amount: true,

        status: true,

        dueDate: true,

        paidAt: true,

        projectId: true,

      },

      orderBy: { createdAt: 'desc' },

    }),

    clientLeads(phoneRaw),

  ]);



  res.json({ deals, projects, invoices, leads });

});



router.get('/projects/:id', requireRoles('CLIENT'), async (req, res) => {

  const ctx = await clientContext(req);

  const project = await prisma.project.findFirst({

    where: projectAccessWhere(req.params.id, ctx),

    include: {

      assignee: userBrief,

      lead: {

        select: {

          fullName: true,

          city: true,

          objectType: true,

          systemType: true,

          capacityKw: true,

        },

      },

      deal: {

        select: {

          id: true,

          title: true,

          amount: true,

          status: true,

          capacityKw: true,

          city: true,

          address: true,

          objectType: true,

          systemType: true,

          kitItems: {

            select: { name: true, quantity: true, category: true },

            orderBy: { category: 'asc' },

          },

        },

      },

      materials: {

        include: { product: { select: { name: true, unit: true, sku: true } } },

      },

      invoices: {

        select: { id: true, number: true, amount: true, status: true, dueDate: true, paidAt: true },

        orderBy: { createdAt: 'desc' },

      },

    },

  });

  if (!project) return res.status(404).json({ error: 'Проект не найден' });

  res.json(project);

});



router.get('/deals/:id', requireRoles('CLIENT'), async (req, res) => {

  const { clientId } = await clientContext(req);

  const deal = await prisma.deal.findFirst({

    where: { id: req.params.id, clientId },

    include: {

      assignee: userBrief,

      kitItems: {

        select: { name: true, quantity: true, category: true, unitPrice: true },

        orderBy: { category: 'asc' },

      },

      project: {

        select: { id: true, projectNumber: true, title: true, phase: true },

      },

    },

  });

  if (!deal) return res.status(404).json({ error: 'Сделка не найдена' });

  res.json(deal);

});



router.get('/invoices/:id', requireRoles('CLIENT'), async (req, res) => {

  const { clientId } = await clientContext(req);

  const invoice = await prisma.invoice.findFirst({

    where: { id: req.params.id, clientId },

    include: {

      project: { select: { id: true, projectNumber: true, title: true, phase: true } },

    },

  });

  if (!invoice) return res.status(404).json({ error: 'Счёт не найден' });

  res.json(invoice);

});



router.get('/leads/:id', requireRoles('CLIENT'), async (req, res) => {

  const { phone: phoneNorm } = await clientContext(req);

  if (!phoneNorm) return res.status(404).json({ error: 'Заявка не найдена' });



  const full = await prisma.lead.findUnique({

    where: { id: req.params.id },

    select: {

      ...leadListSelect,

      phone: true,

      notes: true,

      proposalAmount: true,

      assignee: userBrief,

      project: { select: { id: true, projectNumber: true, title: true, phase: true } },

      deal: { select: { id: true, title: true, amount: true, status: true } },

    },

  });

  if (!full || normalizePhone(full.phone) !== phoneNorm) {

    return res.status(404).json({ error: 'Заявка не найдена' });

  }

  res.json(full);

});



export default router;

