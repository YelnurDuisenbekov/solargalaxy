/** Класс input для публичной формы: серый — пусто, чёрный — заполнено. */
export function publicInputClass(value, { emptyValues = [], type } = {}) {
  const empty = isPublicFieldEmpty(value, { emptyValues, type });
  return `input ${empty ? 'input--empty' : 'input--filled'}`;
}

export function isPublicFieldEmpty(value, { emptyValues = [], type } = {}) {
  if (value == null || value === '') return true;
  const s = String(value).trim();
  if (!s || emptyValues.includes(s)) return true;
  if (typeof value === 'number') return value <= 0;

  if (type === 'phone' || looksLikePhone(s)) {
    if (s === '+7') return true;
    const digits = s.replace(/\D/g, '');
    if (digits === '7' || digits.length < 11) return true;
    return false;
  }

  return false;
}

function looksLikePhone(s) {
  return s.startsWith('+7') || /^[78]\d/.test(s);
}

export function isCityEmpty(citySelect, cityCustom, query = '') {
  if (citySelect === 'OTHER') return !cityCustom?.trim();
  return !citySelect && !query?.trim();
}
