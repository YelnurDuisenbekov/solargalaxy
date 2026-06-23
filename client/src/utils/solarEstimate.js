/** Расчёт потребления и мощности СЭС для калькулятора на сайте */

import { TARIFF_HISTORY } from '../components/TariffChart.jsx';

export const PANEL_EFFICIENCY_PCT = 24;
const BASE_EFFICIENCY = 0.20;
const PEAK_SUN_HOURS = 4.8;
const PERFORMANCE_RATIO = 0.78;
const KWP_PER_SQM = 0.2;
const INSTALL_COST_PER_KW = 280_000;

export function calcMonthlyKwh(monthlyBill, tariffPerKwh) {
  if (!monthlyBill || !tariffPerKwh || tariffPerKwh <= 0) return null;
  return monthlyBill / tariffPerKwh;
}

/** Средний годовой рост тарифа по истории 2019–2026, доля (0.12 = 12%) */
export function avgTariffGrowthRate(segment = 'business') {
  const key = segment === 'household' ? 'household' : 'business';
  let sum = 0;
  for (let i = 1; i < TARIFF_HISTORY.length; i += 1) {
    const prev = TARIFF_HISTORY[i - 1][key];
    sum += (TARIFF_HISTORY[i][key] - prev) / prev;
  }
  return sum / (TARIFF_HISTORY.length - 1);
}

/** Окупаемость при ежегодном росте экономии (рост тарифа) */
export function calcPaybackWithTariffGrowth(installCost, firstYearSaving, growthRate) {
  if (!installCost || !firstYearSaving || firstYearSaving <= 0 || growthRate == null) return null;

  let cumulative = 0;
  let yearSaving = firstYearSaving;
  let years = 0;
  const maxYears = 40;

  while (years < maxYears) {
    years += 1;
    if (cumulative + yearSaving >= installCost) {
      const fraction = (installCost - cumulative) / yearSaving;
      return Math.round((years - 1 + fraction) * 10) / 10;
    }
    cumulative += yearSaving;
    yearSaving *= (1 + growthRate);
  }

  return null;
}

/** Рекомендуемая мощность СЭС, кВт (с учётом КПД модулей 24%) */
export function calcRecommendedKw({ monthlyBill, tariffPerKwh, roofArea, segment = 'business' }) {
  const monthlyKwh = calcMonthlyKwh(monthlyBill, tariffPerKwh);
  if (!monthlyKwh) return null;

  const effFactor = (PANEL_EFFICIENCY_PCT / 100) / BASE_EFFICIENCY;
  const monthlyYieldPerKwp = PEAK_SUN_HOURS * PERFORMANCE_RATIO * 30 * effFactor;
  let kwp = monthlyKwh / monthlyYieldPerKwp;

  if (roofArea && roofArea > 0) {
    const maxKw = roofArea * KWP_PER_SQM;
    if (kwp > maxKw) kwp = maxKw;
  }

  const recommendedKw = Math.max(0.5, Math.round(kwp * 10) / 10);
  const monthlyGenerationKwh = Math.round(recommendedKw * monthlyYieldPerKwp);
  const annualGenerationKwh = Math.round(monthlyGenerationKwh * 12);
  const annualSaving = Math.round(annualGenerationKwh * tariffPerKwh);
  const installCost = Math.round(recommendedKw * INSTALL_COST_PER_KW);
  const paybackYears = annualSaving > 0
    ? Math.round((installCost / annualSaving) * 10) / 10
    : null;

  const tariffGrowthRate = avgTariffGrowthRate(segment);
  const tariffGrowthPct = Math.round(tariffGrowthRate * 1000) / 10;
  const paybackYearsWithTariffGrowth = paybackYears != null
    ? calcPaybackWithTariffGrowth(installCost, annualSaving, tariffGrowthRate)
    : null;

  return {
    monthlyKwh: Math.round(monthlyKwh),
    recommendedKw,
    monthlyGenerationKwh,
    annualGenerationKwh,
    annualSaving,
    installCost,
    paybackYears,
    paybackYearsWithTariffGrowth,
    tariffGrowthPct,
  };
}
