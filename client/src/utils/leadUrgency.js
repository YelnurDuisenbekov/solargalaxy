export const URGENCY_NO_CONTACT_MS = 60 * 60 * 1000;
export const URGENCY_QUALIFIED_MS = 24 * 60 * 60 * 1000;

/**
 * Лид «срочный»: нет контакта > 1 ч или «Заинтересован» > 1 суток без проекта.
 * @returns {{ reason: 'no_contact' | 'qualified_stale' } | null}
 */
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

export function isLeadUrgent(lead, now = Date.now()) {
  return getLeadUrgency(lead, now) !== null;
}

export const URGENCY_LABELS = {
  no_contact: 'Нет контакта более 1 часа',
  qualified_stale: 'Заинтересован — прошли сутки без проекта',
};
