/** Города Казахстана (основные) + «Другое» только в UI */
export const KZ_CITIES = [
  'Алматы',
  'Астана',
  'Шымкент',
  'Караганда',
  'Актобе',
  'Тараз',
  'Павлодар',
  'Усть-Каменогорск',
  'Семей',
  'Атырау',
  'Костанай',
  'Кызылорда',
  'Уральск',
  'Петропавловск',
  'Актау',
  'Кокшетау',
  'Туркестан',
  'Талдыкорган',
  'Экибастуз',
  'Рудный',
  'Жезказган',
  'Балхаш',
  'Кентау',
  'Сатпаев',
  'Темиртау',
  'Жанаозен',
  'Конаев',
  'Жаркент',
  'Аксай',
  'Риддер',
];

export const CITY_OTHER = '__OTHER__';

export const PHONE_REGEX = /^\+7 \d{3} \d{3} \d{4}$/;

export const FIELD_LABELS = {
  fullName: 'ФИО',
  phone: 'Телефон',
  city: 'Город',
  cityCustom: 'Город (свой вариант)',
  objectType: 'Тип объекта',
  systemType: 'Тип системы',
  capacityKw: 'Мощность',
  source: 'Источник',
  notes: 'Примечание',
};

export const SYSTEM_TYPE_HINTS = {
  ON_GRID: 'Сетевая: станция подключена к центральной сети. Излишки можно отдавать в сеть, при нехватке — брать из неё.',
  OFF_GRID: 'Автономная: работает без сети, энергия накапливается в аккумуляторах. Подходит для удалённых объектов.',
  HYBRID: 'Гибридная: сочетает сеть и аккумуляторы — резерв при отключениях и возможность работы с сетью.',
};

/** Форматирует ввод телефона в +7 XXX XXX XXXX */
export function formatKzPhone(value) {
  const digits = value.replace(/\D/g, '').replace(/^8/, '7').replace(/^7/, '').slice(0, 10);
  let result = '+7';
  if (digits.length > 0) result += ` ${digits.slice(0, 3)}`;
  if (digits.length > 3) result += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) result += ` ${digits.slice(6, 10)}`;
  return result;
}

export function resolveCity(citySelect, cityCustom) {
  if (citySelect === CITY_OTHER) return cityCustom.trim();
  return citySelect;
}

/** Города, подходящие под введённый текст */
export function filterKzCities(query) {
  const q = query.trim().toLowerCase();
  if (!q) return KZ_CITIES;
  return KZ_CITIES.filter((c) => c.toLowerCase().includes(q));
}

export function validateLeadForm(form, { requireCapacity = false } = {}) {
  const fields = {};

  if (!form.fullName?.trim() || form.fullName.trim().length < 2) {
    fields.fullName = 'ФИО: укажите минимум 2 символа';
  }

  if (!PHONE_REGEX.test(form.phone || '')) {
    fields.phone = 'Телефон: формат +7 XXX XXX XXXX (10 цифр после +7)';
  }

  if (!form.citySelect) {
    fields.city = 'Город: выберите из списка';
  } else if (form.citySelect === CITY_OTHER) {
    if (!form.cityCustom?.trim() || form.cityCustom.trim().length < 2) {
      fields.cityCustom = 'Город: укажите название (минимум 2 символа)';
    }
  }

  if (requireCapacity && form.capacityKw !== '' && form.capacityKw != null) {
    const kw = Number(form.capacityKw);
    if (Number.isNaN(kw) || kw <= 0) {
      fields.capacityKw = 'Мощность: укажите положительное число';
    }
  }

  return { valid: Object.keys(fields).length === 0, fields };
}
