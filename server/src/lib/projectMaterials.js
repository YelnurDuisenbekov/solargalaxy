import { MAX_DISCOUNT } from './proposalCalculator.js';

export const MAX_GLOBAL_KIT_DISCOUNT = 10;

export function maxDiscountForProduct(product) {
  const cat = product?.kitCategory || 'OTHER';
  return MAX_DISCOUNT[cat] ?? 0;
}

export function effectiveUnitPrice(material) {
  if (material.unitPrice != null && material.unitPrice >= 0) return material.unitPrice;
  return material.product?.price ?? 0;
}

export function effectivePurchasePrice(material) {
  if (material.purchasePrice != null && material.purchasePrice >= 0) return material.purchasePrice;
  return material.product?.purchasePrice ?? 0;
}

export function materialLineSubtotal(material) {
  return (material.quantityPlanned ?? 0) * effectiveUnitPrice(material);
}

export function materialLineTotal(material, kitGlobalDiscountPct = 0) {
  if (kitGlobalDiscountPct > 0) return materialLineSubtotal(material);
  const price = effectiveUnitPrice(material);
  const discount = material.discountPct ?? 0;
  return (material.quantityPlanned ?? 0) * price * (1 - discount / 100);
}

export function materialNeedsApproval(material) {
  const max = maxDiscountForProduct(material.product);
  return (material.discountPct ?? 0) > max + 0.0001;
}

export function projectMaterialsNeedApproval(materials, kitGlobalDiscountPct = 0) {
  if (kitGlobalDiscountPct > MAX_GLOBAL_KIT_DISCOUNT + 0.0001) return true;
  if (kitGlobalDiscountPct > 0) return false;
  return materials.some((m) => materialNeedsApproval(m));
}

export function enrichProjectMaterial(material) {
  const catalogPrice = material.product?.price ?? 0;
  const catalogPurchasePrice = material.product?.purchasePrice ?? 0;
  const maxDiscountPct = maxDiscountForProduct(material.product);
  const effectivePrice = effectiveUnitPrice(material);
  const effectivePurchase = effectivePurchasePrice(material);
  return {
    ...material,
    catalogPrice,
    catalogPurchasePrice,
    maxDiscountPct,
    effectiveUnitPrice: effectivePrice,
    effectivePurchasePrice: effectivePurchase,
    lineSubtotal: materialLineSubtotal(material),
    lineTotal: materialLineTotal(material),
    needsApproval: materialNeedsApproval(material),
  };
}

export function kitTotal(materials, kitGlobalDiscountPct = 0) {
  const subtotal = materials.reduce((sum, m) => sum + materialLineSubtotal(m), 0);
  if (kitGlobalDiscountPct > 0) {
    return subtotal * (1 - kitGlobalDiscountPct / 100);
  }
  return materials.reduce((sum, m) => sum + materialLineTotal(m), 0);
}
