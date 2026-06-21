import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authRequired, attachUser, requirePermission, requireRoles } from '../lib/auth.js';
import { PERMISSIONS, hasAnyPermission } from '../lib/permissions.js';
import { projectAuctionBrief, projectAuctionResultBrief } from '../lib/projectAuction.js';
import { readProjectAttachment } from '../lib/projectFiles.js';
import { CONTRACTOR_ROLES } from '../lib/roles.js';

const router = Router();
router.use(authRequired, attachUser);

const userSelect = { id: true, fullName: true, email: true, company: true };

const SUPPLY_STAFF = [
  PERMISSIONS.SUPPLY_VIEW,
  PERMISSIONS.ADMIN_FULL,
  PERMISSIONS.CRM_VIEW,
  PERMISSIONS.CRM_VIEW_ALL,
  PERMISSIONS.ERP_VIEW,
  PERMISSIONS.ERP_VIEW_ALL,
  PERMISSIONS.WAREHOUSE_VIEW,
];

function canViewAllSupplyNotifications(permissions) {
  return hasAnyPermission(
    permissions,
    PERMISSIONS.ADMIN_FULL,
    PERMISSIONS.CRM_VIEW_ALL,
    PERMISSIONS.ERP_VIEW_ALL,
  );
}

function supplyNotificationsWhere(req) {
  if (canViewAllSupplyNotifications(req.permissions)) {
    return { type: { in: ['PURCHASE_REQUIRED', 'LOW_STOCK', 'PROJECT_UPDATE'] } };
  }
  return { userId: req.user.id };
}

router.get('/notifications', requirePermission(...SUPPLY_STAFF), async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: supplyNotificationsWhere(req),
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(notifications);
});

router.patch('/notifications/:id/read', requirePermission(...SUPPLY_STAFF), async (req, res) => {
  try {
    const where = canViewAllSupplyNotifications(req.permissions)
      ? { id: req.params.id }
      : { id: req.params.id, userId: req.user.id };
    const n = await prisma.notification.update({
      where,
      data: { read: true },
    });
    res.json(n);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Не найдено' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/notifications/read-all', requirePermission(...SUPPLY_STAFF), async (req, res) => {
  const where = {
    ...supplyNotificationsWhere(req),
    read: false,
  };
  await prisma.notification.updateMany({
    where,
    data: { read: true },
  });
  res.json({ ok: true });
});

router.get('/notifications/unread-count', requirePermission(...SUPPLY_STAFF), async (req, res) => {
  const count = await prisma.notification.count({
    where: { ...supplyNotificationsWhere(req), read: false },
  });
  res.json({ count });
});

router.get('/auctions', async (req, res) => {
  const isContractor = CONTRACTOR_ROLES.includes(req.user.role);
  if (!isContractor && !hasAnyPermission(req.permissions, PERMISSIONS.ERP_VIEW, PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.ADMIN_FULL)) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  const projects = await prisma.project.findMany({
    where: { auctionOpen: true },
    include: {
      client: { select: { fullName: true, company: true, phone: true } },
      assignee: { select: { fullName: true, phone: true } },
      lead: { select: { fullName: true, phone: true, city: true, objectType: true, systemType: true, capacityKw: true, notes: true } },
      materials: { include: { product: { select: { name: true, sku: true, unit: true } } } },
      attachments: { orderBy: { createdAt: 'desc' } },
      bids: isContractor
        ? { where: { contractorId: req.user.id }, orderBy: { createdAt: 'desc' } }
        : {
          where: { status: 'PENDING' },
          select: { price: true, contractorId: true },
          orderBy: { price: 'asc' },
        },
      _count: { select: { bids: true } },
    },
    orderBy: { auctionDeadline: 'asc' },
  });
  res.json(projects.map((p) => projectAuctionBrief(p, { includeBids: !isContractor })));
});

router.get('/auctions/history', async (req, res) => {
  const isContractor = CONTRACTOR_ROLES.includes(req.user.role);
  if (!isContractor && !hasAnyPermission(req.permissions, PERMISSIONS.ERP_VIEW, PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.ADMIN_FULL)) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  const projects = await prisma.project.findMany({
    where: { auctionLaunched: true, auctionOpen: false },
    include: {
      lead: { select: { city: true, capacityKw: true } },
      winningBid: { include: { contractor: { select: { fullName: true, company: true } } } },
      ...(isContractor
        ? { bids: { where: { contractorId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 1 } }
        : {}),
      _count: { select: { bids: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(projects.map((p) => projectAuctionResultBrief(p)));
});

router.get('/auctions/:projectId/attachments/:attachmentId', async (req, res) => {
  const isContractor = CONTRACTOR_ROLES.includes(req.user.role);
  if (!isContractor && !hasAnyPermission(req.permissions, PERMISSIONS.ERP_VIEW, PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.ADMIN_FULL)) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.projectId, auctionOpen: true },
    });
    if (!project) return res.status(404).json({ error: 'Торги не найдены' });
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

router.get('/my-bids', requireRoles(...CONTRACTOR_ROLES), async (req, res) => {
  const bids = await prisma.contractorBid.findMany({
    where: { contractorId: req.user.id },
    include: {
      project: { select: { id: true, title: true, city: true, phase: true, auctionOpen: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(bids);
});

router.post('/bids', requireRoles(...CONTRACTOR_ROLES), async (req, res) => {
  const schema = z.object({
    projectId: z.string(),
    price: z.number().positive(),
    note: z.string().optional(),
  });
  try {
    const data = schema.parse(req.body);
    const project = await prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project?.auctionOpen) return res.status(400).json({ error: 'Торги по проекту закрыты' });
    if (project.auctionDeadline && new Date() > project.auctionDeadline) {
      return res.status(400).json({ error: 'Срок подачи ставок истёк' });
    }

    const bid = await prisma.contractorBid.upsert({
      where: { projectId_contractorId: { projectId: data.projectId, contractorId: req.user.id } },
      create: {
        projectId: data.projectId,
        contractorId: req.user.id,
        price: data.price,
        note: data.note,
      },
      update: { price: data.price, note: data.note, status: 'PENDING' },
      include: { project: { select: { title: true } } },
    });
    res.status(201).json(bid);
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/auctions/:projectId/bids', requirePermission(PERMISSIONS.CRM_VIEW_ALL, PERMISSIONS.ERP_VIEW_ALL, PERMISSIONS.ADMIN_FULL), async (req, res) => {
  const bids = await prisma.contractorBid.findMany({
    where: { projectId: req.params.projectId },
    include: { contractor: { select: userSelect } },
    orderBy: { price: 'asc' },
  });
  res.json(bids);
});

export default router;
