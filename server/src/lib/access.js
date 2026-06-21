import { canViewAllCrm, canViewAllErp, PERMISSIONS, hasAnyPermission } from './permissions.js';

export function leadScope(req) {
  if (canViewAllCrm(req.permissions)) return {};
  return { OR: [{ assigneeId: null }, { assigneeId: req.user.id }] };
}

export function dealScope(req) {
  if (canViewAllCrm(req.permissions)) return {};
  return { assigneeId: req.user.id };
}

export function projectScope(req) {
  if (canViewAllErp(req.permissions)) return {};
  if (hasAnyPermission(req.permissions, PERMISSIONS.WAREHOUSE_VIEW, PERMISSIONS.WAREHOUSE_ISSUE, PERMISSIONS.SUPPLY_VIEW)) {
    return {};
  }
  return { assigneeId: req.user.id };
}

export function activityScope(req) {
  if (canViewAllCrm(req.permissions)) return {};
  return { authorId: req.user.id };
}

export async function assertLeadAccess(req, prisma, leadId) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { error: 'Не найден', status: 404 };
  if (canViewAllCrm(req.permissions)) return { lead };
  if (lead.assigneeId && lead.assigneeId !== req.user.id) {
    return { error: 'Нет доступа к этому лиду', status: 403 };
  }
  return { lead };
}

export async function assertDealAccess(req, prisma, dealId) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) return { error: 'Не найдена', status: 404 };
  if (canViewAllCrm(req.permissions)) return { deal };
  if (deal.assigneeId !== req.user.id) {
    return { error: 'Нет доступа к этой сделке', status: 403 };
  }
  return { deal };
}
