/** Ввод десятичных чисел: без ведущих нулей, применение по Enter */

export function sanitizeDecimalTyping(raw) {
  let s = String(raw ?? '').replace(',', '.');
  s = s.replace(/[^\d.]/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) {
    const intPart = s.slice(0, dot).replace(/^0+(?=\d)/, '') || '0';
    const decPart = s.slice(dot + 1).replace(/\./g, '');
    return `${intPart}.${decPart}`;
  }
  if (s.length > 1) return s.replace(/^0+/, '') || '0';
  return s;
}

export function parseDecimalInput(raw) {
  const s = String(raw ?? '').trim().replace(',', '.');
  if (s === '' || s === '.') return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export function formatDecimalValue(value, decimals = null) {
  if (value == null || Number.isNaN(Number(value))) return '';
  const n = Number(value);
  if (decimals === 0) return String(Math.round(n));
  if (decimals == null) {
    const s = String(n);
    return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
  }
  const rounded = Math.round(n * 10 ** decimals) / 10 ** decimals;
  const s = rounded.toFixed(decimals);
  // Убираем только дробные нули (12.50 → 12.5), не трогаем целые 90, 180 и т.д.
  return s.includes('.') ? s.replace(/\.?0+$/, '') || '0' : s;
}

export function clampDecimal(value, min, max, decimals = null) {
  let v = value;
  if (min != null) v = Math.max(min, v);
  if (max != null) v = Math.min(max, v);
  if (decimals === 0) return Math.round(v);
  if (decimals != null) return Math.round(v * 10 ** decimals) / 10 ** decimals;
  return v;
}

export function commitOnEnterKey(e, commit) {
  if (e.key === 'Enter') {
    e.preventDefault();
    commit();
    e.currentTarget.blur();
    return true;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    e.currentTarget.blur();
    return true;
  }
  return false;
}
