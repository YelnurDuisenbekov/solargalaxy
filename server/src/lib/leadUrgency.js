export const URGENCY_NO_CONTACT_MS = 60 * 60 * 1000;
export const URGENCY_QUALIFIED_MS = 24 * 60 * 60 * 1000;
export const AUTO_WHATSAPP_AFTER_MS = URGENCY_QUALIFIED_MS;

export function getLeadUrgency(lead, now = Date.now()) {
  if (!lead || ['CONVERTED', 'LOST'].includes(lead.status)) return null;

  if (!lead.contactedAt && lead.createdAt) {
    const age = now - new Date(lead.createdAt).getTime();
    if (age > URGENCY_NO_CONTACT_MS) {
      return { reason: 'no_contact' };
    }
  }

  if (lead.status === 'QUALIFIED') {
    const since = lead.qualifiedAt || lead.updatedAt;
    if (since) {
      const age = now - new Date(since).getTime();
      if (age > URGENCY_QUALIFIED_MS) {
        return { reason: 'qualified_stale' };
      }
    }
  }

  return null;
}

export function isAutoWhatsAppDue(lead, now = Date.now()) {
  if (!lead || lead.status !== 'QUALIFIED' || lead.autoWhatsAppSentAt) return false;
  const since = lead.qualifiedAt || lead.updatedAt;
  if (!since) return false;
  return now - new Date(since).getTime() >= AUTO_WHATSAPP_AFTER_MS;
}
