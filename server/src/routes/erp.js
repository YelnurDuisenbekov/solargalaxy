import { Router } from 'express';

import { z } from 'zod';

import prisma from '../lib/prisma.js';

import { authRequired, attachUser, requirePermission } from '../lib/auth.js';

import { PERMISSIONS } from '../lib/permissions.js';

import { projectScope } from '../lib/access.js';

import { notifySupplyUsers, checkProjectStock } from '../lib/notifySupply.js';
import { saveProjectAttachment, readProjectAttachment } from '../lib/projectFiles.js';
import { projectAuctionBrief, projectAuctionResultBrief } from '../lib/projectAuction.js';
import { projectIdentityFields } from '../lib/projectIdentity.js';



const router = Router();

router.use(authRequired, attachUser);



const userSelect = { id: true, fullName: true, email: true, company: true };

const phaseEnum = z.enum(['SURVEY', 'DESIGN', 'BIDDING', 'PROCUREMENT', 'INSTALLATION', 'COMMISSIONING', 'COMPLETED', 'CANCELLED']);



const projectListInclude = {

  client: { select: userSelect },

  assignee: { select: userSelect },

  deal: { select: { id: true, title: true, amount: true, status: true, kitItems: true } },

  _count: { select: { materials: true, invoices: true, bids: true } },

};



router.get('/projects', requirePermission(PERMISSIONS.ERP_VIEW, PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.WAREHOUSE_VIEW, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const projects = await prisma.project.findMany({

    where: projectScope(req),

    include: projectListInclude,

    orderBy: { updatedAt: 'desc' },

  });

  res.json(projects);

});



router.get('/auctions', requirePermission(PERMISSIONS.ERP_VIEW, PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.WAREHOUSE_VIEW, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const status = req.query.status === 'closed' ? 'closed' : 'open';

  const where = {

    ...projectScope(req),

    auctionLaunched: true,

    ...(status === 'open' ? { auctionOpen: true } : { auctionOpen: false }),

  };

  const projects = await prisma.project.findMany({

    where,

    include: {

      assignee: { select: userSelect },

      lead: { select: { fullName: true, city: true, objectType: true, systemType: true, capacityKw: true } },

      bids: { include: { contractor: { select: userSelect } }, orderBy: { price: 'asc' } },

      winningBid: { include: { contractor: { select: userSelect } } },

      attachments: { orderBy: { createdAt: 'desc' } },

      _count: { select: { bids: true } },

    },

    orderBy: status === 'open' ? { auctionDeadline: 'asc' } : { updatedAt: 'desc' },

  });

  res.json(projects);

});

router.get('/auctions/results', requirePermission(PERMISSIONS.ERP_VIEW, PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.WAREHOUSE_VIEW, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const projects = await prisma.project.findMany({
    where: {
      ...projectScope(req),
      auctionLaunched: true,
      auctionOpen: false,
    },
    include: {
      lead: { select: { city: true, capacityKw: true } },
      winningBid: { include: { contractor: { select: userSelect } } },
      _count: { select: { bids: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(projects.map((p) => projectAuctionResultBrief(p)));
});

router.get('/projects/:id', requirePermission(PERMISSIONS.ERP_VIEW, PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.WAREHOUSE_VIEW, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const project = await prisma.project.findUnique({

    where: { id: req.params.id },

    include: {

      client: { select: userSelect },

      assignee: { select: userSelect },

      lead: { select: { id: true, fullName: true, phone: true, city: true, source: true, objectType: true, systemType: true, capacityKw: true, notes: true } },

      deal: { include: { kitItems: { include: { product: { include: { stock: true } } } } } },

      materials: { include: { product: { include: { stock: true } } } },

      invoices: true,

      bids: { include: { contractor: { select: userSelect } }, orderBy: { price: 'asc' } },

      winningBid: { include: { contractor: { select: userSelect } } },

      activities: { include: { author: { select: userSelect } }, orderBy: { createdAt: 'desc' } },

      stockMoves: { include: { product: true, author: { select: { fullName: true } } }, take: 20 },

      attachments: { orderBy: { createdAt: 'desc' } },

    },

  });

  if (!project) return res.status(404).json({ error: 'Не найден' });

  res.json(project);

});



router.post('/projects', requirePermission(PERMISSIONS.ERP_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const schema = z.object({

    title: z.string().min(2),

    dealId: z.string().optional().nullable(),

    clientId: z.string().optional().nullable(),

    assigneeId: z.string().optional().nullable(),

    phase: phaseEnum.optional(),

    capacityKw: z.number().optional(),

    city: z.string().optional(),

    address: z.string().optional(),

    notes: z.string().optional(),

    startDate: z.string().datetime().optional().nullable(),

  });

  try {

    const data = schema.parse(req.body);

    let clientUser = null;
    if (data.clientId) {
      clientUser = await prisma.user.findUnique({ where: { id: data.clientId }, select: { id: true, phone: true } });
    }

    const identity = await projectIdentityFields(prisma, {
      clientId: data.clientId,
      clientUser,
    });

    const project = await prisma.project.create({

      data: {

        ...data,

        ...identity,

        startDate: data.startDate ? new Date(data.startDate) : null,

      },

      include: { client: { select: userSelect }, assignee: { select: userSelect } },

    });

    res.status(201).json(project);

  } catch (e) {

    if (e.code === 'P2002') return res.status(409).json({ error: 'Проект для этой сделки уже существует' });

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.patch('/projects/:id', requirePermission(PERMISSIONS.ERP_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const schema = z.object({

    title: z.string().min(2).optional(),

    phase: phaseEnum.optional(),

    clientId: z.string().optional().nullable(),

    assigneeId: z.string().optional().nullable(),

    capacityKw: z.number().optional().nullable(),

    city: z.string().optional().nullable(),

    address: z.string().optional().nullable(),

    notes: z.string().optional().nullable(),

    startDate: z.string().datetime().optional().nullable(),

    endDate: z.string().datetime().optional().nullable(),

  });

  try {

    const data = schema.parse(req.body);

    const project = await prisma.project.update({

      where: { id: req.params.id },

      data: {

        ...data,

        startDate: data.startDate === null ? null : data.startDate ? new Date(data.startDate) : undefined,

        endDate: data.endDate === null ? null : data.endDate ? new Date(data.endDate) : undefined,

      },

      include: { client: { select: userSelect }, assignee: { select: userSelect } },

    });



    if (data.phase === 'PROCUREMENT' || data.phase === 'INSTALLATION') {

      await checkProjectStock(project.id);

    }



    res.json(project);

  } catch (e) {

    if (e.code === 'P2025') return res.status(404).json({ error: 'Не найден' });

    res.status(400).json({ error: 'Неверные данные' });

  }

});



router.post('/projects/from-deal/:dealId', requirePermission(PERMISSIONS.ERP_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  try {

    const deal = await prisma.deal.findUnique({

      where: { id: req.params.dealId },

      include: { project: true, kitItems: true, lead: { select: { phone: true } } },

    });

    if (!deal) return res.status(404).json({ error: 'Сделка не найдена' });

    if (deal.project) return res.status(409).json({ error: 'Проект уже создан' });

    if (!['WON', 'IN_PROGRESS'].includes(deal.status)) {

      return res.status(400).json({ error: 'Сделка должна быть в работе или выиграна' });

    }



    const project = await prisma.$transaction(async (tx) => {

      const identity = await projectIdentityFields(tx, {
        lead: deal.lead,
        deal,
        clientId: deal.clientId,
        clientPhone: deal.phone,
      });

      const created = await tx.project.create({

        data: {

          title: deal.title,

          dealId: deal.id,

          ...identity,

          assigneeId: deal.assigneeId,

          capacityKw: deal.capacityKw,

          city: deal.city,

          address: deal.address,

          phase: 'DESIGN',

          startDate: new Date(),

        },

      });



      for (const k of deal.kitItems) {

        if (!k.productId) continue;

        await tx.projectMaterial.upsert({

          where: { projectId_productId: { projectId: created.id, productId: k.productId } },

          create: { projectId: created.id, productId: k.productId, quantityPlanned: k.quantity },

          update: { quantityPlanned: k.quantity },

        });

      }



      return created;

    });



    const full = await prisma.project.findUnique({

      where: { id: project.id },

      include: { client: { select: userSelect }, deal: true, materials: { include: { product: true } } },

    });

    res.status(201).json(full);

  } catch (e) {

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.get('/projects/:id/auction-brief', requirePermission(PERMISSIONS.ERP_VIEW, PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.CRM_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      client: { select: { ...userSelect, phone: true } },
      assignee: { select: { ...userSelect, phone: true } },
      lead: { select: { id: true, fullName: true, phone: true, city: true, source: true, objectType: true, systemType: true, capacityKw: true, notes: true } },
      materials: { include: { product: true } },
      attachments: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!project) return res.status(404).json({ error: 'Не найден' });
  res.json(projectAuctionBrief(project));
});

router.get('/projects/:projectId/attachments/:attachmentId', requirePermission(PERMISSIONS.ERP_VIEW, PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  try {
    const att = await prisma.projectAttachment.findFirst({
      where: { id: req.params.attachmentId, projectId: req.params.projectId },
    });
    if (!att) return res.status(404).json({ error: 'Файл не найден' });
    const data = await readProjectAttachment(att.storagePath);
    res.setHeader('Content-Type', att.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(att.originalName)}"`);
    res.send(data);
  } catch (e) {
    res.status(404).json({ error: 'Файл недоступен' });
  }
});

router.post('/projects/:id/auction', requirePermission(PERMISSIONS.CRM_EDIT, PERMISSIONS.ERP_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const fileSchema = z.object({
    originalName: z.string().min(1),
    mimeType: z.string().optional(),
    data: z.string().min(1),
  });

  const schema = z.object({

    brief: z.string().optional(),

    deadline: z.string().datetime().optional(),

    days: z.number().int().positive().optional(),

    files: z.array(fileSchema).optional(),

  });

  try {

    const body = schema.parse(req.body || {});

    const project = await prisma.project.findUnique({ where: { id: req.params.id } });

    if (!project) return res.status(404).json({ error: 'Не найден' });

    if (project.auctionLaunched || project.auctionOpen || project.auctionDeadline) {
      return res.status(400).json({ error: 'Торги по этому проекту уже запускались' });
    }

    const deadline = body.deadline

      ? new Date(body.deadline)

      : new Date(Date.now() + (body.days || 7) * 86400000);



    const updated = await prisma.$transaction(async (tx) => {
      const savedAttachments = [];
      for (const file of body.files || []) {
        const meta = await saveProjectAttachment(project.id, file, req.user.id);
        const row = await tx.projectAttachment.create({
          data: { projectId: project.id, ...meta },
        });
        savedAttachments.push(row);
      }

      return tx.project.update({

        where: { id: req.params.id },

        data: {
          auctionOpen: true,
          auctionLaunched: true,
          auctionDeadline: deadline,
          auctionBrief: body.brief ?? project.auctionBrief,
        },

        include: {
          ...projectListInclude,
          attachments: { orderBy: { createdAt: 'desc' } },
          lead: { select: { id: true, fullName: true, phone: true, city: true, objectType: true, systemType: true, capacityKw: true, notes: true } },
          materials: { include: { product: true } },
        },

      });
    });

    res.json(updated);

  } catch (e) {

    if (e.code === 'P2025') return res.status(404).json({ error: 'Не найден' });

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });

    res.status(400).json({ error: e.message || 'Не удалось опубликовать торги' });

  }

});



router.post('/projects/:id/accept-lowest-bid', requirePermission(PERMISSIONS.CRM_EDIT, PERMISSIONS.ERP_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  try {

    const project = await prisma.project.findUnique({

      where: { id: req.params.id },

      include: { bids: { where: { status: 'PENDING' }, orderBy: { price: 'asc' } } },

    });

    if (!project) return res.status(404).json({ error: 'Не найден' });

    const winner = project.bids[0];

    if (!winner) return res.status(400).json({ error: 'Нет ставок' });



    const updated = await prisma.$transaction(async (tx) => {

      await tx.contractorBid.updateMany({

        where: { projectId: project.id, id: { not: winner.id } },

        data: { status: 'LOST' },

      });

      await tx.contractorBid.update({ where: { id: winner.id }, data: { status: 'WON' } });

      return tx.project.update({

        where: { id: project.id },

        data: {

          winningBidId: winner.id,

          auctionOpen: false,

          phase: 'INSTALLATION',

          notes: `${project.notes || ''}\nПодрядчик: ${winner.price} ₸`.trim(),

        },

        include: {

          winningBid: { include: { contractor: { select: userSelect } } },

          bids: { include: { contractor: { select: userSelect } } },

        },

      });

    });

    res.json(updated);

  } catch (e) {

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.post('/projects/:id/materials', requirePermission(PERMISSIONS.ERP_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const schema = z.object({

    productId: z.string(),

    quantityPlanned: z.number().int().positive(),

  });

  try {

    const data = schema.parse(req.body);

    const mat = await prisma.projectMaterial.upsert({

      where: { projectId_productId: { projectId: req.params.id, productId: data.productId } },

      create: { projectId: req.params.id, ...data },

      update: { quantityPlanned: data.quantityPlanned },

      include: { product: true },

    });

    res.status(201).json(mat);

  } catch (e) {

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.patch('/projects/:projectId/materials/:materialId', requirePermission(PERMISSIONS.ERP_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const schema = z.object({ quantityPlanned: z.number().int().positive() });

  try {

    const data = schema.parse(req.body);

    const existing = await prisma.projectMaterial.findFirst({

      where: { id: req.params.materialId, projectId: req.params.projectId },

    });

    if (!existing) return res.status(404).json({ error: 'Позиция не найдена' });

    if (data.quantityPlanned < existing.quantityIssued) {

      return res.status(400).json({ error: `Нельзя меньше выданного (${existing.quantityIssued} шт.)` });

    }

    const mat = await prisma.projectMaterial.update({

      where: { id: existing.id },

      data: { quantityPlanned: data.quantityPlanned },

      include: { product: { include: { stock: true } } },

    });

    res.json(mat);

  } catch (e) {

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.delete('/projects/:projectId/materials/:materialId', requirePermission(PERMISSIONS.ERP_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  try {

    const existing = await prisma.projectMaterial.findFirst({

      where: { id: req.params.materialId, projectId: req.params.projectId },

    });

    if (!existing) return res.status(404).json({ error: 'Позиция не найдена' });

    if (existing.quantityIssued > 0) {

      return res.status(400).json({ error: 'Нельзя удалить: материал уже выдан со склада' });

    }

    await prisma.projectMaterial.delete({ where: { id: existing.id } });

    res.json({ ok: true });

  } catch (e) {

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.post('/projects/:id/issue', requirePermission(PERMISSIONS.WAREHOUSE_ISSUE, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const schema = z.object({

    productId: z.string(),

    quantity: z.number().int().positive(),

    note: z.string().optional(),

  });

  try {

    const { productId, quantity, note } = schema.parse(req.body);

    const projectId = req.params.id;



    const [stock, mat, project] = await Promise.all([

      prisma.stockItem.findUnique({ where: { productId }, include: { product: true } }),

      prisma.projectMaterial.findUnique({ where: { projectId_productId: { projectId, productId } } }),

      prisma.project.findUnique({ where: { id: projectId } }),

    ]);



    if (!stock) return res.status(404).json({ error: 'Товар не на складе' });

    if (!project) return res.status(404).json({ error: 'Проект не найден' });



    if (stock.quantity < quantity) {

      await notifySupplyUsers({

        type: 'PURCHASE_REQUIRED',

        title: `Нехватка: ${stock.product.name}`,

        message: `Выдача по проекту «${project.title}»: запрошено ${quantity} шт., на складе ${stock.quantity} шт.`,

        projectId,

        productId,

      });

      return res.status(400).json({

        error: `Недостаточно на складе (${stock.quantity} шт.). Снабженец уведомлён.`,

      });

    }



    const result = await prisma.$transaction(async (tx) => {

      await tx.stockMovement.create({

        data: {

          productId,

          type: 'OUT',

          quantity,

          note: note || 'Выдача на проект',

          projectId,

          authorId: req.user.id,

        },

      });

      const newQty = stock.quantity - quantity;

      await tx.stockItem.update({

        where: { productId },

        data: { quantity: newQty },

      });

      if (mat) {

        await tx.projectMaterial.update({

          where: { id: mat.id },

          data: { quantityIssued: mat.quantityIssued + quantity },

        });

      }

      if (newQty <= stock.product.minStock) {

        await notifySupplyUsers({

          type: 'LOW_STOCK',

          title: `Низкий остаток: ${stock.product.name}`,

          message: `После выдачи осталось ${newQty} шт. (мин. ${stock.product.minStock}).`,

          projectId,

          productId,

        });

      }

      return tx.project.findUnique({

        where: { id: projectId },

        include: { materials: { include: { product: true } } },

      });

    });



    res.json(result);

  } catch (e) {

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.get('/summary', requirePermission(PERMISSIONS.ERP_VIEW, PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.WAREHOUSE_VIEW, PERMISSIONS.ADMIN_FULL), async (_req, res) => {

  const phases = await prisma.project.groupBy({ by: ['phase'], _count: true });

  const active = await prisma.project.count({

    where: { phase: { notIn: ['COMPLETED', 'CANCELLED'] } },

  });

  res.json({ phases, activeProjects: active });

});



export default router;


