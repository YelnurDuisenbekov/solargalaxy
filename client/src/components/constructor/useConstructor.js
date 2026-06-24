import { useMemo } from 'react';
import {
  assignStrings,
  buildGridExportPackage,
  calcCableSchedule,
  calcProjectSummary,
  calcShadingForPanel,
  generatePanelGrid,
  latLngToLocalMeters,
  polygonAreaM2,
} from '../../utils/constructor/calc.js';
import { DEFAULT_INVERTER, DEFAULT_MODULE, findInverter, findModule } from '../../utils/constructor/equipment.js';
import { computeFacets, migrateRidgeToEdges } from '../../utils/constructor/roofFacets.js';

export const INITIAL_CONSTRUCTOR_STATE = {
  projectName: '',
  countryCode: 'kz',
  city: '',
  address: '',
  formattedAddress: '',
  mapFlyKey: 0,
  mapStyle: 'hybrid',
  applicantName: '',
  iinBin: '',
  connectionPoint: '',
  ohtNotes: '',
  lat: 43.238949,
  lng: 76.945465,
  roofPolygon: [],
  roofEdges: [],
  edgeDraft: [],
  pitchDeg: 25,
  azimuthDeg: 180,
  obstacles: [],
  moduleSku: DEFAULT_MODULE.sku,
  inverterSku: DEFAULT_INVERTER.sku,
  panels: [],
  panelsPerString: 12,
  roofToInverterM: 25,
  tariffPerKwh: 35,
  selfConsumptionPct: 70,
  gridMode: 'net-metering',
  dispatchAccess: false,
  meteringScheme: 'двусторонний учёт',
  drawMode: 'roof',
  roofShape: 'rectangle',
  roofRectDraft: [],
  selectedPanelId: null,
};

export function loadConstructorState() {
  try {
    const saved = localStorage.getItem('sg-constructor-draft');
    if (!saved) return INITIAL_CONSTRUCTOR_STATE;
    return migrateRidgeToEdges({ ...INITIAL_CONSTRUCTOR_STATE, ...JSON.parse(saved) });
  } catch {
    return INITIAL_CONSTRUCTOR_STATE;
  }
}

export function useConstructorDerived(state) {
  return useMemo(() => {
    const module = findModule(state.moduleSku);
    const inverter = findInverter(state.inverterSku);

    let panels = state.panels;
    if (state.roofPolygon.length >= 3) {
      panels = generatePanelGrid({
        roofPolygon: state.roofPolygon,
        roofEdges: state.roofEdges,
        pitchDeg: state.pitchDeg,
        module,
        existingPanels: state.panels,
      });
    }

    const facets = state.roofPolygon.length >= 3
      ? computeFacets(state.roofPolygon, state.roofEdges, state.pitchDeg, state.azimuthDeg)
      : [];

    const refLat = state.lat;
    const refLng = state.lng;
    const panelCenters = new Map();
    panels.forEach((p) => {
      if (!p.active) return;
      const cx = p.localX ?? p.col * (module.widthM + 0.02);
      const cy = p.localY ?? p.row * (module.heightM + 0.02);
      panelCenters.set(p.id, { x: cx, y: cy });
    });

    const obstaclesLocal = (state.obstacles || []).map((o) => ({
      ...o,
      ...latLngToLocalMeters(o.lat, o.lng, refLat, refLng),
    }));

    panels = panels.map((p) => ({
      ...p,
      shadeLossPct: calcShadingForPanel(p, panelCenters, obstaclesLocal, state.pitchDeg),
    }));

    const { strings, panels: wiredPanels } = assignStrings(
      panels,
      module,
      inverter,
      state.panelsPerString,
    );
    const cables = calcCableSchedule(strings, inverter, module, state.roofToInverterM);

    const summary = calcProjectSummary({
      ...state,
      panels: wiredPanels,
      cables,
      moduleSku: state.moduleSku,
      inverterSku: state.inverterSku,
    });

    const gridExport = buildGridExportPackage(state, summary, strings, cables);

    const maxRow = panels.reduce((m, p) => Math.max(m, p.row), 0) + 1;
    const maxCol = panels.reduce((m, p) => Math.max(m, p.col), 0) + 1;

    return {
      module,
      inverter,
      panels: wiredPanels,
      strings,
      cables,
      summary,
      gridExport,
      facets,
      roofAreaM2: polygonAreaM2(state.roofPolygon),
      gridRows: maxRow || 6,
      gridCols: maxCol || 10,
    };
  }, [state]);
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
