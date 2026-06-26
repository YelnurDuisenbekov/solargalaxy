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

import { computeFacets, getPolygonRef, migrateRidgeToEdges } from '../../utils/constructor/roofFacets.js';
import { migrateObstacles } from '../../utils/constructor/obstacles.js';

/** Геометрия крыши не подставляется при входе — только после обводки на карте */
const GEOMETRY_DRAFT_KEYS = [
  'roofPolygon',
  'roofEdges',
  'edgeDraft',
  'roofRectDraft',
  'panels',
  'obstacles',
  'selectedPanelId',
];

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

  /** Режим рисования ребра: perpendicular | free */
  edgeDrawMode: 'perpendicular',

  pitchDeg: 25,

  roofBaseHeightM: 3,

  azimuthDeg: 180,
  /** Стрелка азимута (на карте) */
  azimuthArrow: null,
  azimuthDraft: [],
  /** Переопределение азимута для скатов (facetId → azimuthDeg) */
  facetAzimuthOverrides: {},

  obstacles: [],

  obstacleShape: 'tree',

  obstaclePreset: { heightM: 8, widthM: 4, lengthM: 4, rotationDeg: 0 },

  selectedObstacleId: null,

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

  /** Показ панелей в 3D и тип крепления */
  panelsVisible3d: false,
  panelMountMode: 'racked',
  panelMountTiltDeg: 30,
  panelLayout: 'horizontal',
  /** Зазор между панелями (ряды и столбцы), м */
  panelSpacingM: 0.02,
  /** Отступ от края контура крыши, м */
  panelEdgeMarginM: 1,
  /** Зазор вокруг препятствий при расстановке панелей и добавлении фигур, м */
  obstacleClearanceM: 0.5,
  /** Скат для расстановки панелей (null = все активные) */
  selectedFacetId: null,

  /** Чертёж: выбранные вершина / сторона / карниз односкатной крыши */
  selectedRoofVertexIndex: null,
  selectedRoofEdgeIndex: null,
  slopeEaveEdgeIndex: null,

};



export function loadConstructorState() {
  try {
    const saved = localStorage.getItem('sg-constructor-draft');
    if (!saved) return INITIAL_CONSTRUCTOR_STATE;

    const parsed = JSON.parse(saved);
    for (const key of GEOMETRY_DRAFT_KEYS) delete parsed[key];

    return migrateRidgeToEdges(migratePanelLayout({ ...INITIAL_CONSTRUCTOR_STATE, ...parsed }));
  } catch {
    return INITIAL_CONSTRUCTOR_STATE;
  }
}



function migratePanelLayout(state) {
  if (state.panelLayout) return state;
  const dir = state.panelMountDirection;
  return {
    ...state,
    panelLayout: dir === 'along' || dir === 'vertical' ? 'vertical' : 'horizontal',
  };
}



export function useConstructorDerived(state) {

  return useMemo(() => {

    const module = findModule(state.moduleSku);

    const inverter = findInverter(state.inverterSku);



    let panels = state.panels;

    const facets = state.roofPolygon.length >= 3
      ? computeFacets(state.roofPolygon, state.roofEdges, state.pitchDeg, state.azimuthDeg, state.facetAzimuthOverrides || {})
      : [];

    if (state.roofPolygon.length >= 3) {
      panels = generatePanelGrid({
        roofPolygon: state.roofPolygon,
        roofEdges: state.roofEdges,
        facets,
        pitchDeg: state.pitchDeg,
        module,
        panelLayout: state.panelLayout,
        panelSpacingM: state.panelSpacingM,
        panelEdgeMarginM: state.panelEdgeMarginM,
        selectedFacetId: state.selectedFacetId,
        azimuthDeg: state.azimuthDeg,
        existingPanels: state.panels,
        obstacles: state.obstacles,
        obstacleClearanceM: state.obstacleClearanceM,
      });
    }



    const roofRef = state.roofPolygon.length >= 3
      ? getPolygonRef(state.roofPolygon)
      : null;
    const refLat = roofRef?.refLat ?? state.lat;
    const refLng = roofRef?.refLng ?? state.lng;

    const panelCenters = new Map();

    panels.forEach((p) => {

      if (!p.active) return;

      const cx = p.localX ?? p.col * (module.widthM + 0.02);

      const cy = p.localY ?? p.row * (module.heightM + 0.02);

      panelCenters.set(p.id, { x: cx, y: cy });

    });



    const obstaclesLocal = migrateObstacles(state.obstacles).map((o) => ({

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


