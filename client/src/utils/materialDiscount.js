/** Допустимые скидки по категориям комплекта (как в proposalCalculator). */
export const MAX_MATERIAL_DISCOUNT = {
  PANEL: 5,
  INVERTER: 3,
  BATTERY: 3,
  MOUNTING: 0,
  COMMISSIONING: 10,
  CABLE: 5,
  OTHER: 0,
};

/** Максимальная общая скидка на комплект без согласования директора. */
export const MAX_GLOBAL_KIT_DISCOUNT = 10;

export const MATERIALS_GROUP_ORDER = [
  'PANEL',
  'INVERTER',
  'BATTERY',
  'COMMISSIONING',
  'CABLE',
  'OTHER',
];

export const MATERIALS_GROUP_LABELS = {
  PANEL: 'Панели',
  INVERTER: 'Инвертеры',
  BATTERY: 'Накопители',
  COMMISSIONING: 'СМР',
  CABLE: 'Кабели',
  OTHER: 'Прочее',
};

export function materialGroupKey(product) {
  const cat = product?.kitCategory || 'OTHER';
  if (cat === 'MOUNTING') return 'COMMISSIONING';
  if (MATERIALS_GROUP_ORDER.includes(cat)) return cat;
  return 'OTHER';
}

export function maxDiscountForProduct(product) {
  const cat = product?.kitCategory || 'OTHER';
  return MAX_MATERIAL_DISCOUNT[cat] ?? 0;
}

export function effectiveUnitPrice(material) {
  if (material.unitPrice != null && material.unitPrice >= 0) return material.unitPrice;
  return material.product?.price ?? 0;
}

export function effectivePurchasePrice(material) {
  if (material.purchasePrice != null && material.purchasePrice >= 0) return material.purchasePrice;
  return material.product?.purchasePrice ?? 0;
}

export function lineSubtotal(material) {
  return (material.quantityPlanned ?? 0) * effectiveUnitPrice(material);
}

export function lineTotal(material, useGlobalDiscount = false) {
  if (useGlobalDiscount) return lineSubtotal(material);
  const price = effectiveUnitPrice(material);
  const discount = material.discountPct ?? 0;
  return (material.quantityPlanned ?? 0) * price * (1 - discount / 100);
}

export function kitSubtotal(materials) {
  return materials.reduce((s, m) => s + lineSubtotal(m), 0);
}

export function kitTotal(materials, kitGlobalDiscountPct = 0) {
  const subtotal = kitSubtotal(materials);
  if (kitGlobalDiscountPct > 0) {
    return subtotal * (1 - kitGlobalDiscountPct / 100);
  }
  return materials.reduce((s, m) => s + lineTotal(m), 0);
}

export function lineNeedsApproval(material) {
  const max = maxDiscountForProduct(material.product);
  return (material.discountPct ?? 0) > max + 0.0001;
}

export function kitNeedsApproval(materials, kitGlobalDiscountPct = 0) {
  if (kitGlobalDiscountPct > MAX_GLOBAL_KIT_DISCOUNT + 0.0001) return true;
  if (kitGlobalDiscountPct > 0) return false;
  return materials.some((m) => lineNeedsApproval(m));
}

export function groupMaterials(materials) {
  const groups = new Map(MATERIALS_GROUP_ORDER.map((k) => [k, []]));
  for (const m of materials) {
    const key = materialGroupKey(m.product);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  return MATERIALS_GROUP_ORDER
    .filter((k) => groups.get(k)?.length)
    .map((k) => ({ key: k, label: MATERIALS_GROUP_LABELS[k], items: groups.get(k) }));
}

export const MATERIALS_APPROVAL_STATUS = {
  NONE: '',
  PENDING_DIRECTOR: 'На согласовании у директора',
  APPROVED: 'Комплект согласован',
  RETURNED: 'Возвращено менеджеру',
};
