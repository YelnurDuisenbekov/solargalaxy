import { Router } from 'express';

import { z } from 'zod';

import prisma from '../lib/prisma.js';

import { authRequired, attachUser, requirePermission } from '../lib/auth.js';

import { PERMISSIONS } from '../lib/permissions.js';

import { projectScope } from '../lib/access.js';

import { notifySupplyUsers, checkProjectStock } from '../lib/notifySupply.js';
import { notifyDirectors, notifyUser } from '../lib/notifyDirectors.js';
import {
  enrichProjectMaterial,
  kitTotal,
  materialLineSubtotal,
  materialLineTotal,
  projectMaterialsNeedApproval,
} from '../lib/projectMaterials.js';
import { saveProjectAttachment, readProjectAttachment } from '../lib/projectFiles.js';
import { projectAuctionBrief, projectAuctionResultBrief } from '../lib/projectAuction.js';
import { projectIdentityFields } from '../lib/projectIdentity.js';
import { syncProjectReservations, ensureReservationsSynced } from '../lib/stockReservation.js';
import { isAdminUser, reassignProject } from '../lib/reassign.js';
import {
  acceptMaterialTransferAct,
  actInclude,
  createMaterialTransferAct,
  writeOffProjectMaterials,
} from '../lib/materialTransferAct.js';



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



function isDirectorUser(user) {
  return user.role === 'DIRECTOR' || user.role === 'ADMIN';
}

function enrichProjectResponse(project) {
  if (!project) return project;
  const materials = (project.materials || []).map(enrichProjectMaterial);
  const globalDisc = project.kitGlobalDiscountPct ?? 0;
  return {
    ...project,
    materials: materials.map((m) => ({
      ...m,
      lineTotal: materialLineTotal(m, globalDisc),
    })),
    kitSubtotal: materials.reduce((s, m) => s + materialLineSubtotal(m), 0),
    kitTotal: kitTotal(materials, globalDisc),
    kitGlobalDiscountPct: globalDisc,
  };
}

async function syncMaterialsApproval(projectId, req) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      materials: { include: { product: true } },
      assignee: { select: { id: true, fullName: true } },
    },
  });
  if (!project) return null;

  const needsApproval = projectMaterialsNeedApproval(
    project.materials,
    project.kitGlobalDiscountPct ?? 0,
  );
  const director = isDirectorUser(req.user);

  if (needsApproval && !director) {
    const wasPending = project.materialsApprovalStatus === 'PENDING_DIRECTOR';
    await prisma.project.update({
      where: { id: projectId },
      data: { materialsApprovalStatus: 'PENDING_DIRECTOR', materialsApprovedAt: null },
    });
    if (!wasPending) {
      await notifyDirectors({
        type: 'MATERIALS_APPROVAL',
        title: `Согласование комплекта: ${project.title}`,
        message: needsApproval && (project.kitGlobalDiscountPct ?? 0) > 0
          ? `Проект ${project.projectNumber || project.title}: общая скидка ${project.kitGlobalDiscountPct}% превышает допустимую. Требуется согласование директора.`
          : `Проект ${project.projectNumber || project.title}: скидка превышает допустимую. Требуется согласование директора.`,
        projectId,
        fromUserId: req.user.id,
      });
    }
    return {
      status: 'PENDING_DIRECTOR',
      message: 'Проект направлен директору на согласование — скидка превышает допустимую.',
    };
  }

  if (!needsApproval && ['RETURNED', 'PENDING_DIRECTOR'].includes(project.materialsApprovalStatus) && !director) {
    await prisma.project.update({
      where: { id: projectId },
      data: { materialsApprovalStatus: 'NONE', materialsApprovalNote: null },
    });
    return { status: 'NONE' };
  }

  return { status: project.materialsApprovalStatus };
}



router.get('/projects', requirePermission(PERMISSIONS.ERP_VIEW, PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  await ensureReservationsSynced();

  const issuableOnly = req.query.issuable === '1';

  let projects = await prisma.project.findMany({

    where: projectScope(req),

    include: {
      ...projectListInclude,
      ...(issuableOnly
        ? { materials: { select: { quantityPlanned: true, quantityIssued: true } } }
        : {}),
    },

    orderBy: { updatedAt: 'desc' },

  });

  if (issuableOnly) {
    projects = projects.filter(
      (project) => !['COMPLETED', 'CANCELLED'].includes(project.phase)
        && project.materials.some((m) => m.quantityPlanned > m.quantityIssued),
    );
    projects = projects.map(({ materials, ...project }) => project);
  }

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

      lead: { select: { id: true, fullName: true, phone: true, email: true, city: true, address: true, source: true, objectType: true, systemType: true, capacityKw: true, notes: true, createdAt: true } },

      deal: { include: { lead: { select: { id: true, fullName: true, phone: true, email: true, city: true, address: true, source: true, objectType: true, systemType: true, capacityKw: true, notes: true, createdAt: true } }, kitItems: { include: { product: { include: { stock: true } } } } } },

      materials: { include: { product: { include: { stock: true } } } },

      invoices: true,

      bids: { include: { contractor: { select: userSelect } }, orderBy: { price: 'asc' } },

      winningBid: { include: { contractor: { select: userSelect } } },

      activities: { include: { author: { select: userSelect } }, orderBy: { createdAt: 'desc' } },

      stockMoves: { include: { product: true, author: { select: { fullName: true } } }, take: 20 },

      attachments: { orderBy: { createdAt: 'desc' } },

      transferActs: { include: actInclude, orderBy: { issuedAt: 'desc' } },

    },

  });

  if (!project) return res.status(404).json({ error: 'Не найден' });

  res.json(enrichProjectResponse(project));

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

    if (data.assigneeId !== undefined && !isAdminUser(req.user, req.permissions)) {
      delete data.assigneeId;
    }

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

    if (data.phase != null) {
      await syncProjectReservations(project.id);
    }



    res.json(project);

  } catch (e) {

    if (e.code === 'P2025') return res.status(404).json({ error: 'Не найден' });

    res.status(400).json({ error: 'Неверные данные' });

  }

});



router.post('/projects/:id/reassign', requirePermission(PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const schema = z.object({ assigneeId: z.string().min(1) });

  try {

    const { assigneeId } = schema.parse(req.body);

    const project = await reassignProject(req.params.id, assigneeId, req.user);

    res.json(project);

  } catch (e) {

    if (e.message === 'NOT_FOUND') return res.status(404).json({ error: e.message });

    if (e.message === 'INVALID_ASSIGNEE') return res.status(400).json({ error: e.message });

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Укажите менеджера' });

    res.status(500).json({ error: 'Ошибка сервера' });

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



      await syncProjectReservations(created.id, tx);

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

    if (project.auctionOpen) {
      return res.status(400).json({ error: 'Торги уже открыты' });
    }
    if (project.winningBidId) {
      return res.status(400).json({ error: 'Подрядчик уже выбран' });
    }

    const deadline = body.deadline

      ? new Date(body.deadline)

      : new Date(Date.now() + (body.days || 7) * 86400000);



    const updated = await prisma.$transaction(async (tx) => {
      await tx.contractorBid.updateMany({
        where: { projectId: project.id, status: 'PENDING' },
        data: { status: 'LOST' },
      });

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



router.post('/projects/:id/accept-bid', requirePermission(PERMISSIONS.CRM_EDIT, PERMISSIONS.ERP_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  try {

    const { bidId } = z.object({ bidId: z.string().min(1) }).parse(req.body);

    const project = await prisma.project.findUnique({ where: { id: req.params.id } });

    if (!project) return res.status(404).json({ error: 'Не найден' });

    if (!project.auctionOpen) return res.status(400).json({ error: 'Торги закрыты' });

    const winner = await prisma.contractorBid.findFirst({

      where: { id: bidId, projectId: project.id, status: 'PENDING' },

      include: { contractor: { select: userSelect } },

    });

    if (!winner) return res.status(400).json({ error: 'Ставка не найдена' });



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

          notes: `${project.notes || ''}\nПодрядчик: ${winner.contractor?.fullName || winner.contractor?.company || '—'} — ${winner.price} ₸`.trim(),

        },

        include: {

          winningBid: { include: { contractor: { select: userSelect } } },

          bids: { include: { contractor: { select: userSelect } } },

        },

      });

    });

    res.json(updated);

  } catch (e) {

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.post('/projects/:id/close-auction', requirePermission(PERMISSIONS.CRM_EDIT, PERMISSIONS.ERP_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  try {

    const project = await prisma.project.findUnique({ where: { id: req.params.id } });

    if (!project) return res.status(404).json({ error: 'Не найден' });

    if (!project.auctionOpen) return res.status(400).json({ error: 'Торги не открыты' });

    if (project.winningBidId) return res.status(400).json({ error: 'Подрядчик уже выбран' });



    const updated = await prisma.$transaction(async (tx) => {

      await tx.contractorBid.updateMany({

        where: { projectId: project.id, status: 'PENDING' },

        data: { status: 'LOST' },

      });

      return tx.project.update({

        where: { id: project.id },

        data: { auctionOpen: false },

        include: {

          winningBid: { include: { contractor: { select: userSelect } } },

          bids: { include: { contractor: { select: userSelect } }, orderBy: { price: 'asc' } },

          _count: { select: { bids: true } },

        },

      });

    });

    res.json(updated);

  } catch (e) {

    res.status(500).json({ error: 'Ошибка сервера' });

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

    unitPrice: z.number().min(0).optional(),

    purchasePrice: z.number().min(0).optional().nullable(),

    discountPct: z.number().min(0).max(100).optional(),

  });

  try {

    const data = schema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id: data.productId } });

    if (!product) return res.status(404).json({ error: 'Товар не найден' });

    const mat = await prisma.projectMaterial.upsert({

      where: { projectId_productId: { projectId: req.params.id, productId: data.productId } },

      create: {
        projectId: req.params.id,
        productId: data.productId,
        quantityPlanned: data.quantityPlanned,
        unitPrice: data.unitPrice ?? product.price,
        purchasePrice: data.purchasePrice ?? product.purchasePrice ?? 0,
        discountPct: data.discountPct ?? 0,
      },

      update: {
        quantityPlanned: data.quantityPlanned,
        ...(data.unitPrice != null ? { unitPrice: data.unitPrice } : {}),
        ...(data.purchasePrice != null ? { purchasePrice: data.purchasePrice } : {}),
        ...(data.discountPct != null ? { discountPct: data.discountPct } : {}),
      },

      include: { product: { include: { stock: true } } },

    });

    await syncProjectReservations(req.params.id);

    const approval = await syncMaterialsApproval(req.params.id, req);

    res.status(201).json({
      ...enrichProjectMaterial(mat),
      approval,
    });

  } catch (e) {

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.patch('/projects/:projectId/materials/:materialId', requirePermission(PERMISSIONS.ERP_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const schema = z.object({
    quantityPlanned: z.number().int().positive().optional(),
    productId: z.string().optional(),
    unitPrice: z.number().min(0).optional(),
    purchasePrice: z.number().min(0).optional().nullable(),
    discountPct: z.number().min(0).max(100).optional(),
  });

  try {

    const data = schema.parse(req.body);

    if (!Object.keys(data).length) return res.status(400).json({ error: 'Нет данных для обновления' });

    const existing = await prisma.projectMaterial.findFirst({

      where: { id: req.params.materialId, projectId: req.params.projectId },

      include: { product: true },

    });

    if (!existing) return res.status(404).json({ error: 'Позиция не найдена' });

    if (data.quantityPlanned != null && data.quantityPlanned < existing.quantityIssued) {

      return res.status(400).json({ error: `Нельзя меньше выданного (${existing.quantityIssued} шт.)` });

    }

    const updateData = {};

    if (data.quantityPlanned != null) updateData.quantityPlanned = data.quantityPlanned;

    if (data.unitPrice != null) updateData.unitPrice = data.unitPrice;

    if (data.purchasePrice != null) updateData.purchasePrice = data.purchasePrice;

    if (data.discountPct != null) updateData.discountPct = data.discountPct;

    if (data.productId && data.productId !== existing.productId) {

      if (existing.quantityIssued > 0) {

        return res.status(400).json({ error: 'Нельзя сменить товар после выдачи со склада' });

      }

      const clash = await prisma.projectMaterial.findUnique({

        where: { projectId_productId: { projectId: req.params.projectId, productId: data.productId } },

      });

      if (clash) return res.status(400).json({ error: 'Этот товар уже в комплекте' });

      const product = await prisma.product.findUnique({ where: { id: data.productId } });

      if (!product) return res.status(404).json({ error: 'Товар не найден' });

      updateData.productId = data.productId;

      if (data.unitPrice == null) updateData.unitPrice = product.price;

    }

    const mat = await prisma.projectMaterial.update({

      where: { id: existing.id },

      data: updateData,

      include: { product: { include: { stock: true } } },

    });

    await syncProjectReservations(req.params.projectId);

    const approval = await syncMaterialsApproval(req.params.projectId, req);

    res.json({
      ...enrichProjectMaterial(mat),
      approval,
    });

  } catch (e) {

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.put('/projects/:id/materials/bulk', requirePermission(PERMISSIONS.ERP_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const itemSchema = z.object({
    id: z.string().optional(),
    productId: z.string(),
    quantityPlanned: z.number().int().positive(),
    unitPrice: z.number().min(0),
    purchasePrice: z.number().min(0).optional().nullable(),
    discountPct: z.number().min(0).max(100),
  });

  const schema = z.object({
    kitGlobalDiscountPct: z.number().min(0).max(100),
    materials: z.array(itemSchema),
    deletedIds: z.array(z.string()).default([]),
  });

  try {

    const { kitGlobalDiscountPct, materials, deletedIds } = schema.parse(req.body);

    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: { materials: true },
    });

    if (!project) return res.status(404).json({ error: 'Не найден' });

    const existingById = new Map(project.materials.map((m) => [m.id, m]));

    for (const id of deletedIds) {
      const row = existingById.get(id);
      if (!row) continue;
      if (row.quantityIssued > 0) {
        return res.status(400).json({ error: `Нельзя удалить позицию с выданным количеством (${row.quantityIssued} шт.)` });
      }
    }

    const lineDiscounts = kitGlobalDiscountPct > 0
      ? materials.map((m) => ({ ...m, discountPct: 0 }))
      : materials;

    for (const item of lineDiscounts) {
      if (item.id) {
        const row = existingById.get(item.id);
        if (!row) continue;
        if (item.quantityPlanned < row.quantityIssued) {
          return res.status(400).json({ error: `План не может быть меньше выданного (${row.quantityIssued} шт.)` });
        }
        if (item.productId !== row.productId && row.quantityIssued > 0) {
          return res.status(400).json({ error: 'Нельзя сменить товар после выдачи со склада' });
        }
      }
    }

    const productIds = lineDiscounts.map((m) => m.productId);
    if (new Set(productIds).size !== productIds.length) {
      return res.status(400).json({ error: 'Один товар указан несколько раз' });
    }

    await prisma.$transaction(async (tx) => {
      if (deletedIds.length) {
        await tx.projectMaterial.deleteMany({
          where: { projectId: project.id, id: { in: deletedIds }, quantityIssued: 0 },
        });
      }

      await tx.project.update({
        where: { id: project.id },
        data: { kitGlobalDiscountPct },
      });

      for (const item of lineDiscounts) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new Error('PRODUCT_NOT_FOUND');

        if (item.id && existingById.has(item.id)) {
          await tx.projectMaterial.update({
            where: { id: item.id },
            data: {
              productId: item.productId,
              quantityPlanned: item.quantityPlanned,
              unitPrice: item.unitPrice,
              purchasePrice: item.purchasePrice ?? product.purchasePrice ?? 0,
              discountPct: item.discountPct,
            },
          });
        } else {
          await tx.projectMaterial.create({
            data: {
              projectId: project.id,
              productId: item.productId,
              quantityPlanned: item.quantityPlanned,
              unitPrice: item.unitPrice,
              purchasePrice: item.purchasePrice ?? product.purchasePrice ?? 0,
              discountPct: item.discountPct,
            },
          });
        }
      }
    });

    const updated = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        client: { select: userSelect },
        assignee: { select: userSelect },
        materials: { include: { product: { include: { stock: true } } } },
      },
    });

    await syncProjectReservations(project.id);

    const approval = await syncMaterialsApproval(project.id, req);

    res.json({
      ...enrichProjectResponse(updated),
      approval,
    });

  } catch (e) {

    if (e.message === 'PRODUCT_NOT_FOUND') return res.status(404).json({ error: 'Товар не найден' });

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.post('/projects/:id/materials/approve', requirePermission(PERMISSIONS.ERP_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  try {

    if (!isDirectorUser(req.user)) {

      return res.status(403).json({ error: 'Согласование доступно директору' });

    }

    const project = await prisma.project.findUnique({

      where: { id: req.params.id },

      include: { materials: { include: { product: true } }, assignee: { select: { id: true } } },

    });

    if (!project) return res.status(404).json({ error: 'Не найден' });

    const updated = await prisma.project.update({

      where: { id: project.id },

      data: {
        materialsApprovalStatus: 'APPROVED',
        materialsApprovalNote: null,
        materialsApprovedAt: new Date(),
      },

      include: {
        client: { select: userSelect },
        assignee: { select: userSelect },
        materials: { include: { product: { include: { stock: true } } } },
      },

    });

    await notifyUser({
      userId: project.assigneeId,
      fromUserId: req.user.id,
      type: 'PROJECT_UPDATE',
      title: `Комплект согласован: ${project.title}`,
      message: `Директор согласовал комплект материалов по проекту ${project.projectNumber || project.title}.`,
      projectId: project.id,
    });

    res.json(enrichProjectResponse(updated));

  } catch (e) {

    res.status(500).json({ error: 'Ошибка сервера' });

  }

});



router.post('/projects/:id/materials/return-to-manager', requirePermission(PERMISSIONS.ERP_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {

  const schema = z.object({ note: z.string().min(1).max(2000) });

  try {

    if (!isDirectorUser(req.user)) {

      return res.status(403).json({ error: 'Доступно директору' });

    }

    const { note } = schema.parse(req.body);

    const project = await prisma.project.findUnique({

      where: { id: req.params.id },

      include: { assignee: { select: { id: true } } },

    });

    if (!project) return res.status(404).json({ error: 'Не найден' });

    const updated = await prisma.project.update({

      where: { id: project.id },

      data: {
        materialsApprovalStatus: 'RETURNED',
        materialsApprovalNote: note,
        materialsApprovedAt: null,
      },

      include: {
        client: { select: userSelect },
        assignee: { select: userSelect },
        materials: { include: { product: { include: { stock: true } } } },
      },

    });

    await notifyUser({
      userId: project.assigneeId,
      fromUserId: req.user.id,
      type: 'PROJECT_UPDATE',
      title: `Комплект возвращён: ${project.title}`,
      message: note,
      projectId: project.id,
    });

    res.json(enrichProjectResponse(updated));

  } catch (e) {

    if (e.name === 'ZodError') return res.status(400).json({ error: 'Укажите комментарий' });

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

    await syncProjectReservations(req.params.projectId);

    const approval = await syncMaterialsApproval(req.params.projectId, req);

    res.json({ ok: true, approval });

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

      await syncProjectReservations(projectId, tx);

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



router.post('/projects/:id/transfer-acts', requirePermission(PERMISSIONS.WAREHOUSE_ISSUE, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const schema = z.object({
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
    })).min(1),
    note: z.string().max(500).optional(),
  });

  try {
    const { items, note } = schema.parse(req.body);
    const act = await createMaterialTransferAct({
      projectId: req.params.id,
      items,
      note,
      issuer: req.user,
    });
    res.status(201).json(act);
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Укажите материалы для выдачи' });
    if (e.message === 'PROJECT_NOT_FOUND') return res.status(404).json({ error: 'Проект не найден' });
    if (e.message === 'NOT_IN_KIT') return res.status(400).json({ error: 'Товар не входит в комплект проекта' });
    if (e.message === 'EXCEEDS_PLAN') return res.status(400).json({ error: 'Количество превышает план комплекта' });
    if (e.message === 'INSUFFICIENT_STOCK') return res.status(400).json({ error: 'Недостаточно на складе' });
    if (e.message === 'DUPLICATE_PRODUCT') return res.status(400).json({ error: 'Один товар указан несколько раз' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/projects/:id/transfer-acts', requirePermission(PERMISSIONS.ERP_VIEW, PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.WAREHOUSE_VIEW, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const acts = await prisma.materialTransferAct.findMany({
    where: { projectId: req.params.id },
    include: actInclude,
    orderBy: { issuedAt: 'desc' },
  });
  res.json(acts);
});

router.post('/transfer-acts/:id/accept', requirePermission(PERMISSIONS.ERP_EDIT, PERMISSIONS.ERP_VIEW, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  try {
    const act = await acceptMaterialTransferAct(req.params.id, req.user);
    res.json(act);
  } catch (e) {
    if (e.message === 'NOT_FOUND') return res.status(404).json({ error: 'Акт не найден' });
    if (e.message === 'ALREADY_PROCESSED') return res.status(400).json({ error: 'Акт уже обработан' });
    if (e.message === 'FORBIDDEN') return res.status(403).json({ error: 'Принять акт может только назначенный менеджер проекта' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/projects/:id/materials/write-off', requirePermission(PERMISSIONS.ERP_EDIT, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const schema = z.object({ note: z.string().max(2000).optional() });
  try {
    const { note } = schema.parse(req.body || {});
    const batch = await writeOffProjectMaterials(req.params.id, req.user, note);
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        client: { select: userSelect },
        assignee: { select: userSelect },
        materials: { include: { product: { include: { stock: true } } } },
        transferActs: { include: actInclude, orderBy: { issuedAt: 'desc' } },
      },
    });
    res.json({
      ok: true,
      batch,
      message: 'Запрос на списание направлен директору на согласование.',
      project: enrichProjectResponse(project),
    });
  } catch (e) {
    if (e.message === 'PROJECT_NOT_FOUND') return res.status(404).json({ error: 'Проект не найден' });
    if (e.message === 'PROJECT_NOT_FINISHED') return res.status(400).json({ error: 'Списание доступно на этапе «Пусконаладка» или «Завершён»' });
    if (e.message === 'FORBIDDEN') return res.status(403).json({ error: 'Списать материалы может менеджер проекта' });
    if (e.message === 'NOTHING_TO_WRITE_OFF') return res.status(400).json({ error: 'Нет принятых материалов для списания' });
    if (e.message === 'REQUEST_PENDING') return res.status(409).json({ error: 'Уже есть активный запрос на списание по этому проекту' });
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


