import prisma from './prisma.js';
import { notifyAdmins } from './notifyDirectors.js';

function formatDateTitle(timeZone) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

function formatLeadLine(lead) {
  const city = lead.city ? `, ${lead.city}` : '';
  return `${lead.fullName} (${lead.phone}${city})`;
}

async function notifyUser(userId, title, message) {
  const exists = await prisma.notification.findFirst({
    where: { userId, type: 'QUALIFIED_LEAD_REMINDER', title },
  });
  if (exists) return false;

  await prisma.notification.create({
    data: {
      userId,
      type: 'QUALIFIED_LEAD_REMINDER',
      title,
      message,
    },
  });
  return true;
}

/** Напоминание менеджерам о заинтересованных лидах без проекта */
export async function sendQualifiedLeadReminders({ timeZone = 'Asia/Almaty' } = {}) {
  const dateTitle = formatDateTitle(timeZone);
  const title = `Заинтересованные клиенты (${dateTitle})`;

  const leads = await prisma.lead.findMany({
    where: { status: 'QUALIFIED' },
    include: { assignee: { select: { id: true, isActive: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  if (!leads.length) return { sent: 0, leads: 0 };

  const byAssignee = new Map();
  const unassigned = [];

  for (const lead of leads) {
    if (lead.assigneeId) {
      if (!byAssignee.has(lead.assigneeId)) byAssignee.set(lead.assigneeId, []);
      byAssignee.get(lead.assigneeId).push(lead);
    } else {
      unassigned.push(lead);
    }
  }

  let sent = 0;

  for (const [assigneeId, userLeads] of byAssignee) {
    const assignee = userLeads[0].assignee;
    if (assignee?.isActive === false) continue;

    const lines = userLeads.map(formatLeadLine).join('; ');
    const count = userLeads.length;
    const message = count === 1
      ? `Клиент заинтересован, но проект ещё не создан: ${lines}. Свяжитесь и переведите в проект в CRM.`
      : `${count} клиента заинтересованы, но проект не создан: ${lines}. Свяжитесь и переведите в проект в CRM.`;

    if (await notifyUser(assigneeId, title, message)) sent += 1;
  }

  if (unassigned.length) {
    const unassignedTitle = `Нераспределённые лиды (${dateTitle})`;
    const lines = unassigned.map(formatLeadLine).join('; ');
    const message = `${unassigned.length} заинтересованных лид(ов) без менеджера: ${lines}. Назначьте менеджера в CRM.`;

    await notifyAdmins({
      type: 'QUALIFIED_LEAD_REMINDER',
      title: unassignedTitle,
      message,
    });
    sent += 1;
  }

  return { sent, leads: leads.length };
}
