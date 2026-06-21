import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authRequired, attachUser, requirePermission } from '../lib/auth.js';
import { PERMISSIONS } from '../lib/permissions.js';
import { systemTypeEnum } from '../lib/leadValidation.js';
import { buildProposalKit } from '../lib/proposalCalculator.js';
import { ensureDefaultProposalTemplates } from '../lib/defaultProposalTemplates.js';

const router = Router();
router.use(authRequired, attachUser);

const viewPerms = [PERMISSIONS.CRM_VIEW, PERMISSIONS.CRM_VIEW_ALL, PERMISSIONS.ADMIN_FULL];
const editPerms = [PERMISSIONS.CRM_EDIT, PERMISSIONS.ADMIN_FULL];

const allocationEnum = z.enum(['PER_PANEL', 'PER_KW', 'PER_PROJECT', 'PERCENT_EQUIPMENT']);
const kitCategoryEnum = z.enum(['PANEL', 'INVERTER', 'BATTERY', 'MOUNTING', 'COMMISSIONING', 'CABLE', 'OTHER']);

const lineInclude = { product: { include: { stock: true } } };

async function getProductsWithStock() {
  return prisma.product.findMany({ include: { stock: true }, orderBy: { name: 'asc' } });
}

async function getTemplates(systemType) {
  const where = systemType ? { systemType } : {};
  return prisma.proposalCostLine.findMany({
    where,
    include: lineInclude,
    orderBy: [{ systemType: 'asc' }, { sortOrder: 'asc' }],
  });
}

router.get('/templates', requirePermission(...viewPerms), async (req, res) => {
  try {
    const systemType = req.query.systemType;
    if (systemType) systemTypeEnum.parse(systemType);

    let templates = await getTemplates(systemType);
    if (templates.length === 0) {
      const products = await getProductsWithStock();
      const bySku = Object.fromEntries(products.map((p) => [p.sku, p]));
      await ensureDefaultProposalTemplates(prisma, bySku);
      templates = await getTemplates(systemType);
    }
    res.json(templates);
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверный тип системы' });
    res.status(500).json({ error: 'Ошибка загрузки шаблонов' });
  }
});

router.post('/templates', requirePermission(...editPerms), async (req, res) => {
  const schema = z.object({
    systemType: systemTypeEnum,
    category: kitCategoryEnum,
    allocation: allocationEnum.default('PER_PROJECT'),
    productId: z.string().optional().nullable(),
    qtyMultiplier: z.number().positive().default(1),
    unitPriceOverride: z.number().min(0).optional().nullable(),
    label: z.string().optional().nullable(),
    sortOrder: z.number().int().optional(),
    enabled: z.boolean().optional(),
  });
  try {
    const data = schema.parse(req.body);
    const maxOrder = await prisma.proposalCostLine.aggregate({
      where: { systemType: data.systemType },
      _max: { sortOrder: true },
    });
    const line = await prisma.proposalCostLine.create({
      data: {
        ...data,
        productId: data.productId || null,
        unitPriceOverride: data.unitPriceOverride ?? null,
        label: data.label || null,
        sortOrder: data.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 10,
        enabled: data.enabled ?? true,
      },
      include: lineInclude,
    });
    res.status(201).json(line);
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Не удалось создать строку' });
  }
});

router.patch('/templates/:id', requirePermission(...editPerms), async (req, res) => {
  const schema = z.object({
    category: kitCategoryEnum.optional(),
    allocation: allocationEnum.optional(),
    productId: z.string().optional().nullable(),
    qtyMultiplier: z.number().positive().optional(),
    unitPriceOverride: z.number().min(0).optional().nullable(),
    label: z.string().optional().nullable(),
    sortOrder: z.number().int().optional(),
    enabled: z.boolean().optional(),
  });
  try {
    const data = schema.parse(req.body);
    const line = await prisma.proposalCostLine.update({
      where: { id: req.params.id },
      data: {
        ...data,
        productId: data.productId === undefined ? undefined : (data.productId || null),
        unitPriceOverride: data.unitPriceOverride === undefined ? undefined : data.unitPriceOverride,
      },
      include: lineInclude,
    });
    res.json(line);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Строка не найдена' });
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные данные' });
    res.status(500).json({ error: 'Не удалось обновить строку' });
  }
});

router.delete('/templates/:id', requirePermission(...editPerms), async (req, res) => {
  try {
    await prisma.proposalCostLine.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Строка не найдена' });
    res.status(500).json({ error: 'Не удалось удалить строку' });
  }
});

router.get('/preview', requirePermission(...viewPerms), async (req, res) => {
  const schema = z.object({
    systemType: systemTypeEnum,
    capacityKw: z.coerce.number().positive(),
  });
  try {
    const { systemType, capacityKw } = schema.parse(req.query);
    const [products, templates] = await Promise.all([
      getProductsWithStock(),
      getTemplates(),
    ]);
    if (templates.length === 0) {
      const bySku = Object.fromEntries(products.map((p) => [p.sku, p]));
      await ensureDefaultProposalTemplates(prisma, bySku);
    }
    const allTemplates = templates.length ? templates : await getTemplates();
    const kit = buildProposalKit(systemType, capacityKw, products, allTemplates);
    res.json(kit);
  } catch (e) {
    if (e.name === 'ZodError') return res.status(400).json({ error: 'Неверные параметры' });
    res.status(500).json({ error: 'Ошибка расчёта КП' });
  }
});

export default router;
