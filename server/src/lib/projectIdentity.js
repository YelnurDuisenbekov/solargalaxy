import { normalizePhone, formatPhoneDisplay, leadPhoneDbFilter } from './phone.js';

export async function nextProjectNumber(prisma) {
  const year = new Date().getFullYear();
  const prefix = `SG-${year}-`;
  const last = await prisma.project.findFirst({
    where: { projectNumber: { startsWith: prefix } },
    orderBy: { projectNumber: 'desc' },
    select: { projectNumber: true },
  });
  let seq = 1;
  if (last?.projectNumber) {
    const n = parseInt(last.projectNumber.slice(prefix.length), 10);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/** Привязать заявки к клиенту по номеру телефона. */
export async function linkLeadsToClient(prisma, clientId, phone) {
  const phoneNorm = normalizePhone(phone);
  if (!phoneNorm || !clientId) return 0;

  const filter = leadPhoneDbFilter(phone);
  if (!filter) return 0;

  const candidates = await prisma.lead.findMany({
    where: { ...filter, clientId: null },
    select: { id: true, phone: true },
  });

  const ids = candidates
    .filter((l) => normalizePhone(l.phone) === phoneNorm)
    .map((l) => l.id);

  if (!ids.length) return 0;

  const { count } = await prisma.lead.updateMany({
    where: { id: { in: ids } },
    data: { clientId },
  });

  return count;
}

/** Привязать проекты к клиенту по номеру телефона. */
export async function linkProjectsToClient(prisma, clientId, phone) {
  const clientPhone = normalizePhone(phone);
  if (!clientPhone || !clientId) return 0;
  const { count } = await prisma.project.updateMany({
    where: {
      clientPhone,
      OR: [{ clientId: null }, { clientId }],
    },
    data: { clientId },
  });
  return count;
}

/** Поля projectNumber + clientPhone для создания проекта. */
export async function projectIdentityFields(prisma, { lead, deal, clientId, clientPhone, clientUser }) {
  const projectNumber = await nextProjectNumber(prisma);
  let phone = normalizePhone(clientPhone);
  if (!phone && lead?.phone) phone = normalizePhone(lead.phone);
  if (!phone && deal?.phone) phone = normalizePhone(deal.phone);
  if (!phone && clientUser?.phone) phone = normalizePhone(clientUser.phone);

  let resolvedClientId = clientId ?? null;
  if (!resolvedClientId && phone) {
    const clients = await prisma.user.findMany({
      where: { role: 'CLIENT', phone: { not: null } },
      select: { id: true, phone: true },
    });
    const match = clients.find((c) => normalizePhone(c.phone) === phone);
    if (match) resolvedClientId = match.id;
  }

  return { projectNumber, clientPhone: phone, clientId: resolvedClientId };
}

export { formatPhoneDisplay };
