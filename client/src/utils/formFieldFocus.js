/** При фокусе — выделить всё, чтобы новый ввод заменил значение. */
export function focusSelectAll(e) {
  requestAnimationFrame(() => {
    e.target.select?.();
  });
}

/** Телефон: при «+7» курсор в конец; иначе выделить всё. */
export function focusPhoneInput(e, phone) {
  requestAnimationFrame(() => {
    const el = e.target;
    const v = (phone || '').trim();
    if (v === '+7') {
      const len = el.value.length;
      el.setSelectionRange(len, len);
    } else {
      el.select?.();
    }
  });
}

/** Сброс значения-примера при первом фокусе (счёт, площадь, тариф). */
export function focusClearPreset(e, { value, preset, onClear }) {
  if (preset != null && value === preset) {
    onClear();
  }
  focusSelectAll(e);
}

export const CALC_PRESETS = {
  monthlyBill: 150_000,
  roofArea: 200,
  tariffBusiness: 44,
  tariffHousehold: 25.5,
};
