/** Расчёты конструктора СЭС */

import { avgTariffGrowthRate, calcPaybackWithTariffGrowth } from '../solarEstimate.js';
import { findInverter, findModule } from './equipment.js';
import {
  getPolygonRef,
} from './roofFacets.js';
import { obstacleShadowRadius } from './obstacles.js';

const PEAK_SUN_HOURS = 4.8;
const PERFORMANCE_RATIO = 0.78;
const DEFAULT_PANEL_SPACING_M = 0.02;
const DEFAULT_PANEL_EDGE_MARGIN_M = 1;
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

export function localMetersToLatLng(x, y, refLat, refLng) {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((refLat * Math.PI) / 180);
  return {
    lat: refLat + y / mPerDegLat,
    lng: refLng + x / mPerDegLng,
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

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}

function distanceToPolygonBoundary(x, y, polygon) {
  let minD = Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    minD = Math.min(minD, pointToSegmentDistance(x, y, a.x, a.y, b.x, b.y));
  }
  return minD;
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

function azimuthToVectors(azimuthDeg) {
  const rad = (azimuthDeg * Math.PI) / 180;
  const downX = Math.sin(rad);
  const downY = Math.cos(rad);
  const acrossX = Math.cos(rad);
  const acrossY = -Math.sin(rad);
  return { downX, downY, acrossX, acrossY };
}

function localToFacetUV(x, y, azimuthDeg) {
  const { downX, downY, acrossX, acrossY } = azimuthToVectors(azimuthDeg);
  return { u: x * acrossX + y * acrossY, v: x * downX + y * downY };
}

function facetUVToLocal(u, v, azimuthDeg) {
  const { downX, downY, acrossX, acrossY } = azimuthToVectors(azimuthDeg);
  return { x: u * acrossX + v * downX, y: u * acrossY + v * downY };
}

function panelFitsOnFacet(u, v, facetPoly, roofPoly, margin, halfAcross, halfAlongPlan, azimuthDeg) {
  const corners = [
    { u: u - halfAcross, v: v - halfAlongPlan },
    { u: u + halfAcross, v: v - halfAlongPlan },
    { u: u + halfAcross, v: v + halfAlongPlan },
    { u: u - halfAcross, v: v + halfAlongPlan },
  ];
  return corners.every((c) => {
    const xy = facetUVToLocal(c.u, c.v, azimuthDeg);
    if (!pointInPolygon(xy.x, xy.y, facetPoly)) return false;
    if (distanceToPolygonBoundary(xy.x, xy.y, roofPoly) < margin - 1e-6) return false;
    return true;
  });
}

function generatePanelsOnFacet({
  facet,
  roofPolyLocal,
  module,
  panelLayout,
  pitchDeg,
  panelSpacingM,
  panelEdgeMarginM,
  existingPanels,
  idStart,
}) {
  const poly = facet.polygon;
  if (!poly || poly.length < 3) return [];

  const pitchRad = (pitchDeg * Math.PI) / 180;
  const pitchFactor = Math.cos(pitchRad) || 1;
  const isVertical = panelLayout === 'vertical' || panelLayout === 'along';
  const acrossM = isVertical ? module.heightM : module.widthM;
  const alongM = isVertical ? module.widthM : module.heightM;
  const gap = panelSpacingM != null && !Number.isNaN(Number(panelSpacingM))
    ? Math.max(0, Number(panelSpacingM))
    : DEFAULT_PANEL_SPACING_M;
  const margin = panelEdgeMarginM != null && !Number.isNaN(Number(panelEdgeMarginM))
    ? Math.max(0, Number(panelEdgeMarginM))
    : DEFAULT_PANEL_EDGE_MARGIN_M;

  const halfAcross = acrossM / 2;
  const halfAlongPlan = (alongM * pitchFactor) / 2;
  const effAcross = acrossM + gap;
  const effAlongPlan = (alongM + gap) * pitchFactor;

  const azimuthDeg = facet.azimuthDeg ?? 180;
  const uvPoly = poly.map((p) => localToFacetUV(p.x, p.y, azimuthDeg));
  const us = uvPoly.map((p) => p.u);
  const vs = uvPoly.map((p) => p.v);
  const minU = Math.min(...us);
  const maxU = Math.max(...us);
  const minV = Math.min(...vs);
  const maxV = Math.max(...vs);

  const uStart = minU + margin + halfAcross;
  const uEnd = maxU - margin - halfAcross;
  const vStart = minV + margin + halfAlongPlan;
  const vEnd = maxV - margin - halfAlongPlan;
  if (uStart > uEnd || vStart > vEnd) return [];

  const panels = [];
  let nextId = idStart;
  let row = 0;

  for (let v = vStart; v <= vEnd + 1e-9; v += effAlongPlan, row += 1) {
    let col = 0;
    for (let u = uStart; u <= uEnd + 1e-9; u += effAcross, col += 1) {
      if (!panelFitsOnFacet(u, v, poly, roofPolyLocal, margin, halfAcross, halfAlongPlan, azimuthDeg)) continue;

      const xy = facetUVToLocal(u, v, azimuthDeg);
      const existing = existingPanels?.find(
        (p) => p.facetId === facet.id && p.row === row && p.col === col,
      );
      panels.push({
        id: existing?.id || `p-${nextId++}`,
        row,
        col,
        localX: xy.x,
        localY: xy.y,
        facetId: facet.id,
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

/** Авто-генерация сетки панелей внутри полигона крыши и активных скатов */
export function generatePanelGrid({
  roofPolygon,
  roofEdges,
  facets,
  pitchDeg,
  module,
  panelLayout,
  panelSpacingM,
  panelEdgeMarginM,
  selectedFacetId,
  azimuthDeg,
  existingPanels,
}) {
  if (!roofPolygon || roofPolygon.length < 3) return [];

  const { refLat, refLng } = getPolygonRef(roofPolygon);
  const roofPolyLocal = roofPolygon.map((p) => latLngToLocalMeters(p.lat, p.lng, refLat, refLng));

  const allFacets = facets?.length
    ? facets
    : [{
      id: 'whole',
      polygon: roofPolyLocal,
      azimuthDeg: azimuthDeg ?? 180,
      active: true,
    }];

  const targetFacets = allFacets.filter((f) => {
    if (f.active === false) return false;
    if (selectedFacetId && selectedFacetId !== f.id) return false;
    return true;
  });

  let preserved = [];
  if (selectedFacetId) {
    preserved = (existingPanels || []).filter((p) => {
      if (p.facetId === selectedFacetId) return false;
      const f = allFacets.find((x) => x.id === p.facetId);
      return !f || f.active !== false;
    });
  }

  const facetExisting = selectedFacetId
    ? (existingPanels || []).filter((p) => p.facetId === selectedFacetId)
    : (existingPanels || []);

  let nextId = 1;
  (existingPanels || []).forEach((p) => {
    const m = String(p.id).match(/^p-(\d+)$/);
    if (m) nextId = Math.max(nextId, Number(m[1]) + 1);
  });

  const newPanels = [];
  targetFacets.forEach((facet) => {
    const batch = generatePanelsOnFacet({
      facet,
      roofPolyLocal,
      module,
      panelLayout,
      pitchDeg,
      panelSpacingM,
      panelEdgeMarginM,
      existingPanels: facetExisting,
      idStart: nextId,
    });
    batch.forEach((p) => {
      const m = String(p.id).match(/^p-(\d+)$/);
      if (m) nextId = Math.max(nextId, Number(m[1]) + 1);
    });
    newPanels.push(...batch);
  });

  if (selectedFacetId) {
    return [...preserved, ...newPanels].filter((p) => {
      const f = allFacets.find((x) => x.id === p.facetId);
      return !f || f.active !== false;
    });
  }
  return newPanels;
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
    const radiusM = obstacleShadowRadius(obs);
    const shadowLen = obs.heightM / Math.tan(sunElevRad);
    if (dist < shadowLen + radiusM) {
      const factor = Math.max(0, 1 - dist / (shadowLen + radiusM));
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
