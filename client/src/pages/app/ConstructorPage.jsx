import { useCallback, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Reveal } from '../../components/motion/ScrollReveal';
import ConstructorMapView from '../../components/constructor/ConstructorMapView';
import ConstructorAddressSearch from '../../components/constructor/ConstructorAddressSearch';
import ConstructorInstructions from '../../components/constructor/ConstructorInstructions';
import Constructor3D from '../../components/constructor/Constructor3D';
import { useObstacleEditShortcuts } from '../../components/constructor/useObstacleEditShortcuts';
import DecimalField from '../../components/constructor/DecimalField';
import {
  INITIAL_CONSTRUCTOR_STATE,
  downloadJson,
  loadConstructorState,
  useConstructorDerived,
} from '../../components/constructor/useConstructor';
import { INVERTERS, MODULES } from '../../utils/constructor/equipment';
import { findModule } from '../../utils/constructor/equipment.js';
import { latLngToLocalMeters } from '../../utils/constructor/calc.js';
import {
  azimuthDegFromArrow,
  createPerpendicularEdgeAtPoint,
  extendEdgeToPerimeter,
  isPointNearPerimeter,
  snapPointToPerimeter,
} from '../../utils/constructor/roofFacets.js';
import {
  azimuthFromEaveEdge,
  findNearestRoofEdgeIndex,
  moveRoofVertex,
  setRoofEdgeLengthM,
  setRoofVertexAngleDeg,
} from '../../utils/constructor/roofGeometryEdit.js';
import {
  applyObstacleMetricsPatch,
  defaultObstacle,
  finalizeObstacleMetrics,
  getShapeDefaults,
  isCircularShape,
  migrateObstacle,
  OBSTACLE_SHAPES,
  OBSTACLE_CLEARANCE_M,
  nudgeObstaclePlacement,
} from '../../utils/constructor/obstacles.js';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import './app-pages.css';
import '../../components/constructor/ConstructorPage.css';

const TABS = [
  { id: 'site', label: 'Участок и крыша' },
  { id: 'panels', label: 'Панели' },
  { id: 'wiring', label: 'Инвертор и кабели' },
  { id: 'shading', label: 'Затенение' },
  { id: 'finance', label: 'Финансы' },
  { id: 'export', label: 'ОЖТ / сеть' },
];

export default function ConstructorPage() {
  const { isAdmin, hasPerm } = useAuth();
  const [state, setState] = useState(loadConstructorState);
  const [tab, setTab] = useState('site');
  const [helpOpen, setHelpOpen] = useState(true);
  const { ready: googleReady, hasKey: hasGoogleKey } = useGoogleMaps();

  const derived = useConstructorDerived(state);
  const { panels, strings, cables, summary, gridExport, gridRows, gridCols, facets } = derived;
  const selectedPanel = panels.find((p) => p.id === state.selectedPanelId);
  const selectedObstacle = (state.obstacles || []).find((o) => o.id === state.selectedObstacleId);
  const obstacleMetrics = selectedObstacle || {
    shape: state.obstacleShape || 'tree',
    ...(state.obstaclePreset || getShapeDefaults(state.obstacleShape || 'tree')),
    rotationDeg: state.obstaclePreset?.rotationDeg ?? 0,
  };
  const obstacleMetricsIsPreset = !selectedObstacle;
  const obstacleIsRound = isCircularShape(obstacleMetrics.shape);

  const onMutateObstacles = useCallback((recipe) => {
    setState((s) => (typeof recipe === 'function' ? recipe(s) : recipe));
  }, []);

  const { mutateObstacles, beginObstacleGesture } = useObstacleEditShortcuts({
    enabled: tab === 'site',
    obstacles: state.obstacles,
    selectedObstacleId: state.selectedObstacleId,
    roofPolygon: state.roofPolygon,
    onMutateObstacles,
  });

  if (!isAdmin && !hasPerm('admin.full')) {
    return <Navigate to="/app" replace />;
  }

  const patch = (partial) => setState((s) => ({ ...s, ...partial }));

  const invalidatePanels = (s) => ({ ...s, panels: [] });

  const handleRoofVertexDrag = (index, lat, lng) => {
    setState((s) => invalidatePanels({
      ...s,
      roofPolygon: moveRoofVertex(s.roofPolygon, index, lat, lng),
      selectedRoofVertexIndex: index,
    }));
  };

  const handleRoofVertexSelect = (index) => {
    patch({ selectedRoofVertexIndex: index, selectedRoofEdgeIndex: null });
  };

  const handleRoofEdgeSelect = (index) => {
    setState((s) => {
      const next = {
        ...s,
        selectedRoofEdgeIndex: index,
        selectedRoofVertexIndex: null,
      };
      if (s.drawMode === 'azimuth' && !(s.roofEdges?.length)) {
        const az = azimuthFromEaveEdge(s.roofPolygon, index);
        if (az != null) {
          next.slopeEaveEdgeIndex = index;
          next.azimuthDeg = az;
          next.facetAzimuthOverrides = { ...(s.facetAzimuthOverrides || {}), whole: az };
          next.azimuthArrow = null;
          next.azimuthDraft = [];
          next.panels = [];
        }
      }
      return next;
    });
  };

  const handleRoofEdgeLengthChange = (edgeIndex, value) => {
    const v = Number(value);
    if (Number.isNaN(v) || v < 0.1) return;
    setState((s) => invalidatePanels({
      ...s,
      roofPolygon: setRoofEdgeLengthM(s.roofPolygon, edgeIndex, v),
      selectedRoofEdgeIndex: edgeIndex,
    }));
  };

  const handleRoofVertexAngleChange = (vertexIndex, value) => {
    const v = Number(value);
    if (Number.isNaN(v) || v < 1 || v > 179) return;
    setState((s) => invalidatePanels({
      ...s,
      roofPolygon: setRoofVertexAngleDeg(s.roofPolygon, vertexIndex, v),
      selectedRoofVertexIndex: vertexIndex,
    }));
  };

  const saveDraft = () => {
    localStorage.setItem('sg-constructor-draft', JSON.stringify(state));
  };

  const handleMapClick = ({ lat, lng }) => {
    setState((s) => {
      const point = { lat, lng };

      if (s.drawMode === 'refine') {
        const edgeIdx = findNearestRoofEdgeIndex(point, s.roofPolygon, 10);
        if (edgeIdx != null) {
          return { ...s, selectedRoofEdgeIndex: edgeIdx, selectedRoofVertexIndex: null };
        }
        return s;
      }

      if (s.drawMode === 'azimuth' && !(s.roofEdges?.length)) {
        const edgeIdx = findNearestRoofEdgeIndex(point, s.roofPolygon, 12);
        if (edgeIdx == null) return s;
        const az = azimuthFromEaveEdge(s.roofPolygon, edgeIdx);
        if (az == null) return s;
        return {
          ...s,
          slopeEaveEdgeIndex: edgeIdx,
          selectedRoofEdgeIndex: edgeIdx,
          azimuthDeg: az,
          facetAzimuthOverrides: { ...(s.facetAzimuthOverrides || {}), whole: az },
          azimuthArrow: null,
          azimuthDraft: [],
          panels: [],
        };
      }

      if (s.drawMode === 'roof') {
        if (s.roofShape === 'rectangle') {
          const draft = [...(s.roofRectDraft || []), point];
          if (draft.length < 2) {
            return { ...s, roofRectDraft: draft, panels: [] };
          }
          const [a, b] = draft;
          const rect = [
            { lat: a.lat, lng: a.lng },
            { lat: a.lat, lng: b.lng },
            { lat: b.lat, lng: b.lng },
            { lat: b.lat, lng: a.lng },
          ];
          return { ...s, roofPolygon: rect, roofRectDraft: [], panels: [] };
        }
        return { ...s, roofPolygon: [...s.roofPolygon, point], panels: [] };
      }

      if (s.drawMode === 'edge') {
        const hasContour = s.roofPolygon.length >= 3;
        if (!hasContour) return s;

        const edgeMode = s.edgeDrawMode || 'perpendicular';

        if (edgeMode === 'perpendicular') {
          if (!isPointNearPerimeter(point, s.roofPolygon)) return s;
          const edgeLine = createPerpendicularEdgeAtPoint(point, s.roofPolygon);
          if (!edgeLine) return s;
          const newEdge = {
            id: `edge-${Date.now()}`,
            from: edgeLine.from,
            to: edgeLine.to,
            sideAActive: true,
            sideBActive: true,
          };
          return {
            ...s,
            roofEdges: [...(s.roofEdges || []), newEdge],
            edgeDraft: [],
            panels: [],
          };
        }

        const snapped = snapPointToPerimeter(point, s.roofPolygon);
        const draft = [...(s.edgeDraft || []), snapped];
        if (draft.length >= 2) {
          const { from, to } = extendEdgeToPerimeter(draft[0], draft[1], s.roofPolygon);
          const newEdge = {
            id: `edge-${Date.now()}`,
            from,
            to,
            sideAActive: true,
            sideBActive: true,
          };
          return {
            ...s,
            roofEdges: [...(s.roofEdges || []), newEdge],
            edgeDraft: [],
            panels: [],
          };
        }
        return { ...s, edgeDraft: draft };
      }

      if (s.drawMode === 'azimuth') {
        const hasContour = s.roofPolygon.length >= 3;
        if (!hasContour) return s;

        const click = point;
        const refLat = s.roofPolygon.reduce((sum, p) => sum + p.lat, 0) / s.roofPolygon.length;
        const refLng = s.roofPolygon.reduce((sum, p) => sum + p.lng, 0) / s.roofPolygon.length;
        const distM = (a, b) => {
          const la = latLngToLocalMeters(a.lat, a.lng, refLat, refLng);
          const lb = latLngToLocalMeters(b.lat, b.lng, refLat, refLng);
          return Math.hypot(lb.x - la.x, lb.y - la.y);
        };

        const draft = Array.isArray(s.azimuthDraft) ? s.azimuthDraft : [];
        const arrow = s.azimuthArrow;

        // если второй клик — завершаем стрелку
        if (draft.length === 1) {
          const from = draft[0];
          const to = click;
          const az = azimuthDegFromArrow(from, to, s.roofPolygon);
          if (az == null) return { ...s, azimuthDraft: [] };

          const nextOverrides = { ...(s.facetAzimuthOverrides || {}) };
          if (s.roofEdges?.length && s.selectedFacetId) {
            nextOverrides[s.selectedFacetId] = az;
          } else {
            nextOverrides.whole = az;
          }

          return {
            ...s,
            azimuthDeg: az,
            azimuthArrow: { from, to },
            azimuthDraft: [],
            facetAzimuthOverrides: nextOverrides,
            panels: [],
          };
        }

        // если стрелка уже есть — кликом правим направление (по наконечнику)
        if (arrow?.from && arrow?.to) {
          const nearTip = distM(click, arrow.to) < 2.5;
          const nearTail = distM(click, arrow.from) < 2.5;
          if (nearTip) {
            const from = arrow.from;
            const to = click;
            const az = azimuthDegFromArrow(from, to, s.roofPolygon);
            if (az == null) return s;

            const nextOverrides = { ...(s.facetAzimuthOverrides || {}) };
            if (s.roofEdges?.length && s.selectedFacetId) nextOverrides[s.selectedFacetId] = az;
            else nextOverrides.whole = az;

            return {
              ...s,
              azimuthDeg: az,
              azimuthArrow: { from, to },
              facetAzimuthOverrides: nextOverrides,
              panels: [],
            };
          }
          if (nearTail) {
            return { ...s, azimuthDraft: [click] };
          }
        }

        // первый клик — старт новой стрелки
        return { ...s, azimuthDraft: [click] };
      }

      return s;
    });
  };

  const handleObstacleAdd = ({ lat, lng }) => {
    mutateObstacles((s) => {
      const shape = s.obstacleShape || 'tree';
      const preset = finalizeObstacleMetrics({
        shape,
        ...(s.obstaclePreset || getShapeDefaults(shape)),
        rotationDeg: s.obstaclePreset?.rotationDeg ?? 0,
      });
      const placed = nudgeObstaclePlacement(
        lat,
        lng,
        s.obstacles,
        s.roofPolygon,
        s.obstacleClearanceM ?? OBSTACLE_CLEARANCE_M,
      );
      const obs = defaultObstacle(shape, placed.lat, placed.lng, preset);
      return {
        ...s,
        obstacles: [...(s.obstacles || []), obs],
        selectedObstacleId: obs.id,
      };
    });
  };

  const handleObstacleSelect = (id) => {
    const obs = (state.obstacles || []).find((o) => o.id === id);
    setTab('site');
    patch({
      selectedObstacleId: id,
      drawMode: 'obstacle',
      ...(obs ? { obstacleShape: obs.shape } : {}),
    });
  };

  const selectObstacleShape = (shapeId) => {
    const d = getShapeDefaults(shapeId);
    patch({
      obstacleShape: shapeId,
      drawMode: 'obstacle',
      selectedObstacleId: null,
      obstaclePreset: {
        heightM: d.heightM,
        widthM: d.widthM,
        lengthM: d.lengthM,
        rotationDeg: 0,
      },
    });
  };

  const patchObstacleMetrics = (fields, { commit = false } = {}) => {
    const apply = (base) => (commit ? finalizeObstacleMetrics(applyObstacleMetricsPatch(base, fields)) : applyObstacleMetricsPatch(base, fields));

    if (selectedObstacle) {
      const applyToState = (s) => ({
        ...s,
        obstacles: (s.obstacles || []).map((o) => (
          o.id === selectedObstacle.id ? apply(o) : o
        )),
      });
      if (commit) {
        mutateObstacles(applyToState);
      } else {
        setState(applyToState);
      }
      return;
    }
    patch({
      obstaclePreset: apply({ ...state.obstaclePreset, shape: state.obstacleShape }),
    });
  };

  const commitObstacleField = (fields) => {
    patchObstacleMetrics(fields, { commit: true });
  };

  const handleObstacleSelect3d = (id) => {
    const obs = (state.obstacles || []).find((o) => o.id === id);
    patch({
      selectedObstacleId: id,
      ...(obs ? { obstacleShape: obs.shape } : {}),
    });
  };

  const selectObstacleShape3d = (shapeId) => {
    const d = getShapeDefaults(shapeId);
    patch({
      obstacleShape: shapeId,
      selectedObstacleId: null,
      obstaclePreset: {
        heightM: d.heightM,
        widthM: d.widthM,
        lengthM: d.lengthM,
        rotationDeg: 0,
      },
    });
  };

  const handleObstacleUpdate = (updated, { transient = false } = {}) => {
    const obs = migrateObstacle(updated);
    setTab('site');
    const recipe = (s) => ({
      ...s,
      drawMode: 'obstacle',
      obstacleShape: obs.shape,
      obstacles: (s.obstacles || []).map((o) => (o.id === obs.id ? obs : o)),
      selectedObstacleId: obs.id,
    });
    if (transient) {
      setState(recipe);
      return;
    }
    mutateObstacles(recipe);
  };

  const handleObstacleGestureStart = () => {
    beginObstacleGesture();
  };

  const removeObstacle = (id) => {
    mutateObstacles((s) => ({
      ...s,
      obstacles: (s.obstacles || []).filter((o) => o.id !== id),
      selectedObstacleId: s.selectedObstacleId === id ? null : s.selectedObstacleId,
    }));
  };

  const undoLastCorner = () => {
    setState((s) => {
      if (s.roofRectDraft?.length) {
        return { ...s, roofRectDraft: s.roofRectDraft.slice(0, -1), panels: [] };
      }
      if (s.roofPolygon.length) {
        return { ...s, roofPolygon: s.roofPolygon.slice(0, -1), panels: [] };
      }
      return s;
    });
  };

  const handleLocationSelect = (loc) => {
    setState((s) => ({
      ...s,
      countryCode: loc.countryCode,
      city: loc.city || '',
      address: loc.address || loc.formattedAddress || '',
      formattedAddress: loc.formattedAddress || '',
      lat: loc.lat,
      lng: loc.lng,
      mapFlyKey: (s.mapFlyKey || 0) + 1,
      roofPolygon: [],
      roofRectDraft: [],
      roofEdges: [],
      edgeDraft: [],
      panels: [],
    }));
  };

  const updatePanel = (id, changes) => {
    patch({
      panels: panels.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    });
  };

  const formatMoney = (n) => `${(n || 0).toLocaleString('ru-RU')} ₸`;

  return (
    <div className="constructor-page">
      <Reveal>
        <h1 className="app-page-title">Конструктор СЭС</h1>
        <p className="app-page-desc">
          Прототип проектировщика: карта, 3D-крыша, расстановка панелей, строки MPPT, кабели, затенение,
          финансовый отчёт и пакет для ОЖТ / подключения к сети. Не связан с CRM и проектами — черновик в браузере.
        </p>
      </Reveal>

      <div className="constructor-toolbar card app-section-card">
        <div className="constructor-toolbar__row">
          <input
            className="input"
            placeholder="Название проекта"
            value={state.projectName}
            onChange={(e) => patch({ projectName: e.target.value })}
          />
          <span className="constructor-kpi-address">
            {[state.city, state.address].filter(Boolean).join(', ') || 'Адрес не выбран'}
          </span>
          <button type="button" className="btn btn--outline-dark" onClick={saveDraft}>Сохранить черновик</button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => downloadJson(gridExport, `senergy-grid-${Date.now()}.json`)}
          >
            Экспорт JSON
          </button>
        </div>
        <div className="constructor-kpi">
          <span><strong>{summary.activePanelCount}</strong> панелей</span>
          <span><strong>{summary.totalKw}</strong> кВт</span>
          <span><strong>{summary.annualKwh.toLocaleString('ru-RU')}</strong> кВт·ч/год</span>
          <span><strong>{formatMoney(summary.totalCapex)}</strong> CAPEX</span>
        </div>
      </div>

      <div className="app-tabs constructor-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`app-tab${tab === t.id ? ' app-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'site' && (
        <div className="constructor-stack">
          <ConstructorInstructions open={helpOpen} onToggle={() => setHelpOpen((v) => !v)} />

          <div className="card app-section-card constructor-section">
            <h2 className="constructor-section-title">Параметры карты</h2>
            <p className="constructor-section-desc">
              Поиск места, слой карты и обводка крыши на спутнике
              {hasGoogleKey && googleReady && ' · Google Maps активен'}
            </p>

            <ConstructorAddressSearch
              countryCode={state.countryCode || 'kz'}
              city={state.city}
              address={state.address}
              lat={state.lat}
              lng={state.lng}
              onPatch={patch}
              onLocationSelect={handleLocationSelect}
            />
            {state.formattedAddress && (
              <p className="constructor-selected-address">На карте: <strong>{state.formattedAddress}</strong></p>
            )}

            <div className="constructor-subsection">
              <h3 className="constructor-subsection__title">Слой карты</h3>
              <div className="constructor-draw-modes">
                {[
                  ['hybrid', 'Гибрид (Google)'],
                  ['roadmap', 'Схема'],
                  ['satellite', 'Спутник'],
                ].map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    className={`btn btn--sm${(state.mapStyle || 'hybrid') === type ? ' btn--primary' : ' btn--outline-dark'}`}
                    onClick={() => patch({ mapStyle: type })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="constructor-subsection">
              <h3 className="constructor-subsection__title">Инструменты на карте</h3>
              <div className="constructor-draw-modes">
                {[
                  ['roof', '① Углы крыши'],
                  ['refine', '② Чертёж'],
                  ['edge', '③ Рёбра крыши'],
                  ['azimuth', '④ Азимут'],
                  ['obstacle', '⑤ Препятствие'],
                  ['view', 'Просмотр'],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={`btn btn--sm${state.drawMode === mode ? ' btn--primary' : ' btn--outline-dark'}`}
                    disabled={mode === 'refine' && state.roofPolygon.length < 3}
                    title={mode === 'refine' && state.roofPolygon.length < 3 ? 'Сначала обведите контур крыши' : undefined}
                    onClick={() => {
                      if (mode === 'obstacle') {
                        selectObstacleShape(state.obstacleShape || 'tree');
                      } else {
                        patch({
                          drawMode: mode,
                          edgeDraft: [],
                          azimuthDraft: [],
                          roofRectDraft: [],
                          selectedRoofVertexIndex: null,
                          selectedRoofEdgeIndex: null,
                        });
                      }
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {state.drawMode === 'refine' && (
                <p className="constructor-active-hint">
                  <strong>Чертёж:</strong> тяните углы · <strong>L</strong> — длина, м · <strong>∠</strong> — угол, °.
                  Введите значение и нажмите <strong>Enter</strong> (или клик вне поля).
                </p>
              )}
              {state.drawMode === 'azimuth' && !(state.roofEdges?.length) && (
                <p className="constructor-active-hint">
                  <strong>Односкатная крыша:</strong> кликните по стороне-карнизу (жёлтая подсветка) — скат идёт внутрь контура, перпендикулярно ей.
                  {state.slopeEaveEdgeIndex != null && ` · Карниз: сторона ${state.slopeEaveEdgeIndex + 1} · азимут ${state.azimuthDeg}°`}
                </p>
              )}
              {state.drawMode === 'azimuth' && (state.roofEdges?.length > 0) && (
                <p className="constructor-active-hint">
                  <strong>Многоскатная крыша:</strong> 1-й клик — хвост стрелки, 2-й — направление ската.
                  {' '}
                  Сейчас: <strong>{state.azimuthDeg}°</strong> (0°=север, 180°=юг)
                </p>
              )}
              {state.drawMode === 'roof' && (
                <div className="constructor-draw-modes" style={{ marginTop: 8 }}>
                  {[
                    ['rectangle', 'Прямоугольник (2 клика → 4 угла)'],
                    ['free', 'Свободный контур (каждый угол)'],
                  ].map(([shape, label]) => (
                    <button
                      key={shape}
                      type="button"
                      className={`btn btn--sm${(state.roofShape || 'rectangle') === shape ? ' btn--primary' : ' btn--outline-dark'}`}
                      onClick={() => patch({ roofShape: shape, roofPolygon: [], roofRectDraft: [], panels: [] })}
                    >
                      {label}
                    </button>
                  ))}
                  <button type="button" className="btn btn--sm btn--outline-dark" onClick={undoLastCorner} disabled={!state.roofPolygon.length && !state.roofRectDraft?.length}>
                    Отменить точку
                  </button>
                  <button type="button" className="btn btn--sm btn--outline-dark" onClick={() => patch({ roofPolygon: [], roofRectDraft: [], panels: [], roofEdges: [], edgeDraft: [] })}>
                    Очистить контур
                  </button>
                </div>
              )}
              {state.drawMode === 'roof' && (state.roofShape || 'rectangle') === 'rectangle' && (
                <p className="constructor-active-hint">
                  <strong>Прямоугольник:</strong> клик 1 — первый угол, клик 2 — противоположный угол.
                  Остальные 3 угла проставятся автоматически.
                  {state.roofRectDraft?.length === 1 && ' · Ждём 2-й клик…'}
                  {state.roofPolygon.length >= 4 && ' · Контур готов ✓'}
                </p>
              )}
              {state.drawMode === 'roof' && state.roofShape === 'free' && (
                <p className="constructor-active-hint">
                  <strong>Свободный контур:</strong> кликайте по каждому углу крыши. Точек: <strong>{state.roofPolygon.length}</strong>
                  {state.roofPolygon.length >= 3 ? ' · Контур готов ✓' : ' · минимум 3'}
                </p>
              )}
              {state.drawMode === 'obstacle' && (
                <>
                  <div className="constructor-draw-modes" style={{ marginTop: 8 }}>
                    {OBSTACLE_SHAPES.map(({ id, label, icon }) => (
                      <button
                        key={id}
                        type="button"
                        className={`btn btn--sm${
                          (obstacleMetricsIsPreset ? state.obstacleShape === id : selectedObstacle?.shape === id)
                            ? ' btn--primary'
                            : ' btn--outline-dark'
                        }`}
                        onClick={() => selectObstacleShape(id)}
                      >
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                  <p className="constructor-active-hint">
                    <strong>Препятствие:</strong> выберите тип — ниже метрики.
                    Клик на карте — новая фигура. Тяните фигуру для перемещения, маркеры — для размера.
                    Отступ от препятствий: настраивается в 3D → вкладка «Параметры».
                    Ctrl+C копировать · Ctrl+V вставить · Ctrl+Z отменить
                    {(state.obstacles?.length || 0) > 0 && ` · Всего: ${state.obstacles.length}`}
                  </p>

                  <div className="constructor-obstacle-editor">
                    <h3 className="constructor-subsection__title">
                      {obstacleMetricsIsPreset ? 'Новое препятствие — метрики' : 'Выбранное препятствие'}
                    </h3>
                    <div className="constructor-form-grid">
                      <label>
                        Высота, м
                        <DecimalField
                          className="input input--plain-num"
                          value={obstacleMetrics.heightM ?? 0}
                          min={0.1}
                          max={200}
                          decimals={2}
                          title="Enter — применить"
                          onCommit={(v) => commitObstacleField({ heightM: v })}
                        />
                      </label>
                      {obstacleIsRound ? (
                        <label>
                          Диаметр, м
                          <DecimalField
                            className="input input--plain-num"
                            value={obstacleMetrics.widthM ?? obstacleMetrics.lengthM ?? 0}
                            min={0.1}
                            max={200}
                            decimals={2}
                            title="Enter — применить"
                            onCommit={(v) => commitObstacleField({ widthM: v, lengthM: v })}
                          />
                        </label>
                      ) : (
                        <>
                          <label>
                            Ширина, м
                            <DecimalField
                              className="input input--plain-num"
                              value={obstacleMetrics.widthM ?? 0}
                              min={0.1}
                              max={200}
                              decimals={2}
                              title="Enter — применить"
                              onCommit={(v) => commitObstacleField({ widthM: v })}
                            />
                          </label>
                          <label>
                            Длина, м
                            <DecimalField
                              className="input input--plain-num"
                              value={obstacleMetrics.lengthM ?? 0}
                              min={0.1}
                              max={200}
                              decimals={2}
                              title="Enter — применить"
                              onCommit={(v) => commitObstacleField({ lengthM: v })}
                            />
                          </label>
                        </>
                      )}
                      {!obstacleMetricsIsPreset && (
                        <>
                          <label>
                            Широта
                            <DecimalField
                              className="input input--plain-num"
                              value={obstacleMetrics.lat ?? 0}
                              min={-90}
                              max={90}
                              decimals={6}
                              title="Enter — применить"
                              onCommit={(v) => commitObstacleField({ lat: v })}
                            />
                          </label>
                          <label>
                            Долгота
                            <DecimalField
                              className="input input--plain-num"
                              value={obstacleMetrics.lng ?? 0}
                              min={-180}
                              max={180}
                              decimals={6}
                              title="Enter — применить"
                              onCommit={(v) => commitObstacleField({ lng: v })}
                            />
                          </label>
                        </>
                      )}
                      {!obstacleIsRound && (
                        <label>
                          Поворот, °
                          <DecimalField
                            className="input input--plain-num"
                            value={obstacleMetrics.rotationDeg ?? 0}
                            min={0}
                            max={359}
                            decimals={0}
                            title="Enter — применить"
                            onCommit={(v) => commitObstacleField({ rotationDeg: ((Math.round(v) % 360) + 360) % 360 })}
                          />
                        </label>
                      )}
                </div>
                    {!obstacleMetricsIsPreset && (
                      <button
                        type="button"
                        className="btn btn--sm btn--outline-dark"
                        style={{ marginTop: 10 }}
                        onClick={() => removeObstacle(selectedObstacle.id)}
                      >
                        Удалить препятствие
                      </button>
                    )}
                  </div>

                  {(state.obstacles?.length || 0) > 0 && (
                    <ul className="constructor-obstacle-list">
                      {(state.obstacles || []).map((obs) => {
                        const shapeLabel = OBSTACLE_SHAPES.find((s) => s.id === obs.shape)?.label || obs.shape;
                        const selected = obs.id === state.selectedObstacleId;
                        return (
                          <li key={obs.id} className={selected ? 'constructor-obstacle-item--selected' : ''}>
                            <button
                              type="button"
                              className="constructor-obstacle-item__pick"
                              onClick={() => handleObstacleSelect(obs.id)}
                            >
                              <strong>{shapeLabel}</strong>
                              <span className="constructor-obstacle-item__meta">
                                h {obs.heightM} · {isCircularShape(obs.shape) ? `⌀ ${obs.widthM}` : `${obs.widthM}×${obs.lengthM}`} м
                              </span>
                            </button>
                            <button type="button" className="btn btn--sm btn--outline-dark" onClick={() => removeObstacle(obs.id)}>
                              ✕
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
              {state.drawMode === 'edge' && (
                <>
                  <div className="constructor-draw-modes" style={{ marginTop: 8 }}>
                    {[
                      ['perpendicular', '⊥ Перпендикулярный'],
                      ['free', '↗ Свободный'],
                    ].map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        className={`btn btn--sm${(state.edgeDrawMode || 'perpendicular') === mode ? ' btn--primary' : ' btn--outline-dark'}`}
                        onClick={() => patch({ edgeDrawMode: mode, edgeDraft: [] })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="constructor-active-hint">
                    <strong>Рёбра крыши:</strong>
                    {(state.edgeDrawMode || 'perpendicular') === 'perpendicular'
                      ? ' клик по стороне контура — ребро перпендикулярно стене, через всю крышу.'
                      : ' два клика задают направление — линия продлевается до периметра.'}
                    {(state.edgeDrawMode || 'perpendicular') === 'free' && state.edgeDraft?.length === 1 && ' · Ждём 2-й клик…'}
                    {(state.roofEdges?.length || 0) > 0 && ` · Рёбер: ${state.roofEdges.length}`}
                  </p>
                </>
              )}
              {(state.roofEdges?.length || 0) > 0 && (
                <ul className="constructor-edge-list">
                  {(state.roofEdges || []).map((edge, idx) => (
                    <li key={edge.id} className="constructor-edge-item">
                      <span className="constructor-edge-item__label">Ребро {idx + 1}</span>
                      <label className="constructor-check">
                        <input
                          type="checkbox"
                          checked={edge.sideAActive !== false}
                          onChange={(e) => patch({
                            roofEdges: state.roofEdges.map((ed) => (
                              ed.id === edge.id ? { ...ed, sideAActive: e.target.checked } : ed
                            )),
                            panels: [],
                          })}
                        />
                        Сторона А — панели
                      </label>
                      <label className="constructor-check">
                        <input
                          type="checkbox"
                          checked={edge.sideBActive !== false}
                          onChange={(e) => patch({
                            roofEdges: state.roofEdges.map((ed) => (
                              ed.id === edge.id ? { ...ed, sideBActive: e.target.checked } : ed
                            )),
                            panels: [],
                          })}
                        />
                        Сторона Б — панели
                      </label>
                      <button
                        type="button"
                        className="btn btn--sm btn--outline-dark"
                        onClick={() => patch({
                          roofEdges: state.roofEdges.filter((ed) => ed.id !== edge.id),
                          panels: [],
                        })}
                      >
                        Удалить
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="constructor-map-3d-split">
            <div className="card app-section-card constructor-map-column">
              <h2 className="constructor-section-title">Карта участка</h2>
              <ConstructorMapView
                lat={state.lat}
                lng={state.lng}
                roofPolygon={state.roofPolygon}
                roofRectDraft={state.roofRectDraft}
                roofEdges={state.roofEdges}
                edgeDraft={state.edgeDraft}
                azimuthArrow={state.azimuthArrow}
                azimuthDraft={state.azimuthDraft}
                obstacles={state.obstacles}
                selectedObstacleId={state.selectedObstacleId}
                drawMode={state.drawMode}
                mapStyle={state.mapStyle || 'hybrid'}
                flyToKey={state.mapFlyKey}
                selectedRoofVertexIndex={state.selectedRoofVertexIndex}
                selectedRoofEdgeIndex={state.selectedRoofEdgeIndex}
              slopeEaveEdgeIndex={state.slopeEaveEdgeIndex}
              pitchDeg={state.pitchDeg}
              azimuthDeg={state.azimuthDeg}
              facetAzimuthOverrides={state.facetAzimuthOverrides || {}}
              selectedFacetId={state.selectedFacetId}
              onMapClick={handleMapClick}
                onObstacleAdd={handleObstacleAdd}
                onObstacleSelect={handleObstacleSelect}
                onObstacleUpdate={handleObstacleUpdate}
                onObstacleGestureStart={handleObstacleGestureStart}
                onRoofVertexDrag={handleRoofVertexDrag}
                onRoofVertexSelect={handleRoofVertexSelect}
                onRoofEdgeSelect={handleRoofEdgeSelect}
                onRoofEdgeLengthChange={handleRoofEdgeLengthChange}
                onRoofVertexAngleChange={handleRoofVertexAngleChange}
              />
            </div>

            <div className="card app-section-card constructor-3d-column">
              <h2 className="constructor-section-title">3D-модель</h2>
              <p className="constructor-section-desc">Панели, препятствия и параметры крыши — изменения видны сразу на карте</p>
              <Constructor3D
                roofPolygon={state.roofPolygon}
                roofEdges={state.roofEdges}
                pitchDeg={state.pitchDeg}
                azimuthDeg={state.azimuthDeg}
                facetAzimuthOverrides={state.facetAzimuthOverrides || {}}
                roofBaseHeightM={state.roofBaseHeightM ?? 0}
                obstacles={state.obstacles}
                hasRoof={state.roofPolygon.length >= 3}
                panels={panels}
                module={derived.module}
                panelsVisible3d={state.panelsVisible3d}
                panelMountMode={state.panelMountMode}
                panelMountTiltDeg={state.panelMountTiltDeg}
                panelLayout={state.panelLayout}
                moduleSku={state.moduleSku}
                facets={facets}
                selectedFacetId={state.selectedFacetId}
                panelEdgeMarginM={state.panelEdgeMarginM}
                panelSpacingM={state.panelSpacingM}
                obstacleClearanceM={state.obstacleClearanceM}
                roofVertexCount={state.roofPolygon.length}
                roofEdgeCount={state.roofEdges?.length || 0}
                roofAreaM2={derived.roofAreaM2}
                activePanelCount={summary.activePanelCount}
                onParamsPatch={patch}
                onFacetSelect={(facetId) => patch({ selectedFacetId: facetId })}
                onAddPanels={() => patch({ panelsVisible3d: true })}
                onMountModeChange={(mode) => patch({ panelMountMode: mode })}
                onMountTiltChange={(panelMountTiltDeg) => patch({ panelMountTiltDeg })}
                onLayoutChange={(panelLayout) => patch({ panelLayout, panels: [] })}
                onModuleChange={(moduleSku) => patch({ moduleSku, panels: [] })}
                onEdgeSideChange={(edgeId, side, active) => patch({
                  roofEdges: state.roofEdges.map((ed) => (
                    ed.id === edgeId
                      ? { ...ed, [side === 'a' ? 'sideAActive' : 'sideBActive']: active }
                      : ed
                  )),
                })}
                obstacleShape={state.obstacleShape}
                obstaclePreset={state.obstaclePreset}
                obstacleMetrics={obstacleMetrics}
                obstacleMetricsIsPreset={obstacleMetricsIsPreset}
                selectedObstacleId={state.selectedObstacleId}
                onObstacleAdd={handleObstacleAdd}
                onObstacleSelect={handleObstacleSelect3d}
                onObstacleUpdate={handleObstacleUpdate}
                onObstacleGestureStart={handleObstacleGestureStart}
                onObstacleShapeSelect={selectObstacleShape3d}
                onObstacleFieldCommit={commitObstacleField}
                onObstacleRemove={removeObstacle}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'panels' && (
        <div className="constructor-grid-2">
          <div className="card app-section-card">
            <h2 className="app-section-card__title">Оборудование</h2>
            <div className="constructor-form-grid">
              <label>
                Модуль
                <select className="input" value={state.moduleSku} onChange={(e) => patch({ moduleSku: e.target.value, panels: [] })}>
                  {MODULES.map((m) => <option key={m.sku} value={m.sku}>{m.name} — {m.powerW}W</option>)}
                </select>
              </label>
              <label>
                Инвертор
                <select className="input" value={state.inverterSku} onChange={(e) => patch({ inverterSku: e.target.value })}>
                  {INVERTERS.map((i) => <option key={i.sku} value={i.sku}>{i.name} — {i.capacityKw} kW</option>)}
                </select>
              </label>
              <label>
                Панелей в строке (DC)
                <DecimalField
                  className="input input--plain-num"
                  value={state.panelsPerString}
                  min={6}
                  max={24}
                  decimals={0}
                  title="Enter — применить"
                  onCommit={(v) => patch({ panelsPerString: v })}
                />
              </label>
            </div>
            <button type="button" className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => patch({ panels: [] })}>
              Пересчитать сетку по контуру
            </button>
          </div>
          <div className="card app-section-card">
            <h2 className="app-section-card__title">Редактор панелей</h2>
            <p className="app-page-desc">Клик по ячейке — выбор. Можно отключить, сменить модуль, задать потери от тени.</p>
            <div className="constructor-panel-grid" style={{ '--cols': gridCols }}>
              {panels.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`constructor-panel-cell${!p.active ? ' constructor-panel-cell--off' : ''}${state.selectedPanelId === p.id ? ' constructor-panel-cell--selected' : ''}${p.shadeLossPct > 10 ? ' constructor-panel-cell--shade' : ''}`}
                  title={`${p.id} · строка ${p.stringId || '—'} · тень ${p.shadeLossPct}%`}
                  onClick={() => patch({ selectedPanelId: p.id })}
                >
                  {p.active ? findModule(p.moduleSku).powerW : '×'}
                </button>
              ))}
            </div>
            {selectedPanel && (
              <div className="constructor-panel-editor">
                <h3>Панель {selectedPanel.id}</h3>
                <label className="constructor-check">
                  <input type="checkbox" checked={selectedPanel.active} onChange={(e) => updatePanel(selectedPanel.id, { active: e.target.checked })} />
                  Активна
                </label>
                <label>
                  Модуль
                  <select className="input" value={selectedPanel.moduleSku} onChange={(e) => updatePanel(selectedPanel.id, { moduleSku: e.target.value })}>
                    {MODULES.map((m) => <option key={m.sku} value={m.sku}>{m.name}</option>)}
                  </select>
                </label>
                <label>
                  Потери от тени, %
                  <DecimalField
                    className="input input--plain-num"
                    value={selectedPanel.shadeLossPct}
                    min={0}
                    max={100}
                    decimals={0}
                    title="Enter — применить"
                    onCommit={(v) => updatePanel(selectedPanel.id, { shadeLossPct: v })}
                  />
                </label>
                <label>
                  Примечание
                  <input className="input" value={selectedPanel.note || ''} onChange={(e) => updatePanel(selectedPanel.id, { note: e.target.value })} />
                </label>
                <p>Строка: <strong>{selectedPanel.stringId || '—'}</strong></p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'wiring' && (
        <div className="constructor-stack">
          <div className="card app-section-card">
            <h2 className="app-section-card__title">Подключение к инвертору</h2>
            <dl className="app-dl">
              <dt>Инвертор</dt><dd>{derived.inverter.name} ({derived.inverter.capacityKw} kW, {derived.inverter.phases}-ф)</dd>
              <dt>MPPT</dt><dd>{derived.inverter.mpptCount} трекера</dd>
              <dt>DC макс.</dt><dd>{derived.inverter.maxDcKw} kW · установлено {summary.totalKw} kW</dd>
              <dt>Загрузка DC/AC</dt><dd>{Math.round((summary.totalKw / derived.inverter.capacityKw) * 100)}%</dd>
            </dl>
            <table className="app-table">
              <thead>
                <tr><th>Строка</th><th>MPPT</th><th>Панелей</th><th>P, W</th><th>Voc</th><th>Vmp</th><th>Imp</th></tr>
              </thead>
              <tbody>
                {strings.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td><td>{s.mppt}</td><td>{s.panelCount}</td><td>{s.powerW}</td>
                    <td>{Math.round(s.voc)} V</td><td>{Math.round(s.vmp)} V</td><td>{s.imp} A</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card app-section-card">
            <h2 className="app-section-card__title">Кабельный журнал (DC)</h2>
            <label>
              Расстояние крыша → инвертор, м
              <DecimalField
                className="input input--plain-num"
                value={state.roofToInverterM}
                min={5}
                max={200}
                decimals={0}
                title="Enter — применить"
                onCommit={(v) => patch({ roofToInverterM: v })}
              />
            </label>
            <table className="app-table" style={{ marginTop: 12 }}>
              <thead>
                <tr><th>Строка</th><th>Тип</th><th>Длина, м</th><th>Сечение</th><th>Ток, A</th><th>Падение U, %</th><th>OK</th></tr>
              </thead>
              <tbody>
                {cables.map((c) => (
                  <tr key={c.stringId}>
                    <td>{c.stringId}</td><td>{c.type}</td><td>{c.lengthM}</td><td>{c.sectionMm2} mm²</td>
                    <td>{c.currentA}</td><td>{c.voltageDropPct}%</td><td>{c.ok ? '✓' : '⚠'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'shading' && (
        <div className="constructor-stack">
          <div className="card app-section-card">
            <h2 className="app-section-card__title">Затенение</h2>
            <p className="app-page-desc">
              Препятствия добавляются на вкладке «Участок и крыша» (режим «③ Препятствие»).
              Метрики и позиция редактируются там при выборе типа или клике по фигуре на карте.
            </p>
            <p>Средние потери от тени: <strong>{summary.avgShadeLossPct}%</strong></p>
            <p className="constructor-params__note">
              Препятствий на карте: <strong>{state.obstacles?.length || 0}</strong>
            </p>
          </div>

          {panels.filter((p) => p.shadeLossPct > 5).length > 0 && (
            <div className="card app-section-card">
              <h3 className="constructor-subsection__title">Панели с заметной тенью</h3>
              <table className="app-table">
                <thead><tr><th>Панель</th><th>Строка</th><th>Потери, %</th></tr></thead>
                <tbody>
                  {panels.filter((p) => p.active && p.shadeLossPct > 5).map((p) => (
                    <tr key={p.id}><td>{p.id}</td><td>{p.stringId}</td><td>{p.shadeLossPct}%</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'finance' && (
        <div className="constructor-grid-2">
          <div className="card app-section-card">
            <h2 className="app-section-card__title">Финансовый отчёт</h2>
            <div className="constructor-form-grid">
              <label>
                Тариф, ₸/кВт·ч
                <DecimalField
                  className="input input--plain-num"
                  value={state.tariffPerKwh}
                  min={0}
                  decimals={2}
                  title="Enter — применить"
                  onCommit={(v) => patch({ tariffPerKwh: v })}
                />
              </label>
              <label>
                Самопотребление, %
                <DecimalField
                  className="input input--plain-num"
                  value={state.selfConsumptionPct}
                  min={0}
                  max={100}
                  decimals={0}
                  title="Enter — применить"
                  onCommit={(v) => patch({ selfConsumptionPct: v })}
                />
              </label>
            </div>
            <dl className="app-dl" style={{ marginTop: 16 }}>
              <dt>Оборудование</dt><dd>{formatMoney(summary.equipmentCost)}</dd>
              <dt>Кабели</dt><dd>{formatMoney(summary.cableCost)}</dd>
              <dt>ПНР</dt><dd>{formatMoney(summary.commissioning)}</dd>
              <dt>CAPEX итого</dt><dd><strong>{formatMoney(summary.totalCapex)}</strong></dd>
              <dt>Выработка / год</dt><dd>{summary.annualKwh.toLocaleString('ru-RU')} кВт·ч</dd>
              <dt>Экономия / год</dt><dd>{formatMoney(summary.annualSaving)}</dd>
              <dt>Окупаемость</dt><dd>{summary.paybackYears ?? '—'} лет</dd>
              <dt>С учётом роста тарифа</dt><dd>{summary.paybackWithGrowth ?? '—'} лет</dd>
              <dt>NPV 20 лет (10%)</dt><dd>{formatMoney(summary.npv20)}</dd>
              <dt>LCOE</dt><dd>{summary.lcoe} ₸/кВт·ч</dd>
              <dt>Продажа в сеть</dt><dd>{summary.gridExportKwh.toLocaleString('ru-RU')} кВт·ч/год</dd>
            </dl>
          </div>
          <div className="card app-section-card constructor-print-block">
            <h2 className="app-section-card__title">Сводка для клиента</h2>
            <p><strong>{state.projectName || 'Проект СЭС'}</strong></p>
            <p>{state.address || 'Адрес не указан'}</p>
            <p>Мощность: {summary.totalKw} kW ({summary.activePanelCount} × {summary.module.powerW}W)</p>
            <p>Инвертор: {summary.inverter.name}</p>
            <p>Выработка: ~{summary.annualKwh.toLocaleString('ru-RU')} kWh/год</p>
            <p>Инвестиции: {formatMoney(summary.totalCapex)}</p>
            <p>Окупаемость: ~{summary.paybackYears} лет</p>
            <button type="button" className="btn btn--outline-dark" onClick={() => window.print()}>Печать / PDF</button>
          </div>
        </div>
      )}

      {tab === 'export' && (
        <div className="card app-section-card">
          <h2 className="app-section-card__title">Пакет для ОЖТ, диспетчеризации и подключения к сети</h2>
          <p className="app-page-desc">
            Структурированные данные для подачи в сетевую компанию и настройки SCADA/диспетчеризации.
            Формат JSON — основа; позже добавим PDF и интеграцию с API оператора.
          </p>
          <div className="constructor-form-grid">
            <label>Заявитель<input className="input" value={state.applicantName} onChange={(e) => patch({ applicantName: e.target.value })} /></label>
            <label>ИИН/БИН<input className="input" value={state.iinBin} onChange={(e) => patch({ iinBin: e.target.value })} /></label>
            <label>Точка присоединения<input className="input" value={state.connectionPoint} onChange={(e) => patch({ connectionPoint: e.target.value })} /></label>
            <label>
              Режим
              <select className="input" value={state.gridMode} onChange={(e) => patch({ gridMode: e.target.value })}>
                <option value="net-metering">Зелёный тариф / net-metering</option>
                <option value="surplus">Продажа излишков</option>
                <option value="full-export">Полная выдача в сеть</option>
              </select>
            </label>
            <label>
              Схема учёта
              <input className="input" value={state.meteringScheme} onChange={(e) => patch({ meteringScheme: e.target.value })} />
            </label>
            <label className="constructor-check">
              <input type="checkbox" checked={state.dispatchAccess} onChange={(e) => patch({ dispatchAccess: e.target.checked })} />
              Требуется доступ к диспетчеризации (SCADA)
            </label>
          </div>
          <label style={{ display: 'block', marginTop: 12 }}>
            Примечания для ОЖТ
            <textarea className="input" rows={3} value={state.ohtNotes} onChange={(e) => patch({ ohtNotes: e.target.value })} />
          </label>
          <pre className="constructor-json-preview">{JSON.stringify(gridExport, null, 2)}</pre>
          <button type="button" className="btn btn--primary" onClick={() => downloadJson(gridExport, `grid-package-${Date.now()}.json`)}>
            Скачать пакет JSON
          </button>
        </div>
      )}
    </div>
  );
}
