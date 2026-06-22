import prisma from './prisma.js';
import { notifyUser } from './notifyDirectors.js';
import { PERMISSIONS, hasAnyPermission } from './permissions.js';

export function isAdminUser(user, permissions) {
  return user?.role === 'ADMIN' || hasAnyPermission(permissions, PERMISSIONS.ADMIN_FULL);
}

export async function assertManagerAssignee(assigneeId) {
  const manager = await prisma.user.findFirst({
    where: { id: assigneeId, role: 'MANAGER', isActive: true },
    select: { id: true, fullName: true },
  });
  if (!manager) {
    const err = new Error('INVALID_ASSIGNEE');
    err.message = 'Назначить можно только активного менеджера';
    throw err;
  }
  return manager;
}

export async function reassignLead(leadId, newAssigneeId, byUser) {
  const manager = await assertManagerAssignee(newAssigneeId);

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { deal: { select: { id: true } }, project: { select: { id: true, title: true } } },
  });
  if (!lead) {
    const err = new Error('NOT_FOUND');
    err.message = 'Лид не найден';
    throw err;
  }

  const prevAssigneeId = lead.assigneeId;
  if (prevAssigneeId === newAssigneeId) {
    return prisma.lead.findUnique({
      where: { id: leadId },
      include: { assignee: { select: { id: true, fullName: true } } },
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: leadId }, data: { assigneeId: newAssigneeId } });
    if (lead.deal) {
      await tx.deal.update({ where: { id: lead.deal.id }, data: { assigneeId: newAssigneeId } });
    }
    if (lead.project) {
      await tx.project.update({ where: { id: lead.project.id }, data: { assigneeId: newAssigneeId } });
    }
  });

  const label = `${lead.fullName} (${lead.phone})`;
  await notifyUser({
    userId: newAssigneeId,
    fromUserId: byUser.id,
    type: 'ASSIGNEE_CHANGED',
    title: 'Вам назначен лид',
    message: `${byUser.fullName || 'Администратор'} передал вам лид: ${label}.`,
  });

  if (prevAssigneeId) {
    await notifyUser({
      userId: prevAssigneeId,
      fromUserId: byUser.id,
      type: 'ASSIGNEE_CHANGED',
      title: 'Лид передан другому менеджеру',
      message: `${byUser.fullName || 'Администратор'} передал лид ${label} менеджеру ${manager.fullName}.`,
    });
  }

  return prisma.lead.findUnique({
    where: { id: leadId },
    include: { assignee: { select: { id: true, fullName: true } } },
  });
}

export async function reassignProject(projectId, newAssigneeId, byUser) {
  const manager = await assertManagerAssignee(newAssigneeId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      lead: { select: { id: true } },
      deal: { select: { id: true } },
    },
  });
  if (!project) {
    const err = new Error('NOT_FOUND');
    err.message = 'Проект не найден';
    throw err;
  }

  const prevAssigneeId = project.assigneeId;
  if (prevAssigneeId === newAssigneeId) {
    return prisma.project.findUnique({
      where: { id: projectId },
      include: { assignee: { select: { id: true, fullName: true } } },
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: { assigneeId: newAssigneeId } });
    if (project.lead) {
      await tx.lead.update({ where: { id: project.lead.id }, data: { assigneeId: newAssigneeId } });
    }
    if (project.deal) {
      await tx.deal.update({ where: { id: project.deal.id }, data: { assigneeId: newAssigneeId } });
    }
  });

  const title = project.projectNumber || project.title;
  await notifyUser({
    userId: newAssigneeId,
    fromUserId: byUser.id,
    type: 'ASSIGNEE_CHANGED',
    title: 'Вам назначен проект',
    message: `${byUser.fullName || 'Администратор'} передал вам проект «${title}».`,
    projectId,
  });

  if (prevAssigneeId) {
    await notifyUser({
      userId: prevAssigneeId,
      fromUserId: byUser.id,
      type: 'ASSIGNEE_CHANGED',
      title: 'Проект передан другому менеджеру',
      message: `${byUser.fullName || 'Администратор'} передал проект «${title}» менеджеру ${manager.fullName}.`,
      projectId,
    });
  }

  return prisma.project.findUnique({
    where: { id: projectId },
    include: { assignee: { select: { id: true, fullName: true } } },
  });
}
