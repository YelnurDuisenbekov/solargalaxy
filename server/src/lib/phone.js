/** Нормализация телефона → 77001234567 */
export function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith('7')) return digits;
  if (digits.length === 10) return `7${digits}`;
  return null;
}

/** Последние 7 цифр для предфильтра по телефону в БД */
export function phoneSearchTail(normalized) {
  if (!normalized || normalized.length < 7) return null;
  return normalized.slice(-7);
}

/** Prisma-фильтр для поиска лидов по телефону (учитывает формат +7 XXX XXX XXXX) */
export function leadPhoneDbFilter(rawPhone) {
  const phoneNorm = normalizePhone(rawPhone);
  if (!phoneNorm) return null;
  const display = formatPhoneDisplay(phoneNorm);
  const tail = phoneSearchTail(phoneNorm);
  const or = [{ phone: display }];
  if (tail) {
    or.push({ phone: { contains: `${tail.slice(0, 3)} ${tail.slice(3)}` } });
    or.push({ phone: { contains: tail } });
  }
  return { OR: or };
}

/** Логин и email клиента по нормализованному телефону (служебные поля в БД) */
export function clientAccountLogin(phoneNorm) {
  return `c${phoneNorm}`;
}

export function clientAccountEmail(phoneNorm) {
  return `${phoneNorm}@clients.solargalaxy.kz`;
}

/** Активный клиент по номеру телефона */
export async function findClientByPhone(prisma, rawPhone) {
  const phoneNorm = normalizePhone(rawPhone);
  const filter = leadPhoneDbFilter(rawPhone);
  if (!phoneNorm || !filter) return null;

  const candidates = await prisma.user.findMany({
    where: { ...filter, role: 'CLIENT', isActive: true },
    select: { id: true, phone: true, fullName: true },
  });

  return candidates.find((u) => normalizePhone(u.phone) === phoneNorm) || null;
}

/** Формат для отображения: +7 700 123 4567 */
export function formatPhoneDisplay(normalized) {
  if (!normalized || normalized.length !== 11) return normalized;
  const d = normalized.startsWith('7') ? normalized.slice(1) : normalized;
  return `+7 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}
