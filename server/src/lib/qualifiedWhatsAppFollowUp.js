import { isAutoWhatsAppDue } from './leadUrgency.js';
import { isWhatsAppConfigured, sendLeadWhatsAppMessage } from './whatsappApi.js';
import prisma from './prisma.js';

function formatDateTitle(timeZone) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

/** Авто WhatsApp через сутки после «Заинтересован» (API или уведомление менеджеру) */
export async function processQualifiedWhatsAppFollowUp({ timeZone = 'Asia/Almaty' } = {}) {
  const now = Date.now();
  const dateTitle = formatDateTitle(timeZone);
  const title = `WhatsApp клиенту (${dateTitle})`;

  const leads = await prisma.lead.findMany({
    where: {
      status: 'QUALIFIED',
      autoWhatsAppSentAt: null,
      qualifiedAt: { not: null },
    },
    include: {
      assignee: { select: { id: true, fullName: true, isActive: true } },
    },
  });

  let sent = 0;
  let notified = 0;

  for (const lead of leads) {
    if (!isAutoWhatsAppDue(lead, now)) continue;

    const managerName = lead.assignee?.fullName || 'Менеджер Senergy';

    if (isWhatsAppConfigured()) {
      const apiResult = await sendLeadWhatsAppMessage(lead, { kind: 'followup', managerName });
      if (apiResult.sent) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { autoWhatsAppSentAt: new Date() },
        });
        sent += 1;
        continue;
      }
      console.error(`[whatsapp] follow-up ${lead.id}:`, apiResult.error || apiResult.reason);
    }

    const userId = lead.assigneeId;
    if (!userId || lead.assignee?.isActive === false) continue;

    const exists = await prisma.notification.findFirst({
      where: { userId, type: 'AUTO_WHATSAPP_FOLLOWUP', title, message: { contains: lead.fullName } },
    });
    if (exists) continue;

    await prisma.notification.create({
      data: {
        userId,
        type: 'AUTO_WHATSAPP_FOLLOWUP',
        title,
        message: `Авто-напоминание: отправьте WhatsApp клиенту ${lead.fullName} (${lead.phone}). Прошли сутки после статуса «Заинтересован».`,
      },
    });
    notified += 1;
  }

  return { sent, notified, checked: leads.length };
}
