/**
 * Формат чисел: 2 000 000 (пробел — разделитель тысяч)
 */
export function formatNum(value, options = {}) {
  const { decimals = null, maxDecimals = decimals ?? 0 } = options;
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);

  const rounded = decimals != null
    ? n.toFixed(decimals)
    : maxDecimals > 0
      ? String(n)
      : String(Math.round(n));

  const [intPart, decPart] = rounded.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  if (decPart != null && Number(`0.${decPart}`) > 0) {
    const trimmed = decPart.replace(/0+$/, '') || decPart;
    return `${formattedInt}.${trimmed}`;
  }

  return formattedInt;
}

/** Тарифы ₸/кВт·ч — с десятичной частью при необходимости */
export function formatTariff(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return Number.isInteger(n) ? formatNum(n) : formatNum(n, { decimals: 1 });
}

/** Длительность между двумя датами (для «время до контакта») */
export function formatDuration(from, to = new Date()) {
  if (!from) return '—';
  const start = from instanceof Date ? from : new Date(from);
  const end = to instanceof Date ? to : new Date(to);
  const ms = end - start;
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return '< 1 мин';
  if (mins < 60) return `${mins} мин`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} д`;
  return `${Math.floor(days / 30)} мес`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Суммы в тенге */
export function formatMoney(value) {
  return `${formatNum(value)} ₸`;
}

/** Сумма строки КП с учётом скидки */
export function proposalLineTotal(item) {
  const discount = item.discountPct ?? 0;
  return item.quantity * item.unitPrice * (1 - discount / 100);
}
