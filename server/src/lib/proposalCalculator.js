const EQUIPMENT_CATEGORIES = new Set(['PANEL', 'INVERTER', 'BATTERY', 'MOUNTING']);

const MAX_DISCOUNT = {
  PANEL: 5,
  INVERTER: 3,
  BATTERY: 3,
  MOUNTING: 0,
  COMMISSIONING: 10,
  CABLE: 5,
  OTHER: 0,
};

export function equipmentSum(items) {
  return items
    .filter((i) => EQUIPMENT_CATEGORIES.has(i.category))
    .reduce((s, i) => s + lineTotal(i), 0);
}

export function lineTotal(item) {
  const discount = item.discountPct ?? 0;
  return item.quantity * item.unitPrice * (1 - discount / 100);
}

export function panelCount(capacityKw, panelPowerW = 550) {
  const w = panelPowerW || 550;
  return Math.max(1, Math.ceil((capacityKw * 1000) / w));
}

export function batteryCount(systemType, capacityKw, batteryKwh = 3.5) {
  if (systemType === 'ON_GRID') return 0;
  const kwhPerKw = systemType === 'OFF_GRID' ? 2 : 1;
  const neededKwh = capacityKw * kwhPerKw;
  if (!batteryKwh || batteryKwh <= 0) return neededKwh > 0 ? 1 : 0;
  return Math.max(1, Math.ceil(neededKwh / batteryKwh));
}

export function pickPanel(products, templateProductId) {
  if (templateProductId) {
    const found = products.find((p) => p.id === templateProductId);
    if (found) return found;
  }
  const panels = products.filter((p) => p.kitCategory === 'PANEL');
  return panels.sort((a, b) => (b.powerW || 0) - (a.powerW || 0))[0] || null;
}

function inverterPoolForSystem(products, systemType) {
  const inverters = products.filter((p) => p.kitCategory === 'INVERTER' && p.capacityKw);
  if (systemType === 'ON_GRID') {
    return inverters.filter((p) => p.description === 'on-grid');
  }
  const hybrid = inverters.filter((p) => p.description === 'hybrid');
  return hybrid.length ? hybrid : inverters.filter((p) => p.description !== 'on-grid');
}

export function pickInverter(products, capacityKw, templateProductId, systemType = 'ON_GRID') {
  if (templateProductId) {
    const found = products.find((p) => p.id === templateProductId);
    if (found) return found;
  }
  const inverters = inverterPoolForSystem(products, systemType).sort(
    (a, b) => a.capacityKw - b.capacityKw,
  );
  const match = inverters.find((i) => i.capacityKw >= capacityKw);
  if (match) return match;
  return inverters[inverters.length - 1] || products.find((p) => p.kitCategory === 'INVERTER') || null;
}

export function pickBattery(products, templateProductId) {
  if (templateProductId) {
    const found = products.find((p) => p.id === templateProductId);
    if (found) return found;
  }
  return products.find((p) => p.kitCategory === 'BATTERY') || null;
}

export function resolveQuantity(allocation, { panels, capacityKw, qtyMultiplier }) {
  const m = qtyMultiplier ?? 1;
  switch (allocation) {
    case 'PER_PANEL':
      return Math.max(1, Math.ceil(panels * m));
    case 'PER_KW':
      return Math.max(1, Math.ceil(capacityKw * m));
    case 'PER_PROJECT':
      return Math.max(1, Math.ceil(m));
    case 'PERCENT_EQUIPMENT':
      return 1;
    default:
      return Math.max(1, Math.ceil(m));
  }
}

function resolveProduct(line, products, ctx) {
  const { category, productId } = line;
  if (category === 'PANEL') return pickPanel(products, productId);
  if (category === 'INVERTER') return pickInverter(products, ctx.capacityKw, productId, ctx.systemType);
  if (category === 'BATTERY') return pickBattery(products, productId);
  if (productId) return products.find((p) => p.id === productId) || null;
  return products.find((p) => p.kitCategory === category) || null;
}

function resolveUnitPrice(line, product) {
  if (line.unitPriceOverride != null && line.unitPriceOverride >= 0) return line.unitPriceOverride;
  return product?.price ?? 0;
}

/**
 * Сборка КП по шаблонам удельных расходов и каталогу товаров.
 */
export function buildProposalKit(systemType, capacityKw, products = [], templates = []) {
  const kw = capacityKw || 5;
  const activeLines = templates
    .filter((t) => t.systemType === systemType && t.enabled !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const panelLine = activeLines.find((l) => l.category === 'PANEL');
  const panelProduct = pickPanel(products, panelLine?.productId);
  const panelPowerW = panelProduct?.powerW || 550;
  const panels = panelCount(kw, panelPowerW);

  const ctx = { capacityKw: kw, panels, panelProduct, panelPowerW, systemType };
  const items = [];
  const percentLines = activeLines.filter((l) => l.allocation === 'PERCENT_EQUIPMENT');
  const regularLines = activeLines.filter((l) => l.allocation !== 'PERCENT_EQUIPMENT');

  for (const line of regularLines) {
    if (line.category === 'BATTERY') {
      const batteryProduct = resolveProduct(line, products, ctx);
      const count = batteryCount(systemType, kw, batteryProduct?.capacityKwh || 3.5);
      if (count <= 0) continue;
      const unitPrice = resolveUnitPrice(line, batteryProduct);
      items.push({
        productId: batteryProduct?.id ?? null,
        category: line.category,
        name: line.label || batteryProduct?.name || 'Аккумулятор',
        quantity: count,
        unitPrice,
        discountPct: 0,
        maxDiscountPct: MAX_DISCOUNT[line.category] ?? 0,
        stockAvailable: batteryProduct?.stock?.quantity ?? 0,
        allocation: line.allocation,
        panelPowerW: null,
        inverterKw: batteryProduct?.capacityKwh ?? null,
      });
      continue;
    }

    const product = resolveProduct(line, products, ctx);
    let quantity = resolveQuantity(line.allocation, {
      panels,
      capacityKw: kw,
      qtyMultiplier: line.qtyMultiplier,
    });

    if (line.category === 'INVERTER') quantity = 1;

    const unitPrice = resolveUnitPrice(line, product);
    items.push({
      productId: product?.id ?? null,
      category: line.category,
      name: line.label || product?.name || line.category,
      quantity,
      unitPrice,
      discountPct: 0,
      maxDiscountPct: MAX_DISCOUNT[line.category] ?? 0,
      stockAvailable: product?.stock?.quantity ?? 0,
      allocation: line.allocation,
      panelPowerW: line.category === 'PANEL' ? panelPowerW : null,
      inverterKw: line.category === 'INVERTER' ? product?.capacityKw ?? null : null,
    });
  }

  const baseEquipment = equipmentSum(items);

  for (const line of percentLines) {
    const pct = line.qtyMultiplier ?? 0;
    const product = resolveProduct(line, products, ctx);
    const unitPrice = Math.round(baseEquipment * pct / 100);
    const defaultName = line.category === 'CABLE'
      ? `Кабель (${pct}% от оборудования)`
      : line.category === 'COMMISSIONING'
        ? `Пусконаладка (${pct}% от оборудования)`
        : `${pct}% от оборудования`;

    items.push({
      productId: product?.id ?? null,
      category: line.category,
      name: line.label || product?.name || defaultName,
      quantity: 1,
      unitPrice,
      discountPct: 0,
      maxDiscountPct: MAX_DISCOUNT[line.category] ?? 0,
      stockAvailable: product?.stock?.quantity ?? 0,
      allocation: line.allocation,
      percentOfEquipment: pct,
      equipmentBase: baseEquipment,
    });
  }

  const amount = items.reduce((s, i) => s + lineTotal(i), 0);
  return {
    items,
    amount,
    meta: {
      capacityKw: kw,
      systemType,
      panelCount: panels,
      panelPowerW,
      panelProductId: panelProduct?.id ?? null,
      equipmentSum: baseEquipment,
    },
  };
}

export function applyKitDiscounts(items, overrides = {}) {
  return items.map((item) => {
    const max = item.maxDiscountPct ?? MAX_DISCOUNT[item.category] ?? 0;
    const requested = overrides[item.category] ?? item.discountPct ?? 0;
    const discountPct = Math.min(max, Math.max(0, requested));
    return { ...item, discountPct };
  });
}

export function kitAmount(items) {
  return items.reduce((s, i) => s + lineTotal(i), 0);
}

export { MAX_DISCOUNT };
