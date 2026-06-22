import { Router } from 'express';

import { z } from 'zod';

import prisma from '../lib/prisma.js';

import { authRequired, attachUser, requirePermission, requireRoles } from '../lib/auth.js';

import { PERMISSIONS } from '../lib/permissions.js';

import { leadScope, dealScope, assertLeadAccess, assertDealAccess } from '../lib/access.js';

import { buildKit, kitAmount, applyKitDiscounts } from '../lib/kitCalculator.js';
import { loadProposalKit } from '../lib/loadProposalKit.js';
import {
  syncLeadProposal,
  regenerateLeadProposal,
  getLeadProposal,
  saveLeadProposalItems,
  proposalItemsForProject,
} from '../lib/leadProposal.js';
import { projectIdentityFields } from '../lib/projectIdentity.js';
import { syncProjectReservations } from '../lib/stockReservation.js';
import { isAdminUser, reassignLead } from '../lib/reassign.js';

import { isWhatsAppConfigured, sendLeadWhatsAppMessage } from '../lib/whatsappApi.js';



const router = Router();

router.use(authRequired, attachUser, requirePermission(PERMISSIONS.CRM_VIEW, PERMISSIONS.CRM_VIEW_ALL, PERMISSIONS.ADMIN_FULL));



const userSelect = { id: true, fullName: true, email: true, phone: true, company: true };



import {
  formatZodError,
  leadCreateSchema,
  leadPatchSchema,
  objectTypeEnum,
  systemTypeEnum,
} from '../lib/leadValidation.js';



async function getProductsWithStock() {

  return prisma.product.findMany({ include: { stock: true } });

}



async function saveDealKit(dealId, items, tx = prisma) {

  await tx.dealKitItem.deleteMany({ where: { dealId } });

  if (!items.length) return;

  await tx.dealKitItem.createMany({

    data: items.map((i) => ({

      dealId,

      productId: i.productId,

      category: i.category,

      name: i.name,

      quantity: i.quantity,

      unitPrice: i.unitPrice,

      discountPct: i.discountPct ?? 0,

      stockAvailable: i.stockAvailable ?? 0,

    })),

  });

}



const leadInclude = {
  deal: { include: { project: { select: { id: true, title: true, phase: true } } } },
  project: { select: { id: true, title: true, phase: true } },
  assignee: { select: userSelect },
  proposalItems: { include: { product: { include: { stock: true } } }, orderBy: { sortOrder: 'asc' } },
};

const projectInclude = {
  client: { select: userSelect },
  assignee: { select: userSelect },
  lead: { select: { id: true, fullName: true, phone: true } },
  materials: { include: { product: true } },
};

const dealInclude = {

  client: { select: userSelect },

  lead: true,

  assignee: { select: userSelect },

  project: { select: { id: true, phase: true, title: true } },

  kitItems: { include: { product: { include: { stock: true } } } },

};



function buildLeadUpdate(existing, data) {
  const update = { ...data };
  if (data.status === 'CONTACTED' && !existing.contactedAt) {
    update.contactedAt = new Date();
  }
  if (data.status === 'QUALIFIED' && existing.status !== 'QUALIFIED') {
    update.qualifiedAt = new Date();
    update.autoWhatsAppSentAt = null;
  }
  return update;
}



/* ── Лиды ── */



router.get('/leads', async (req, res) => {

  const leads = await prisma.lead.findMany({

    where: leadScope(req),

    include: leadInclude,

    orderBy: { createdAt: 'desc' },

  });

  res.json(leads);

});



router.post('/leads', requirePermission(PERMISSIONS.CRM_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  try {

    const data = leadCreateSchema.parse(req.body);

    const lead = await prisma.lead.create({

      data: {

        ...data,

        assigneeId: isAdminUser(req.user, req.permissions)
          ? (data.assigneeId || null)
          : req.user.id,

      },

      include: leadInclude,

    });

    if (lead.capacityKw) {
      await syncLeadProposal(prisma, lead, { force: true });
    }

    const full = await prisma.lead.findUnique({ where: { id: lead.id }, include: leadInclude });

    res.status(201).json(full ?? lead);

  } catch (e) {

    if (e.name === 'ZodError') return res.status(400).json(formatZodError(e));

    console.error(e);

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.patch('/leads/:id', requirePermission(PERMISSIONS.CRM_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  try {

    const access = await assertLeadAccess(req, prisma, req.params.id);

    if (access.error) return res.status(access.status).json({ error: access.error });

    const data = leadPatchSchema.parse(req.body);

    if (data.assigneeId !== undefined && !isAdminUser(req.user, req.permissions)) {
      delete data.assigneeId;
    }

    const existing = await prisma.lead.findUnique({ where: { id: req.params.id } });

    if (!existing) return res.status(404).json({ error: 'Не найден' });

    if (existing.status === 'CONVERTED') {
      return res.status(400).json({ error: 'Статус закрытого лида нельзя изменить' });
    }

    const sizingChanged =
      (data.systemType != null && data.systemType !== existing.systemType)
      || (data.capacityKw != null && data.capacityKw !== existing.capacityKw);

    const lead = await prisma.lead.update({

      where: { id: req.params.id },

      data: buildLeadUpdate(existing, data),

      include: leadInclude,

    });

    if (lead.capacityKw && sizingChanged && !existing.proposalCustomized) {
      await regenerateLeadProposal(prisma, lead);
    } else if (lead.capacityKw && sizingChanged && existing.proposalCustomized) {
      // мощность изменилась, но КП правили вручную — не трогаем автоматически
    } else if (lead.capacityKw && !lead.proposalItems?.length) {
      await syncLeadProposal(prisma, lead, { force: true });
    }

    const full = await prisma.lead.findUnique({ where: { id: lead.id }, include: leadInclude });

    res.json(full ?? lead);

  } catch (e) {

    if (e.code === 'P2025') return res.status(404).json({ error: 'Не найден' });

    if (e.name === 'ZodError') return res.status(400).json(formatZodError(e));

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.post('/leads/:id/claim', requireRoles('MANAGER'), async (req, res) => {

  try {

    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });

    if (!lead) return res.status(404).json({ error: 'Лид не найден' });

    if (lead.assigneeId && lead.assigneeId !== req.user.id) {

      return res.status(409).json({ error: 'Лид уже закреплён за другим менеджером' });

    }

    const updated = await prisma.lead.update({

      where: { id: lead.id },

      data: {
        assigneeId: req.user.id,
        status: lead.status === 'NEW' ? 'CONTACTED' : lead.status,
        ...(lead.status === 'NEW' && !lead.contactedAt ? { contactedAt: new Date() } : {}),
      },

      include: leadInclude,

    });

    res.json(updated);

  } catch (e) {

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.post('/leads/:id/reassign', requirePermission(PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const schema = z.object({ assigneeId: z.string().min(1) });

  try {

    const { assigneeId } = schema.parse(req.body);

    const lead = await reassignLead(req.params.id, assigneeId, req.user);

    const full = await prisma.lead.findUnique({ where: { id: lead.id }, include: leadInclude });

    res.json(full);

  } catch (e) {

    if (e.message === 'NOT_FOUND') return res.status(404).json({ error: e.message });

    if (e.message === 'INVALID_ASSIGNEE') return res.status(400).json({ error: e.message });

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Укажите менеджера' });

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.post('/leads/:id/contact', requirePermission(PERMISSIONS.CRM_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  try {

    const access = await assertLeadAccess(req, prisma, req.params.id);

    if (access.error) return res.status(access.status).json({ error: access.error });

    const lead = access.lead;

    const update = {};

    if (!lead.contactedAt) update.contactedAt = new Date();

    if (lead.status === 'NEW') update.status = 'CONTACTED';

    const updated = Object.keys(update).length

      ? await prisma.lead.update({

        where: { id: lead.id },

        data: update,

        include: leadInclude,

      })

      : await prisma.lead.findUnique({

        where: { id: lead.id },

        include: leadInclude,

      });

    res.json(updated);

  } catch (e) {

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.post('/leads/:id/whatsapp', requirePermission(PERMISSIONS.CRM_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  try {

    const access = await assertLeadAccess(req, prisma, req.params.id);

    if (access.error) return res.status(access.status).json({ error: access.error });

    if (!isWhatsAppConfigured()) {

      return res.status(503).json({ error: 'WhatsApp API не настроен', fallback: true });

    }

    const kind = req.body?.kind === 'followup' ? 'followup' : 'initial';

    const lead = await prisma.lead.findUnique({

      where: { id: req.params.id },

      include: leadInclude,

    });

    const managerName = lead.assignee?.fullName || req.user.fullName;

    const result = await sendLeadWhatsAppMessage(lead, { kind, managerName });

    if (!result.sent) {

      return res.status(502).json({

        error: result.error || result.reason || 'Не удалось отправить',

        code: result.code,

        fallback: true,

      });

    }

    const update = {};

    if (kind === 'initial') {

      if (!lead.contactedAt) update.contactedAt = new Date();

      if (lead.status === 'NEW') update.status = 'CONTACTED';

    }

    if (kind === 'followup') update.autoWhatsAppSentAt = new Date();

    const updated = Object.keys(update).length

      ? await prisma.lead.update({ where: { id: lead.id }, data: update, include: leadInclude })

      : lead;

    res.json({ ok: true, via: result.via, messageId: result.messageId, lead: updated });

  } catch (e) {

    console.error('whatsapp send error:', e);

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.post('/leads/:id/auto-whatsapp-sent', requirePermission(PERMISSIONS.CRM_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  try {

    const access = await assertLeadAccess(req, prisma, req.params.id);

    if (access.error) return res.status(access.status).json({ error: access.error });

    const lead = access.lead;

    if (lead.status !== 'QUALIFIED') {

      return res.status(400).json({ error: 'Авто WhatsApp только для статуса «Заинтересован»' });

    }

    const updated = await prisma.lead.update({

      where: { id: lead.id },

      data: { autoWhatsAppSentAt: new Date() },

      include: leadInclude,

    });

    res.json(updated);

  } catch (e) {

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



/* ── КП лида ── */

router.get('/leads/:id/proposal', async (req, res) => {
  try {
    const access = await assertLeadAccess(req, prisma, req.params.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const proposal = await getLeadProposal(prisma, req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Лид не найден' });
    res.json(proposal);
  } catch (e) {
    res.status(500).json({ error: 'Ошибка загрузки КП' });
  }
});

router.put('/leads/:id/proposal', requirePermission(PERMISSIONS.CRM_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const itemSchema = z.object({
    productId: z.string().optional().nullable(),
    category: z.enum(['PANEL', 'INVERTER', 'BATTERY', 'MOUNTING', 'COMMISSIONING', 'CABLE', 'OTHER']),
    name: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().min(0),
    discountPct: z.number().min(0).max(100).optional(),
    sortOrder: z.number().int().optional(),
  });
  const schema = z.object({ items: z.array(itemSchema).min(1) });
  try {
    const access = await assertLeadAccess(req, prisma, req.params.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.lead.status === 'CONVERTED') {
      return res.status(400).json({ error: 'КП закрытого лида нельзя изменить' });
    }
    const { items } = schema.parse(req.body);
    const saved = await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: req.params.id },
        data: { proposalCustomized: true },
      });
      return saveLeadProposalItems(tx, req.params.id, items);
    });
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        proposalAmount: true,
        proposalCustomized: true,
        proposalItems: { include: { product: { include: { stock: true } } }, orderBy: { sortOrder: 'asc' } },
      },
    });
    res.json({ ...lead, proposalItems: saved });
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные КП' });
    res.status(500).json({ error: 'Не удалось сохранить КП' });
  }
});

router.post('/leads/:id/proposal/recalc', requirePermission(PERMISSIONS.CRM_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  try {
    const access = await assertLeadAccess(req, prisma, req.params.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.lead.status === 'CONVERTED') {
      return res.status(400).json({ error: 'КП закрытого лида нельзя пересчитать' });
    }
    if (!access.lead.capacityKw) {
      return res.status(400).json({ error: 'Укажите мощность лида для расчёта КП' });
    }
    const result = await regenerateLeadProposal(prisma, access.lead);
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        proposalAmount: true,
        proposalCustomized: true,
        proposalItems: { include: { product: { include: { stock: true } } }, orderBy: { sortOrder: 'asc' } },
      },
    });
    res.json({ ...lead, meta: result.meta });
  } catch (e) {
    res.status(500).json({ error: 'Не удалось пересчитать КП' });
  }
});

router.post('/leads/:id/convert', async (req, res) => {

  try {

    const lead = await prisma.lead.findUnique({ where: { id: req.params.id }, include: leadInclude });

    if (!lead) return res.status(404).json({ error: 'Лид не найден' });

    if (lead.project || lead.deal?.project) {
      return res.status(409).json({ error: 'Проект уже создан' });
    }

    if (lead.deal) return res.status(409).json({ error: 'Лид уже конвертирован' });



    const schema = z.object({

      title: z.string().min(2).optional(),

      clientId: z.string().optional(),

      assigneeId: z.string().optional(),

      address: z.string().trim().min(3).optional(),

    });

    const body = schema.parse(req.body || {});

    const address = (body.address || lead.address || '').trim();

    if (address.length < 3) {

      return res.status(400).json({ error: 'Сначала укажите адрес на этапе «Замер»' });

    }

    let proposal = await getLeadProposal(prisma, lead.id);
    if (!proposal?.proposalItems?.length && lead.capacityKw) {
      await regenerateLeadProposal(prisma, lead);
      proposal = await getLeadProposal(prisma, lead.id);
    }
    const materialItems = proposalItemsForProject(proposal?.proposalItems || []);
    if (!materialItems.length) {
      const systemType = lead.systemType || 'ON_GRID';
      const capacityKw = lead.capacityKw || 5;
      const { items } = await loadProposalKit(prisma, systemType, capacityKw);
      materialItems.push(...items.filter((i) => i.productId));
    }



    const project = await prisma.$transaction(async (tx) => {

      const identity = await projectIdentityFields(tx, {
        lead,
        clientId: body.clientId,
        clientPhone: lead.phone,
      });

      const created = await tx.project.create({

        data: {

          title: body.title || `СЭС — ${lead.fullName}`,

          leadId: lead.id,

          ...identity,

          assigneeId: body.assigneeId || lead.assigneeId || req.user.id,

          capacityKw: lead.capacityKw,

          city: lead.city,

          address,

          notes: lead.notes,

          phase: 'DESIGN',

          startDate: new Date(),

        },

      });



      for (const item of materialItems) {

        if (!item.productId) continue;

        await tx.projectMaterial.create({

          data: {

            projectId: created.id,

            productId: item.productId,

            quantityPlanned: Math.ceil(item.quantity),

          },

        });

      }



      await syncProjectReservations(created.id, tx);

      await tx.lead.update({ where: { id: lead.id }, data: { status: 'CONVERTED' } });



      return tx.project.findUnique({ where: { id: created.id }, include: projectInclude });

    });



    res.status(201).json(project);

  } catch (e) {

    if (e.name === 'ZodError') {
      const msg = e.errors?.[0]?.message || 'Неверные данные';
      return res.status(400).json({ error: msg });
    }

    console.error('convert lead error:', e);

    res.status(500).json({ error: 'Не удалось создать проект из лида' });

  }

});



/* ── Комплектация ── */



router.get('/kit-preview', async (req, res) => {

  const schema = z.object({

    systemType: systemTypeEnum,

    capacityKw: z.coerce.number().positive(),

  });

  try {

    const { systemType, capacityKw } = schema.parse(req.query);

    const kit = await loadProposalKit(prisma, systemType, capacityKw);

    res.json(kit);

  } catch (e) {

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные параметры' });

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



/* ── Сделки ── */



router.get('/deals', async (req, res) => {

  const deals = await prisma.deal.findMany({

    where: dealScope(req),

    include: dealInclude,

    orderBy: { updatedAt: 'desc' },

  });

  res.json(deals);

});



router.get('/deals/:id', async (req, res) => {

  const access = await assertDealAccess(req, prisma, req.params.id);

  if (access.error) return res.status(access.status).json({ error: access.error });

  const deal = await prisma.deal.findUnique({ where: { id: req.params.id }, include: dealInclude });

  res.json(deal);

});



router.post('/deals', requirePermission(PERMISSIONS.CRM_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const schema = z.object({

    title: z.string().min(2),

    fullName: z.string().optional(),

    phone: z.string().optional(),

    city: z.string().optional().nullable(),

    objectType: objectTypeEnum.optional(),

    systemType: systemTypeEnum.optional(),

    capacityKw: z.number().positive().optional(),

    clientId: z.string().optional().nullable(),

    leadId: z.string().optional().nullable(),

    assigneeId: z.string().optional().nullable(),

    address: z.string().optional(),

    notes: z.string().optional().nullable(),

    kitDiscounts: z.record(z.number()).optional(),

  });

  try {

    const data = schema.parse(req.body);

    const systemType = data.systemType || 'ON_GRID';

    const capacityKw = data.capacityKw || 5;

    let { items } = await loadProposalKit(prisma, systemType, capacityKw);

    if (data.kitDiscounts) items = applyKitDiscounts(items, data.kitDiscounts);

    const amount = kitAmount(items);



    const deal = await prisma.deal.create({

      data: {

        title: data.title,

        fullName: data.fullName,

        phone: data.phone,

        city: data.city,

        objectType: data.objectType || 'OTHER',

        systemType,

        capacityKw,

        amount,

        address: data.address,

        notes: data.notes,

        clientId: data.clientId,

        leadId: data.leadId,

        assigneeId: data.assigneeId || req.user.id,

        status: 'NEW',

      },

      include: dealInclude,

    });

    await saveDealKit(deal.id, items);

    const full = await prisma.deal.findUnique({ where: { id: deal.id }, include: dealInclude });

    res.status(201).json(full);

  } catch (e) {

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.patch('/deals/:id', requirePermission(PERMISSIONS.CRM_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const schema = z.object({

    title: z.string().min(2).optional(),

    fullName: z.string().optional().nullable(),

    phone: z.string().optional().nullable(),

    amount: z.number().optional(),

    status: z.enum(['NEW', 'IN_PROGRESS', 'WON', 'LOST']).optional(),

    clientId: z.string().optional().nullable(),

    assigneeId: z.string().optional().nullable(),

    capacityKw: z.number().positive().optional().nullable(),

    city: z.string().optional().nullable(),

    objectType: objectTypeEnum.optional(),

    systemType: systemTypeEnum.optional(),

    address: z.string().optional().nullable(),

    notes: z.string().optional().nullable(),

    recalcKit: z.boolean().optional(),

    kitDiscounts: z.record(z.number()).optional(),

  });

  try {

    const data = schema.parse(req.body);

    const existing = await prisma.deal.findUnique({ where: { id: req.params.id } });

    if (!existing) return res.status(404).json({ error: 'Не найдена' });



    const updateData = { ...data };

    if (updateData.assigneeId !== undefined && !isAdminUser(req.user, req.permissions)) {
      delete updateData.assigneeId;
    }

    delete updateData.recalcKit;

    delete updateData.kitDiscounts;



    if (data.recalcKit || data.kitDiscounts) {

      const systemType = data.systemType || existing.systemType;

      const capacityKw = data.capacityKw ?? existing.capacityKw ?? 5;

      let { items } = await loadProposalKit(prisma, systemType, capacityKw);

      if (data.kitDiscounts) items = applyKitDiscounts(items, data.kitDiscounts);

      updateData.amount = kitAmount(items);

      await saveDealKit(existing.id, items);

    }



    const deal = await prisma.deal.update({

      where: { id: req.params.id },

      data: updateData,

      include: dealInclude,

    });

    res.json(deal);

  } catch (e) {

    if (e.code === 'P2025') return res.status(404).json({ error: 'Не найдена' });

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.patch('/deals/:id/status', async (req, res) => {

  const schema = z.object({ status: z.enum(['NEW', 'IN_PROGRESS', 'WON', 'LOST']) });

  try {

    const { status } = schema.parse(req.body);

    const deal = await prisma.deal.update({

      where: { id: req.params.id },

      data: { status },

      include: dealInclude,

    });

    res.json(deal);

  } catch (e) {

    if (e.code === 'P2025') return res.status(404).json({ error: 'Не найдена' });

    res.status(400).json({ error: 'Неверные данные' });

  }

});



/* ── Активности ── */



router.get('/activities', async (req, res) => {

  const { leadId, dealId, projectId } = req.query;

  const where = {};

  if (leadId) where.leadId = leadId;

  if (dealId) where.dealId = dealId;

  if (projectId) where.projectId = projectId;



  const activities = await prisma.activity.findMany({

    where,

    include: { author: { select: userSelect } },

    orderBy: [{ completed: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],

    take: 100,

  });

  res.json(activities);

});



router.post('/activities', async (req, res) => {

  const schema = z.object({

    type: z.enum(['CALL', 'MEETING', 'EMAIL', 'TASK', 'NOTE']).optional(),

    title: z.string().min(2),

    description: z.string().optional(),

    dueDate: z.string().datetime().optional().nullable(),

    leadId: z.string().optional().nullable(),

    dealId: z.string().optional().nullable(),

    projectId: z.string().optional().nullable(),

  });

  try {

    const data = schema.parse(req.body);

    const activity = await prisma.activity.create({

      data: {

        ...data,

        dueDate: data.dueDate ? new Date(data.dueDate) : null,

        authorId: req.user.id,

      },

      include: { author: { select: userSelect } },

    });

    res.status(201).json(activity);

  } catch (e) {

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.patch('/activities/:id', async (req, res) => {

  const schema = z.object({

    title: z.string().min(2).optional(),

    description: z.string().optional().nullable(),

    dueDate: z.string().datetime().optional().nullable(),

    completed: z.boolean().optional(),

    type: z.enum(['CALL', 'MEETING', 'EMAIL', 'TASK', 'NOTE']).optional(),

  });

  try {

    const data = schema.parse(req.body);

    const activity = await prisma.activity.update({

      where: { id: req.params.id },

      data: {

        ...data,

        dueDate: data.dueDate === null ? null : data.dueDate ? new Date(data.dueDate) : undefined,

      },

      include: { author: { select: userSelect } },

    });

    res.json(activity);

  } catch (e) {

    if (e.code === 'P2025') return res.status(404).json({ error: 'Не найдена' });

    res.status(400).json({ error: 'Неверные данные' });

  }

});



router.get('/summary', async (_req, res) => {

  const [leads, deals, activities] = await Promise.all([

    prisma.lead.groupBy({ by: ['status'], _count: true }),

    prisma.deal.groupBy({ by: ['status'], _count: true }),

    prisma.activity.count({ where: { completed: false } }),

  ]);

  res.json({ leads, deals, openActivities: activities });

});



export default router;


