/** Расчёт потребления и мощности СЭС для калькулятора на сайте */

export const PANEL_EFFICIENCY_PCT = 24;
const BASE_EFFICIENCY = 0.20;
const PEAK_SUN_HOURS = 4.8;
const PERFORMANCE_RATIO = 0.78;
const KWP_PER_SQM = 0.2;

export function calcMonthlyKwh(monthlyBill, tariffPerKwh) {
  if (!monthlyBill || !tariffPerKwh || tariffPerKwh <= 0) return null;
  return monthlyBill / tariffPerKwh;
}

/** Рекомендуемая мощность СЭС, кВт (с учётом КПД модулей 24%) */
export function calcRecommendedKw({ monthlyBill, tariffPerKwh, roofArea }) {
  const monthlyKwh = calcMonthlyKwh(monthlyBill, tariffPerKwh);
  if (!monthlyKwh) return null;

  const effFactor = (PANEL_EFFICIENCY_PCT / 100) / BASE_EFFICIENCY;
  const monthlyYieldPerKwp = PEAK_SUN_HOURS * PERFORMANCE_RATIO * 30 * effFactor;
  let kwp = monthlyKwh / monthlyYieldPerKwp;

  if (roofArea && roofArea > 0) {
    const maxKw = roofArea * KWP_PER_SQM;
    if (kwp > maxKw) kwp = maxKw;
  }

  return {
    monthlyKwh: Math.round(monthlyKwh),
    recommendedKw: Math.max(0.5, Math.round(kwp * 10) / 10),
  };
}
