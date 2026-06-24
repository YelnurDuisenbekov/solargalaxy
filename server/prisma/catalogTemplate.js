/**
 * Каталог товаров Senergy — единый источник данных для seed.js и seed-prod.js.
 * Цены в тенге (целые). purchasePrice ≈ 85% от розничной, если не задан явно.
 */

/** @typedef {'PANEL'|'INVERTER'|'BATTERY'|'MOUNTING'|'COMMISSIONING'|'CABLE'|'OTHER'} KitCategory */

/**
 * @typedef {Object} CatalogProduct
 * @property {string} sku
 * @property {string} name
 * @property {string} [category]
 * @property {number} price
 * @property {number} [purchasePrice]
 * @property {number} [qty]
 * @property {KitCategory} kitCategory
 * @property {number} [minStock]
 * @property {number} [powerW]
 * @property {number} [capacityKw]
 * @property {number} [capacityKwh]
 * @property {string} [description] — для инверторов: 'on-grid' | 'hybrid'
 */

/** @type {CatalogProduct[]} */
export const CATALOG_TEMPLATE = [
  // ── Панели ──
  { sku: 'LR7-72HVD-645M', name: 'Longi Hi-Mo X10 645Вт', category: 'Панели', price: 75000, kitCategory: 'PANEL', powerW: 645, qty: 80, minStock: 20 },
  { sku: 'LR7-72HVD-645M-2', name: 'Longi Hi-Mo X10 LR7-72HVD-645M', category: 'Панели', price: 65000, kitCategory: 'PANEL', powerW: 645, qty: 80, minStock: 20 },
  { sku: 'LR8-66HGD-620M', name: 'Longi Hi-Mo 7 LR8-66HGD-620M', category: 'Панели', price: 60000, kitCategory: 'PANEL', powerW: 620, qty: 80, minStock: 20 },
  { sku: 'LR8-66HVD-650M', name: 'LONGI Hi-Mo X10 LR8-66HVD-650M', category: 'Панели', price: 70000, kitCategory: 'PANEL', powerW: 650, qty: 120, minStock: 20 },
  { sku: 'JINKO-625', name: 'Jinko Solar 625 Вт', category: 'Панели', price: 65000, kitCategory: 'PANEL', powerW: 625, qty: 80, minStock: 20 },

  // ── Инверторы гибридные / автономные ──
  { sku: 'EVO-6200', name: 'Инвертор EVO-6200', category: 'Инверторы', price: 250000, kitCategory: 'INVERTER', capacityKw: 6.2, description: 'hybrid', qty: 8, minStock: 2 },
  { sku: 'EVO-4200', name: 'Инвертор EVO-4200', category: 'Инверторы', price: 200000, kitCategory: 'INVERTER', capacityKw: 4.2, description: 'hybrid', qty: 10, minStock: 2 },
  { sku: 'ANERN-6000', name: 'Гибридный Инвертор Anern 6000', category: 'Инверторы', price: 350000, kitCategory: 'INVERTER', capacityKw: 6, description: 'hybrid', qty: 6, minStock: 2 },
  { sku: 'PUMP-7.5-380', name: 'Инвертор для насоса 7,5 кВт 380В', category: 'Инверторы', price: 500000, kitCategory: 'INVERTER', capacityKw: 7.5, description: 'hybrid', qty: 4, minStock: 1 },
  { sku: 'DEYE-HYB-20', name: 'Deye 20 кВт гибридный', category: 'Инверторы', price: 2025000, kitCategory: 'INVERTER', capacityKw: 20, description: 'hybrid', qty: 2, minStock: 1 },
  { sku: 'DEYE-LV10-1P', name: 'Deye LV10 1-фазный', category: 'Инверторы', price: 1200000, kitCategory: 'INVERTER', capacityKw: 10, description: 'hybrid', qty: 4, minStock: 1 },
  { sku: 'DEYE-LV10-3P', name: 'Deye LV10 3-фазный', category: 'Инверторы', price: 1275000, kitCategory: 'INVERTER', capacityKw: 10, description: 'hybrid', qty: 4, minStock: 1 },
  { sku: 'DEYE-LV15-3P', name: 'Deye LV15 3-фазный', category: 'Инверторы', price: 1425000, kitCategory: 'INVERTER', capacityKw: 15, description: 'hybrid', qty: 3, minStock: 1 },
  { sku: 'DEYE-LV16-1P', name: 'Deye LV16 1-фазный', category: 'Инверторы', price: 1500000, kitCategory: 'INVERTER', capacityKw: 16, description: 'hybrid', qty: 3, minStock: 1 },
  { sku: 'DEYE-LV20-3P', name: 'Deye LV20 3-фазный', category: 'Инверторы', price: 2025000, kitCategory: 'INVERTER', capacityKw: 20, description: 'hybrid', qty: 2, minStock: 1 },
  { sku: 'DEYE-HV10', name: 'Deye HV10', category: 'Инверторы', price: 1125000, kitCategory: 'INVERTER', capacityKw: 10, description: 'hybrid', qty: 4, minStock: 1 },
  { sku: 'DEYE-HV20', name: 'Deye HV20 высоковольтный', category: 'Инверторы', price: 1312000, kitCategory: 'INVERTER', capacityKw: 20, description: 'hybrid', qty: 2, minStock: 1 },
  { sku: 'DEYE-HV30', name: 'Deye HV30', category: 'Инверторы', price: 2400000, kitCategory: 'INVERTER', capacityKw: 30, description: 'hybrid', qty: 2, minStock: 1 },
  { sku: 'DEYE-HV40', name: 'Deye HV40', category: 'Инверторы', price: 2925000, kitCategory: 'INVERTER', capacityKw: 40, description: 'hybrid', qty: 1, minStock: 1 },
  { sku: 'DEYE-HV50', name: 'Deye HV50', category: 'Инверторы', price: 3375000, kitCategory: 'INVERTER', capacityKw: 50, description: 'hybrid', qty: 1, minStock: 1 },

  // ── Инверторы сетевые (on-grid) ──
  { sku: 'GOODWE-30', name: 'GOODWE 30 кВт', category: 'Инверторы', price: 850000, kitCategory: 'INVERTER', capacityKw: 30, description: 'on-grid', qty: 3, minStock: 1 },
  { sku: 'GOODWE-100-3P', name: 'GoodWe 100 кВт 3 фазы', category: 'Инверторы', price: 2500000, kitCategory: 'INVERTER', capacityKw: 100, description: 'on-grid', qty: 2, minStock: 1 },
  { sku: 'SOLIS-S6-125K', name: 'Solis S6-GC(125)K', category: 'Инверторы', price: 2950000, kitCategory: 'INVERTER', capacityKw: 125, description: 'on-grid', qty: 1, minStock: 1 },
  { sku: 'DEYE-3-P1', name: 'Deye 3 kW P1', category: 'Инверторы', price: 187000, kitCategory: 'INVERTER', capacityKw: 3, description: 'on-grid', qty: 12, minStock: 2 },
  { sku: 'DEYE-5-P1', name: 'Deye 5 kW P1', category: 'Инверторы', price: 262500, kitCategory: 'INVERTER', capacityKw: 5, description: 'on-grid', qty: 12, minStock: 2 },
  { sku: 'DEYE-5-P3', name: 'Deye 5 kW P3', category: 'Инверторы', price: 292500, kitCategory: 'INVERTER', capacityKw: 5, description: 'on-grid', qty: 10, minStock: 2 },
  { sku: 'DEYE-10-P1', name: 'Deye 10 kW P1', category: 'Инверторы', price: 435000, kitCategory: 'INVERTER', capacityKw: 10, description: 'on-grid', qty: 8, minStock: 2 },
  { sku: 'DEYE-10-P3', name: 'Deye 10 kW P3', category: 'Инверторы', price: 360000, kitCategory: 'INVERTER', capacityKw: 10, description: 'on-grid', qty: 8, minStock: 2 },
  { sku: 'DEYE-15', name: 'Deye 15 kW', category: 'Инверторы', price: 487500, kitCategory: 'INVERTER', capacityKw: 15, description: 'on-grid', qty: 5, minStock: 1 },
  { sku: 'DEYE-20-OG', name: 'Deye 20 kW on-grid', category: 'Инверторы', price: 525000, kitCategory: 'INVERTER', capacityKw: 20, description: 'on-grid', qty: 4, minStock: 1 },
  { sku: 'DEYE-25', name: 'Deye 25 kW', category: 'Инверторы', price: 562500, kitCategory: 'INVERTER', capacityKw: 25, description: 'on-grid', qty: 4, minStock: 1 },
  { sku: 'DEYE-30-OG', name: 'Deye 30 kW', category: 'Инверторы', price: 675000, kitCategory: 'INVERTER', capacityKw: 30, description: 'on-grid', qty: 3, minStock: 1 },
  { sku: 'DEYE-40-OG', name: 'Deye 40 kW', category: 'Инверторы', price: 1087500, kitCategory: 'INVERTER', capacityKw: 40, description: 'on-grid', qty: 2, minStock: 1 },
  { sku: 'DEYE-50-OG', name: 'Deye 50 kW', category: 'Инверторы', price: 1162500, kitCategory: 'INVERTER', capacityKw: 50, description: 'on-grid', qty: 2, minStock: 1 },
  { sku: 'DEYE-60', name: 'Deye 60 kW', category: 'Инверторы', price: 1410000, kitCategory: 'INVERTER', capacityKw: 60, description: 'on-grid', qty: 2, minStock: 1 },
  { sku: 'DEYE-80', name: 'Deye 80 kW', category: 'Инверторы', price: 1537500, kitCategory: 'INVERTER', capacityKw: 80, description: 'on-grid', qty: 1, minStock: 1 },
  { sku: 'DEYE-100', name: 'Deye 100 kW', category: 'Инверторы', price: 1912500, kitCategory: 'INVERTER', capacityKw: 100, description: 'on-grid', qty: 1, minStock: 1 },
  { sku: 'DEYE-110', name: 'Deye 110 kW', category: 'Инверторы', price: 1912500, kitCategory: 'INVERTER', capacityKw: 110, description: 'on-grid', qty: 1, minStock: 1 },
  { sku: 'DEYE-120', name: 'Deye 120 kW', category: 'Инверторы', price: 2212500, kitCategory: 'INVERTER', capacityKw: 120, description: 'on-grid', qty: 1, minStock: 1 },
  { sku: 'DEYE-130', name: 'Deye 130 kW', category: 'Инверторы', price: 2475000, kitCategory: 'INVERTER', capacityKw: 130, description: 'on-grid', qty: 1, minStock: 1 },

  // ── Аккумуляторы ──
  { sku: 'DYNESS-5.12', name: 'Dyness 5,12 кВт·ч', category: 'АКБ', price: 500000, kitCategory: 'BATTERY', capacityKwh: 5.12, qty: 10, minStock: 2 },
  { sku: 'DYNESS-14.3', name: 'Dyness 14.3KW Power Brick', category: 'АКБ', price: 1400000, kitCategory: 'BATTERY', capacityKwh: 14.3, qty: 6, minStock: 2 },
  { sku: 'DEYE-BAT-10.24', name: 'DEYE 10.24 kWh', category: 'АКБ', price: 950000, kitCategory: 'BATTERY', capacityKwh: 10.24, qty: 8, minStock: 2 },

  // ── Прочее ──
  { sku: 'IEK-VA47-63', name: 'Автомат ИЭК ВА47-29 3ф 63А', category: 'Автоматы', price: 4200, kitCategory: 'OTHER', qty: 50, minStock: 10 },
  { sku: 'CABLE-TIE-4x300', name: 'Стяжка кабельная 4*300', category: 'Кабели', price: 1400, kitCategory: 'CABLE', qty: 200, minStock: 20 },
  { sku: 'SIP-4x25', name: 'Кабель СИП 4 4*25', category: 'Кабели', price: 1540, kitCategory: 'CABLE', qty: 100, minStock: 10 },
  { sku: 'PV-4MM', name: 'PV Кабель 4мм', category: 'Кабели', price: 780, kitCategory: 'CABLE', qty: 500, minStock: 50 },

  // ── Конструкции ──
  { sku: 'PROF-41-1.5', name: 'Профиль 41х41х1,5 мм', category: 'Конструкции', price: 2500, kitCategory: 'MOUNTING', qty: 200, minStock: 20 },
  { sku: 'PROF-41-2', name: 'Профиль 41х41х2 мм', category: 'Конструкции', price: 3000, kitCategory: 'MOUNTING', qty: 200, minStock: 20 },

  // ── Услуги / шаблоны КП (не из прайса, нужны для расчёта) ──
  { sku: 'MOUNT-KIT', name: 'Опорная конструкция (за 1 панель)', category: 'Монтаж', price: 12000, kitCategory: 'MOUNTING', qty: 999, minStock: 0 },
  { sku: 'COMM-STD', name: 'Пусконаладка', category: 'Услуги', price: 0, kitCategory: 'COMMISSIONING', qty: 999, minStock: 0 },
  { sku: 'CABLE-SET', name: 'Кабельный комплект (% от оборудования)', category: 'Кабели', price: 0, kitCategory: 'CABLE', qty: 30, minStock: 0 },
];

/** SKU панели по умолчанию для шаблонов КП (максимальная мощность в каталоге). */
export const DEFAULT_PANEL_SKU = 'LR8-66HVD-650M';

/** SKU АКБ по умолчанию для шаблонов КП. */
export const DEFAULT_BATTERY_SKU = 'DYNESS-5.12';

export function normalizeCatalogProduct(raw) {
  const purchasePrice = raw.purchasePrice ?? Math.round(raw.price * 0.85);
  const qty = raw.qty ?? 10;
  const minStock = raw.minStock ?? 0;
  const { powerW, capacityKw, capacityKwh, description, ...rest } = raw;
  return {
    ...rest,
    purchasePrice,
    qty,
    minStock,
    powerW: powerW ?? null,
    capacityKw: capacityKw ?? null,
    capacityKwh: capacityKwh ?? null,
    description: description ?? null,
  };
}

export function getCatalogProducts() {
  return CATALOG_TEMPLATE.map(normalizeCatalogProduct);
}
