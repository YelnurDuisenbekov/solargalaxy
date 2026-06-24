/** Расчёты конструктора СЭС */

import { avgTariffGrowthRate, calcPaybackWithTariffGrowth } from '../solarEstimate.js';
import { findInverter, findModule } from './equipment.js';
import {
  facetIdForPoint,
  getPolygonRef,
  isPointInActiveRegion,
} from './roofFacets.js';

const PEAK_SUN_HOURS = 4.8;
const PERFORMANCE_RATIO = 0.78;
const PANEL_GAP_M = 0.02;
const MOUNT_COST_PER_PANEL = 12000;
const COMMISSIONING_BASE = 150000;

export function latLngToLocalMeters(lat, lng, refLat, refLng) {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((refLat * Math.PI) / 180);
  return {
    x: (lng - refLng) * mPerDegLng,
    y: (lat - refLat) * mPerDegLat,
  };
}

export function polygonAreaM2(points) {
  if (!points || points.length < 3) return 0;
  const refLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const refLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  const local = points.map((p) => latLngToLocalMeters(p.lat, p.lng, refLat, refLng));
  let sum = 0;
  for (let i = 0; i < local.length; i += 1) {
    const j = (i + 1) % local.length;
    sum += local[i].x * local[j].y - local[j].x * local[i].y;
  }
  return Math.abs(sum) / 2;
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Авто-генерация сетки панелей внутри полигона крыши и активных скатов */
export function generatePanelGrid({ roofPolygon, roofEdges, pitchDeg, module, existingPanels }) {
  if (!roofPolygon || roofPolygon.length < 3) return [];

  const { refLat, refLng } = getPolygonRef(roofPolygon);
  const polyLocal = roofPolygon.map((p) => latLngToLocalMeters(p.lat, p.lng, refLat, refLng));

  const xs = polyLocal.map((p) => p.x);
  const ys = polyLocal.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const pitchFactor = Math.cos((pitchDeg * Math.PI) / 180);
  const effW = module.widthM + PANEL_GAP_M;
  const effH = (module.heightM + PANEL_GAP_M) / (pitchFactor || 1);

  const cols = Math.floor((maxX - minX) / effW);
  const rows = Math.floor((maxY - minY) / effH);
  const panels = [];
  let idCounter = 1;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cx = minX + col * effW + effW / 2;
      const cy = minY + row * effH + effH / 2;
      const center = { x: cx, y: cy };
      if (!pointInPolygon(cx, cy, polyLocal)) continue;
      if (!isPointInActiveRegion(center, roofEdges, refLat, refLng)) continue;

      const existing = existingPanels?.find((p) => p.row === row && p.col === col);
      panels.push({
        id: existing?.id || `p-${idCounter++}`,
        row,
        col,
        localX: cx,
        localY: cy,
        facetId: facetIdForPoint(center, roofEdges, refLat, refLng) || 'whole',
        active: existing?.active ?? true,
        moduleSku: existing?.moduleSku || module.sku,
        stringId: existing?.stringId ?? null,
        shadeLossPct: existing?.shadeLossPct ?? 0,
        note: existing?.note || '',
      });
    }
  }

  return panels;
}

/** Упрощённая оценка затенения от препятствий */
export function calcShadingForPanel(panel, panelCenters, obstacles, pitchDeg) {
  if (!obstacles?.length) return 0;

  const center = panelCenters.get(panel.id);
  if (!center) return panel.shadeLossPct || 0;

  let loss = panel.shadeLossPct || 0;
  const sunElevMin = 18; // зимнее солнце, градусы над горизонтом (упрощённо)
  const sunElevRad = (sunElevMin * Math.PI) / 180;

  obstacles.forEach((obs) => {
    const dx = center.x - obs.x;
    const dy = center.y - obs.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
    const shadowLen = obs.heightM / Math.tan(sunElevRad);
    if (dist < shadowLen + obs.radiusM) {
      const factor = Math.max(0, 1 - dist / (shadowLen + obs.radiusM));
      loss = Math.min(100, loss + factor * 60);
    }
  });

  return Math.round(loss * 10) / 10;
}

/** Распределение активных панелей по строкам MPPT */
export function assignStrings(panels, module, inverter, panelsPerString = 12) {
  const active = panels.filter((p) => p.active);
  const strings = [];
  let stringIdx = 0;

  for (let i = 0; i < active.length; i += panelsPerString) {
    const chunk = active.slice(i, i + panelsPerString);
    const mppt = (stringIdx % inverter.mpptCount) + 1;
    const stringId = `S${stringIdx + 1}`;
    strings.push({
      id: stringId,
      mppt,
      panelIds: chunk.map((p) => p.id),
      panelCount: chunk.length,
      powerW: chunk.reduce((s, p) => s + findModule(p.moduleSku).powerW, 0),
      voc: chunk.length * findModule(chunk[0].moduleSku).voc,
      vmp: chunk.length * findModule(chunk[0].moduleSku).vmp,
      isc: findModule(chunk[0].moduleSku).isc,
      imp: findModule(chunk[0].moduleSku).imp,
    });
    stringIdx += 1;
  }

  const panelsWithStrings = panels.map((p) => {
    const str = strings.find((s) => s.panelIds.includes(p.id));
    return str ? { ...p, stringId: str.id } : p;
  });

  return { strings, panels: panelsWithStrings };
}

/** Расчёт кабельных линий DC */
export function calcCableSchedule(strings, inverter, module, roofToInverterM = 25) {
  return strings.map((str) => {
    const mod = findModule(module.sku);
    const lengthM = Math.round((str.panelCount * 1.2 + roofToInverterM) * 10) / 10;
    const current = mod.imp;
    let section = 4;
    if (current > 32) section = 6;
    if (current > 41) section = 10;
    const vDropPct = Math.round(((2 * current * lengthM * 0.0175) / (section * mod.vmp * str.panelCount)) * 1000) / 10;
    return {
      stringId: str.id,
      mppt: str.mppt,
      type: 'DC PV',
      lengthM,
      sectionMm2: section,
      currentA: Math.round(current * 10) / 10,
      voltageDropPct: vDropPct,
      ok: vDropPct <= 2,
    };
  });
}

export function calcProjectSummary(state) {
  const module = findModule(state.moduleSku);
  const inverter = findInverter(state.inverterSku);
  const activePanels = state.panels.filter((p) => p.active);
  const totalKw = Math.round(activePanels.reduce((s, p) => s + findModule(p.moduleSku).powerW, 0) / 100) / 10;
  const avgShade = activePanels.length
    ? activePanels.reduce((s, p) => s + (p.shadeLossPct || 0), 0) / activePanels.length
    : 0;
  const shadeFactor = 1 - avgShade / 100;
  const annualKwh = Math.round(totalKw * PEAK_SUN_HOURS * PERFORMANCE_RATIO * 365 * shadeFactor);
  const roofArea = polygonAreaM2(state.roofPolygon);

  const equipmentCost = activePanels.length * module.price
    + inverter.price
    + activePanels.length * MOUNT_COST_PER_PANEL;
  const cableCost = (state.cables || []).reduce((s, c) => s + c.lengthM * (c.sectionMm2 === 4 ? 780 : c.sectionMm2 === 6 ? 1100 : 1800), 0);
  const totalCapex = equipmentCost + cableCost + COMMISSIONING_BASE;

  const tariff = state.tariffPerKwh || 35;
  const annualSaving = Math.round(annualKwh * tariff);
  const paybackYears = annualSaving > 0 ? Math.round((totalCapex / annualSaving) * 10) / 10 : null;
  const growth = avgTariffGrowthRate('business');
  const paybackWithGrowth = paybackYears != null
    ? calcPaybackWithTariffGrowth(totalCapex, annualSaving, growth)
    : null;

  let npv20 = -totalCapex;
  let yearSaving = annualSaving;
  for (let y = 1; y <= 20; y += 1) {
    npv20 += yearSaving / Math.pow(1.1, y);
    yearSaving *= 1 + growth;
  }

  return {
    module,
    inverter,
    activePanelCount: activePanels.length,
    totalKw,
    roofAreaM2: Math.round(roofArea),
    avgShadeLossPct: Math.round(avgShade * 10) / 10,
    annualKwh,
    selfConsumptionPct: state.selfConsumptionPct ?? 70,
    gridExportKwh: Math.round(annualKwh * (1 - (state.selfConsumptionPct ?? 70) / 100)),
    equipmentCost,
    cableCost,
    commissioning: COMMISSIONING_BASE,
    totalCapex,
    tariff,
    annualSaving,
    paybackYears,
    paybackWithGrowth,
    npv20: Math.round(npv20),
    lcoe: annualKwh > 0 ? Math.round((totalCapex / (annualKwh * 20)) * 100) / 100 : 0,
  };
}

/** Пакет для ОЖТ / диспетчеризации / подключения к сети */
export function buildGridExportPackage(state, summary, strings, cables) {
  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    project: {
      name: state.projectName || 'СЭС без названия',
      address: state.address || '',
      coordinates: { lat: state.lat, lng: state.lng },
      gridConnection: state.gridMode || 'net-metering',
      dispatchAccess: state.dispatchAccess ?? false,
    },
    site: {
      roofAreaM2: summary.roofAreaM2,
      pitchDeg: state.pitchDeg,
      azimuthDeg: state.azimuthDeg,
      roofEdges: state.roofEdges || [],
      polygon: state.roofPolygon,
      obstacles: state.obstacles,
    },
    installation: {
      installedCapacityKw: summary.totalKw,
      annualYieldKwh: summary.annualKwh,
      shadingLossPct: summary.avgShadeLossPct,
      module: { sku: summary.module.sku, name: summary.module.name, count: summary.activePanelCount },
      inverter: {
        sku: summary.inverter.sku,
        name: summary.inverter.name,
        capacityKw: summary.inverter.capacityKw,
        type: summary.inverter.type,
        phases: summary.inverter.phases,
      },
      strings: strings.map((s) => ({
        id: s.id,
        mppt: s.mppt,
        panels: s.panelCount,
        powerW: s.powerW,
        voc: Math.round(s.voc),
        vmp: Math.round(s.vmp),
        isc: s.isc,
        imp: s.imp,
      })),
      dcCables: cables,
    },
    finance: {
      capexKzt: summary.totalCapex,
      tariffKztPerKwh: summary.tariff,
      annualSavingKzt: summary.annualSaving,
      paybackYears: summary.paybackYears,
      gridExportKwh: summary.gridExportKwh,
    },
    ojt: {
      applicant: state.applicantName || '',
      iinBin: state.iinBin || '',
      connectionPoint: state.connectionPoint || 'Точка присоединения — уточняется',
      meteringScheme: state.meteringScheme || 'двусторонний учёт',
      protectionScheme: 'АВР, УЗО, разрядники AC/DC',
      notes: state.ohtNotes || '',
    },
  };
}
