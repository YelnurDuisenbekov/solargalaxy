export const KIT_CATEGORY = {
  PANEL: 'Панели',
  INVERTER: 'Инвертор',
  BATTERY: 'Аккумулятор',
  MOUNTING: 'Опорная конструкция',
  COMMISSIONING: 'Монтаж и пусконаладка',
  CABLE: 'Кабели',
  OTHER: 'Прочее',
};

export const COST_ALLOCATION = {
  PER_PANEL: 'На панель',
  PER_KW: 'На кВт',
  PER_PROJECT: 'На проект',
  PERCENT_EQUIPMENT: '% от оборудования',
};

export const COST_ALLOCATION_HINT = {
  PER_PANEL: 'Кол-во × число панелей (напр. 1 — на каждую панель, 0.1 — комплект на 10 панелей)',
  PER_KW: 'Кол-во × мощность станции в кВт',
  PER_PROJECT: 'Фиксированное кол-во на весь проект',
  PERCENT_EQUIPMENT: 'Множитель = процент от суммы панелей, инвертора, АКБ и опоры (напр. 20 = 20%)',
};
