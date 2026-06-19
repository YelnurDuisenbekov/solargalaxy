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

/** Суммы в тенге */
export function formatMoney(value) {
  return `${formatNum(value)} ₸`;
}
