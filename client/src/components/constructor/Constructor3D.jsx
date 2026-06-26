import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildConstructorSceneGroup, disposeObject } from '../../utils/constructor/buildConstructorSceneGroup.js';
import { localMetersToLatLng } from '../../utils/constructor/calc.js';
import { OBSTACLE_SHAPES, isCircularShape, OBSTACLE_CLEARANCE_M } from '../../utils/constructor/obstacles.js';
import DecimalField from './DecimalField.jsx';
import { MODULES } from '../../utils/constructor/equipment.js';

const SCENE_BG = 0x1e293b;
const TOOL_TABS = [
  { id: 'panels', label: 'Панели' },
  { id: 'obstacles', label: 'Препятствия' },
  { id: 'params', label: 'Параметры' },
];

function fitCamera(camera, controls, object, padding = 1.35) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 3) * padding;
  controls.target.copy(center);
  camera.position.set(
    center.x + radius * 0.75,
    center.y + Math.max(radius * 0.55, size.y * 0.8 + 2),
    center.z + radius * 0.75,
  );
  camera.lookAt(center);
}

export default function Constructor3D({
  roofPolygon,
  roofEdges,
  pitchDeg,
  azimuthDeg,
  facetAzimuthOverrides,
  roofBaseHeightM,
  obstacles,
  hasRoof,
  panels,
  module,
  panelsVisible3d,
  panelMountMode,
  panelMountTiltDeg,
  panelLayout,
  moduleSku,
  onAddPanels,
  onMountModeChange,
  onMountTiltChange,
  onLayoutChange,
  onModuleChange,
  onEdgeSideChange,
  facets,
  selectedFacetId,
  onFacetSelect,
  obstacleShape,
  obstaclePreset,
  obstacleMetrics,
  obstacleMetricsIsPreset,
  selectedObstacleId,
  onObstacleAdd,
  onObstacleSelect,
  onObstacleUpdate,
  onObstacleGestureStart,
  onObstacleShapeSelect,
  onObstacleFieldCommit,
  onObstacleRemove,
  panelEdgeMarginM,
  panelSpacingM,
  obstacleClearanceM,
  roofVertexCount,
  roofEdgeCount,
  roofAreaM2,
  activePanelCount,
  onParamsPatch,
}) {
  const rootRef = useRef(null);
  const wrapRef = useRef(null);
  const viewportRef = useRef(null);
  const engineRef = useRef(null);
  const geomFingerprintRef = useRef('');
  const toolTabRef = useRef('panels');
  const callbacksRef = useRef({});
  const obstaclesRef = useRef(obstacles);
  const obstacleDragRef = useRef(null);
  const obstacleDragMovedRef = useRef(false);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const [ready, setReady] = useState(false);
  const [meshInfo, setMeshInfo] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [toolTab, setToolTab] = useState('panels');

  toolTabRef.current = toolTab;
  obstaclesRef.current = obstacles;
  callbacksRef.current = {
    onObstacleAdd,
    onObstacleSelect,
    onObstacleUpdate,
    onObstacleGestureStart,
  };

  const obstacleIsRound = isCircularShape(obstacleMetrics?.shape || obstacleShape || 'tree');

  const toggleFullscreen = useCallback(async () => {
    const root = rootRef.current;
    if (!root) return;
    try {
      if (!document.fullscreenElement) {
        await root.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(document.fullscreenElement === rootRef.current);
      requestAnimationFrame(() => engineRef.current?.resize());
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BG);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 800);
    camera.position.set(12, 9, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.className = 'constructor-3d__canvas';
    viewport.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 120;

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(-10, 18, 12);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdde4ff, 0.35);
    fill.position.set(10, 6, -8);
    scene.add(fill);

    const content = new THREE.Group();
    scene.add(content);

    const resize = () => {
      const w = Math.max(viewport.clientWidth, 200);
      const h = Math.max(viewport.clientHeight, 200);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(viewport);
    resize();

    let frameId = 0;
    const updateCompass = () => {
      const azimuth = controls.getAzimuthalAngle();
      const deg = -THREE.MathUtils.radToDeg(azimuth);
      viewport.style.setProperty('--compass-rot', `${deg}deg`);
    };

    controls.addEventListener('change', updateCompass);

    const setMouseFromEvent = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
    };

    const onPointerDown = (event) => {
      if (toolTabRef.current !== 'obstacles' || event.button !== 0) return;
      const engine = engineRef.current;
      if (!engine?.pickObstacleMeshes?.length) return;

      setMouseFromEvent(event);
      const obsHits = raycasterRef.current.intersectObjects(engine.pickObstacleMeshes, true);
      if (!obsHits.length) return;

      let node = obsHits[0].object;
      while (node && !node.userData?.obstacleId) node = node.parent;
      if (!node?.userData?.obstacleId) return;

      obstacleDragMovedRef.current = false;
      obstacleDragRef.current = { id: node.userData.obstacleId };
      controls.enabled = false;
      callbacksRef.current.onObstacleGestureStart?.();
      callbacksRef.current.onObstacleSelect?.(node.userData.obstacleId);
      event.preventDefault();
      event.stopPropagation();
    };

    const onPointerMove = (event) => {
      const drag = obstacleDragRef.current;
      if (!drag) return;
      const engine = engineRef.current;
      if (!engine?.pickRoofMeshes?.length || !engine.sceneGeo) return;

      setMouseFromEvent(event);
      const roofHits = raycasterRef.current.intersectObjects(engine.pickRoofMeshes, false);
      if (!roofHits.length) return;

      obstacleDragMovedRef.current = true;
      const { x, z } = roofHits[0].point;
      const ll = localMetersToLatLng(x, z, engine.sceneGeo.refLat, engine.sceneGeo.refLng);
      const obs = obstaclesRef.current?.find((o) => o.id === drag.id);
      if (!obs) return;
      callbacksRef.current.onObstacleUpdate?.({ ...obs, lat: ll.lat, lng: ll.lng }, { transient: true });
    };

    const finishObstacleDrag = () => {
      if (!obstacleDragRef.current) return;
      obstacleDragRef.current = null;
      controls.enabled = true;
      window.setTimeout(() => { obstacleDragMovedRef.current = false; }, 0);
    };

    const onCanvasClick = (event) => {
      if (obstacleDragMovedRef.current) return;
      if (toolTabRef.current !== 'obstacles') return;
      const engine = engineRef.current;
      if (!engine?.pickRoofMeshes?.length || !engine.sceneGeo) return;

      setMouseFromEvent(event);

      const obsHits = raycasterRef.current.intersectObjects(engine.pickObstacleMeshes || [], true);
      if (obsHits.length) {
        let node = obsHits[0].object;
        while (node && !node.userData?.obstacleId) node = node.parent;
        if (node?.userData?.obstacleId) {
          callbacksRef.current.onObstacleSelect?.(node.userData.obstacleId);
          return;
        }
      }

      const roofHits = raycasterRef.current.intersectObjects(engine.pickRoofMeshes, false);
      if (!roofHits.length) return;
      const { x, z } = roofHits[0].point;
      const ll = localMetersToLatLng(x, z, engine.sceneGeo.refLat, engine.sceneGeo.refLng);
      callbacksRef.current.onObstacleAdd?.({ lat: ll.lat, lng: ll.lng });
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', finishObstacleDrag);
    renderer.domElement.addEventListener('pointercancel', finishObstacleDrag);
    renderer.domElement.addEventListener('click', onCanvasClick);

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      updateCompass();
      renderer.render(scene, camera);
    };
    animate();
    updateCompass();

    engineRef.current = { scene, camera, renderer, controls, content, resize, updateCompass };
    setReady(true);

    return () => {
      setReady(false);
      cancelAnimationFrame(frameId);
      controls.removeEventListener('change', updateCompass);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', finishObstacleDrag);
      renderer.domElement.removeEventListener('pointercancel', finishObstacleDrag);
      renderer.domElement.removeEventListener('click', onCanvasClick);
      ro.disconnect();
      controls.dispose();
      disposeObject(content);
      renderer.dispose();
      if (viewport.contains(renderer.domElement)) viewport.removeChild(renderer.domElement);
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = engineRef.current?.renderer?.domElement;
    if (!canvas) return;
    canvas.classList.toggle('constructor-3d__canvas--place', toolTab === 'obstacles');
    canvas.classList.toggle('constructor-3d__canvas--drag-obs', toolTab === 'obstacles');
  }, [toolTab, ready]);

  useEffect(() => {
    if (!ready) return undefined;
    const id = window.requestAnimationFrame(() => engineRef.current?.resize());
    const t = window.setTimeout(() => engineRef.current?.resize(), 150);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, [ready, toolTab]);

  useEffect(() => {
    if (!ready) return;
    const engine = engineRef.current;
    if (!engine) return;

    const { content, camera, controls } = engine;
    while (content.children.length) {
      const child = content.children[0];
      content.remove(child);
      disposeObject(child);
    }

    if (!hasRoof || roofPolygon.length < 3) {
      setMeshInfo(null);
      geomFingerprintRef.current = '';
      controls.target.set(0, 0, 0);
      camera.position.set(12, 9, 14);
      camera.lookAt(0, 0, 0);
      engine.resize();
      return;
    }

    const geomFingerprint = [
      roofPolygon.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|'),
      (roofEdges || []).map((e) => `${e.id}:${e.from?.lat},${e.from?.lng}-${e.to?.lat},${e.to?.lng}:${e.sideAActive !== false}:${e.sideBActive !== false}`).join('|'),
      pitchDeg,
      azimuthDeg,
      roofBaseHeightM,
    ].join('::');
    const shouldFitCamera = geomFingerprint !== geomFingerprintRef.current;

    const built = buildConstructorSceneGroup({
      roofPolygon,
      roofEdges,
      pitchDeg,
      azimuthDeg,
      facetAzimuthOverrides,
      roofBaseHeightM,
      obstacles,
      panels,
      module,
      panelsVisible3d,
      panelMountMode,
      panelMountTiltDeg,
      panelLayout,
      selectedFacetId,
      selectedObstacleId,
      showGround: true,
    });
    if (!built) {
      setMeshInfo(null);
      engine.pickRoofMeshes = [];
      engine.pickObstacleMeshes = [];
      engine.sceneGeo = null;
      return;
    }

    const { group: sceneGroup, data, meshInfo: info, pickRoofMeshes, pickObstacleMeshes } = built;
    setMeshInfo(info);
    engine.pickRoofMeshes = pickRoofMeshes;
    engine.pickObstacleMeshes = pickObstacleMeshes;
    engine.sceneGeo = { refLat: data.refLat, refLng: data.refLng };

    content.add(sceneGroup);

    const box = new THREE.Box3().setFromObject(sceneGroup);
    if (shouldFitCamera && !box.isEmpty() && data.maxHeight > 0.1) {
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const span = Math.max(size.x, size.z, 4);
      controls.target.copy(center);
      camera.position.set(
        center.x + span * 0.9,
        center.y + Math.max(data.maxHeight * 1.8, span * 0.5),
        center.z + span * 0.9,
      );
      camera.lookAt(center);
      geomFingerprintRef.current = geomFingerprint;
    } else if (shouldFitCamera && !box.isEmpty()) {
      fitCamera(camera, controls, sceneGroup);
      geomFingerprintRef.current = geomFingerprint;
    }
    engine.resize();
    engine.updateCompass?.();
  }, [ready, roofPolygon, roofEdges, pitchDeg, azimuthDeg, roofBaseHeightM, obstacles, hasRoof, panels, module, moduleSku, panelsVisible3d, panelMountMode, panelMountTiltDeg, panelLayout, selectedFacetId, selectedObstacleId, facetAzimuthOverrides]);

  const edgeCount = roofEdges?.length || 0;
  const facetList = facets?.length ? facets : [];
  const panelCountActive = activePanelCount ?? panels?.filter((p) => p.active).length ?? 0;
  const isSurface = panelMountMode === 'surface' || panelMountMode === 'flush';
  const layoutLabel = panelLayout === 'vertical' ? 'вертикально' : 'горизонтально';
  const mountLabel = isSurface
    ? `на поверхность · ${layoutLabel}`
    : `с опорой ${panelMountTiltDeg}° · ${layoutLabel}`;

  const longiModules = MODULES.filter((m) => m.sku.startsWith('LR'));
  const jinkoModules = MODULES.filter((m) => m.sku.includes('JINKO'));

  return (
    <div ref={rootRef} className={`constructor-3d-wrap${fullscreen ? ' constructor-3d-wrap--fullscreen' : ''}`}>
      <div ref={wrapRef} className="constructor-3d">
        <div className="constructor-3d__toolbar">
          <div className="constructor-3d__tabs" role="tablist" aria-label="Режим 3D">
            {TOOL_TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={toolTab === id}
                className={`constructor-3d__tab${toolTab === id ? ' constructor-3d__tab--active' : ''}`}
                onClick={() => setToolTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {toolTab === 'panels' && (
            <>
          <div className="constructor-3d__toolbar-row">
            <button
              type="button"
              className="constructor-3d__tool-btn constructor-3d__tool-btn--primary"
              disabled={!hasRoof}
              onClick={onAddPanels}
              title={hasRoof ? 'Разместить панели на крыше с выбранным креплением' : 'Сначала обведите крышу на карте'}
            >
              {panelsVisible3d && panelCountActive > 0 ? 'Обновить панели' : 'Добавить панели'}
            </button>
            <div className="constructor-3d__mount-toggle" role="group" aria-label="Тип крепления панелей">
              <button
                type="button"
                className={`constructor-3d__tool-btn${!isSurface ? ' constructor-3d__tool-btn--active' : ''}`}
                onClick={() => onMountModeChange?.('racked')}
                title="Профили и опоры с регулируемым углом"
              >
                С опорой
              </button>
              <button
                type="button"
                className={`constructor-3d__tool-btn${isSurface ? ' constructor-3d__tool-btn--active' : ''}`}
                onClick={() => onMountModeChange?.('surface')}
                title="Панель повторяет уклон кровли"
              >
                На поверхность
              </button>
            </div>
          </div>
          <div className="constructor-3d__toolbar-row">
            <label className="constructor-3d__field constructor-3d__field--wide">
              <span>Панель</span>
              <select
                className="constructor-3d__select"
                value={moduleSku || module?.sku || ''}
                onChange={(e) => onModuleChange?.(e.target.value)}
              >
                <optgroup label="LONGi">
                  {longiModules.map((m) => (
                    <option key={m.sku} value={m.sku}>
                      {m.name} · {m.powerW}W · {m.widthM}×{m.heightM} м
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Jinko">
                  {jinkoModules.map((m) => (
                    <option key={m.sku} value={m.sku}>
                      {m.name} · {m.powerW}W · {m.widthM}×{m.heightM} м
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          </div>
          <div className="constructor-3d__toolbar-row">
            {!isSurface && (
              <label className="constructor-3d__field">
                <span>Угол панели, °</span>
                <DecimalField
                  className="constructor-3d__input"
                  value={panelMountTiltDeg ?? 30}
                  min={0}
                  max={90}
                  decimals={0}
                  title="Enter — применить"
                  onCommit={(v) => onMountTiltChange?.(v)}
                />
              </label>
            )}
            <div className="constructor-3d__mount-toggle" role="group" aria-label="Ориентация панелей">
              <button
                type="button"
                className={`constructor-3d__tool-btn${panelLayout !== 'vertical' ? ' constructor-3d__tool-btn--active' : ''}`}
                onClick={() => onLayoutChange?.('horizontal')}
                title="Длинная сторона вдоль карниза (горизонтально)"
              >
                Горизонтально
              </button>
              <button
                type="button"
                className={`constructor-3d__tool-btn${panelLayout === 'vertical' ? ' constructor-3d__tool-btn--active' : ''}`}
                onClick={() => onLayoutChange?.('vertical')}
                title="Длинная сторона вдоль ската (вертикально)"
              >
                Вертикально
              </button>
            </div>
          </div>
          {facetList.length > 0 && (
            <div className="constructor-3d__toolbar-row constructor-3d__facet-row">
              <span className="constructor-3d__facet-label">Панели на</span>
              <div className="constructor-3d__facet-btns" role="group" aria-label="Выбор ската для панелей">
                {facetList.length > 1 && (
                  <button
                    type="button"
                    className={`constructor-3d__tool-btn constructor-3d__tool-btn--facet${!selectedFacetId ? ' constructor-3d__tool-btn--active' : ''}`}
                    onClick={() => onFacetSelect?.(null)}
                    title="Заполнить все активные скаты"
                  >
                    Все
                  </button>
                )}
                {facetList.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    disabled={f.active === false}
                    className={[
                      'constructor-3d__tool-btn',
                      'constructor-3d__tool-btn--facet',
                      selectedFacetId === f.id ? 'constructor-3d__tool-btn--active' : '',
                      f.active === false ? 'constructor-3d__tool-btn--off' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => onFacetSelect?.(selectedFacetId === f.id ? null : f.id)}
                    title={f.active === false ? 'Скат выключен' : `Расставить панели на скате ${f.label}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {edgeCount > 0 && (
            <div className="constructor-3d__toolbar-row constructor-3d__facet-row">
              <span className="constructor-3d__facet-label">Видимость</span>
              <div className="constructor-3d__facet-btns" role="group" aria-label="Включение сторон скатов">
                {roofEdges.map((edge, idx) => (
                  <span key={edge.id} className="constructor-3d__facet-pair">
                    <button
                      type="button"
                      className={`constructor-3d__tool-btn constructor-3d__tool-btn--facet${edge.sideAActive !== false ? ' constructor-3d__tool-btn--active' : ''}`}
                      onClick={() => onEdgeSideChange?.(edge.id, 'a', edge.sideAActive === false)}
                      title={`Показать/скрыть сторону А ребра ${idx + 1}`}
                    >
                      Р{idx + 1}А
                    </button>
                    <button
                      type="button"
                      className={`constructor-3d__tool-btn constructor-3d__tool-btn--facet${edge.sideBActive !== false ? ' constructor-3d__tool-btn--active' : ''}`}
                      onClick={() => onEdgeSideChange?.(edge.id, 'b', edge.sideBActive === false)}
                      title={`Показать/скрыть сторону Б ребра ${idx + 1}`}
                    >
                      Р{idx + 1}Б
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
            </>
          )}
          {toolTab === 'obstacles' && (
            <>
              <p className="constructor-3d__place-hint">
                Клик по скату — новое препятствие · тяните фигуру для перемещения
                · Ctrl+C / Ctrl+V / Ctrl+Z
              </p>
              <div className="constructor-3d__toolbar-row">
                {OBSTACLE_SHAPES.map(({ id, label, icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`constructor-3d__tool-btn constructor-3d__tool-btn--shape${
                      (obstacleMetricsIsPreset ? obstacleShape === id : obstacleMetrics?.shape === id)
                        ? ' constructor-3d__tool-btn--active'
                        : ''
                    }`}
                    disabled={!hasRoof}
                    onClick={() => onObstacleShapeSelect?.(id)}
                    title={label}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
              <div className="constructor-3d__toolbar-row">
                <label className="constructor-3d__field">
                  <span>Высота, м</span>
                  <DecimalField
                    className="constructor-3d__input"
                    value={obstacleMetrics?.heightM ?? 0}
                    min={0.1}
                    max={200}
                    decimals={2}
                    title="Enter — применить"
                    onCommit={(v) => onObstacleFieldCommit?.({ heightM: v })}
                  />
                </label>
                {obstacleIsRound ? (
                  <label className="constructor-3d__field">
                    <span>Диаметр, м</span>
                    <DecimalField
                      className="constructor-3d__input"
                      value={obstacleMetrics?.widthM ?? obstacleMetrics?.lengthM ?? 0}
                      min={0.1}
                      max={200}
                      decimals={2}
                      title="Enter — применить"
                      onCommit={(v) => onObstacleFieldCommit?.({ widthM: v, lengthM: v })}
                    />
                  </label>
                ) : (
                  <>
                    <label className="constructor-3d__field">
                      <span>Ширина, м</span>
                      <DecimalField
                        className="constructor-3d__input"
                        value={obstacleMetrics?.widthM ?? 0}
                        min={0.1}
                        max={200}
                        decimals={2}
                        title="Enter — применить"
                        onCommit={(v) => onObstacleFieldCommit?.({ widthM: v })}
                      />
                    </label>
                    <label className="constructor-3d__field">
                      <span>Длина, м</span>
                      <DecimalField
                        className="constructor-3d__input"
                        value={obstacleMetrics?.lengthM ?? 0}
                        min={0.1}
                        max={200}
                        decimals={2}
                        title="Enter — применить"
                        onCommit={(v) => onObstacleFieldCommit?.({ lengthM: v })}
                      />
                    </label>
                  </>
                )}
                {!obstacleIsRound && (
                  <label className="constructor-3d__field">
                    <span>Поворот, °</span>
                    <DecimalField
                      className="constructor-3d__input"
                      value={obstacleMetrics?.rotationDeg ?? 0}
                      min={0}
                      max={359}
                      decimals={0}
                      title="Enter — применить"
                      onCommit={(v) => onObstacleFieldCommit?.({ rotationDeg: ((Math.round(v) % 360) + 360) % 360 })}
                    />
                  </label>
                )}
              </div>
              {!obstacleMetricsIsPreset && selectedObstacleId && (
                <div className="constructor-3d__toolbar-row">
                  <button
                    type="button"
                    className="constructor-3d__tool-btn"
                    onClick={() => onObstacleRemove?.(selectedObstacleId)}
                  >
                    Удалить выбранное
                  </button>
                </div>
              )}
              {(obstacles?.length || 0) > 0 && (
                <div className="constructor-3d__obs-chips" role="list">
                  {obstacles.map((obs) => {
                    const shapeLabel = OBSTACLE_SHAPES.find((s) => s.id === obs.shape)?.label || obs.shape;
                    const selected = obs.id === selectedObstacleId;
                    return (
                      <button
                        key={obs.id}
                        type="button"
                        role="listitem"
                        className={`constructor-3d__obs-chip${selected ? ' constructor-3d__obs-chip--selected' : ''}`}
                        onClick={() => onObstacleSelect?.(obs.id)}
                      >
                        {shapeLabel}
                        <span className="constructor-3d__obs-chip-meta">
                          {isCircularShape(obs.shape) ? `⌀ ${obs.widthM}` : `${obs.widthM}×${obs.lengthM}`} м
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {toolTab === 'params' && (
            <>
              <p className="constructor-3d__place-hint">
                Изменения сразу видны на карте слева и в 3D ниже
              </p>
              <div className="constructor-3d__toolbar-row constructor-3d__params-grid">
                <label className="constructor-3d__field">
                  <span>Уклон крыши, °</span>
                  <DecimalField
                    className="constructor-3d__input"
                    value={pitchDeg}
                    min={5}
                    max={60}
                    decimals={0}
                    title="Enter — применить"
                    onCommit={(v) => onParamsPatch?.({ pitchDeg: v })}
                  />
                </label>
                <label className="constructor-3d__field">
                  <span>Азимут ската, °</span>
                  <DecimalField
                    className="constructor-3d__input"
                    value={azimuthDeg}
                    min={0}
                    max={359}
                    decimals={0}
                    disabled={roofEdgeCount > 0}
                    title={roofEdgeCount > 0 ? 'При рёбрах азимут считается автоматически' : '180° = юг · Enter — применить'}
                    onCommit={(v) => onParamsPatch?.({ azimuthDeg: ((Math.round(v) % 360) + 360) % 360 })}
                  />
                </label>
                <label className="constructor-3d__field">
                  <span>Высота карниза, м</span>
                  <DecimalField
                    className="constructor-3d__input"
                    value={roofBaseHeightM ?? 0}
                    min={0}
                    max={80}
                    decimals={2}
                    title="Enter — применить"
                    onCommit={(v) => onParamsPatch?.({ roofBaseHeightM: v })}
                  />
                </label>
                <label className="constructor-3d__field">
                  <span>Отступ от края, м</span>
                  <DecimalField
                    className="constructor-3d__input"
                    value={panelEdgeMarginM ?? 1}
                    min={0}
                    max={10}
                    decimals={2}
                    title="Enter — применить"
                    onCommit={(v) => onParamsPatch?.({ panelEdgeMarginM: v })}
                  />
                </label>
                <label className="constructor-3d__field">
                  <span>Зазор панелей, м</span>
                  <DecimalField
                    className="constructor-3d__input"
                    value={panelSpacingM ?? 0.02}
                    min={0}
                    max={10}
                    decimals={2}
                    title="Enter — применить"
                    onCommit={(v) => onParamsPatch?.({ panelSpacingM: v })}
                  />
                </label>
                <label className="constructor-3d__field">
                  <span>Отступ от препятствий, м</span>
                  <DecimalField
                    className="constructor-3d__input"
                    value={obstacleClearanceM ?? OBSTACLE_CLEARANCE_M}
                    min={0}
                    max={10}
                    decimals={2}
                    title="Enter — применить"
                    onCommit={(v) => onParamsPatch?.({ obstacleClearanceM: v })}
                  />
                </label>
              </div>
              {facetList.length > 0 && (
                <div className="constructor-3d__toolbar-row constructor-3d__facet-row">
                  <span className="constructor-3d__facet-label">Панели на</span>
                  <div className="constructor-3d__facet-btns" role="group" aria-label="Выбор ската">
                    {facetList.length > 1 && (
                      <button
                        type="button"
                        className={`constructor-3d__tool-btn constructor-3d__tool-btn--facet${!selectedFacetId ? ' constructor-3d__tool-btn--active' : ''}`}
                        onClick={() => onFacetSelect?.(null)}
                      >
                        Все скаты
                      </button>
                    )}
                    {facetList.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        disabled={f.active === false}
                        className={`constructor-3d__tool-btn constructor-3d__tool-btn--facet${selectedFacetId === f.id ? ' constructor-3d__tool-btn--active' : ''}${f.active === false ? ' constructor-3d__tool-btn--off' : ''}`}
                        onClick={() => onFacetSelect?.(selectedFacetId === f.id ? null : f.id)}
                        title={`~${f.areaM2} м² · азимут ${f.azimuthDeg}°`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <dl className="constructor-3d__stats app-dl">
                <dt>Площадь</dt>
                <dd>{hasRoof ? `~${Math.round(roofAreaM2 || 0)} м²` : '—'}</dd>
                <dt>Углов / рёбер</dt>
                <dd>{hasRoof ? `${roofVertexCount} / ${roofEdgeCount || '—'}` : '—'}</dd>
                <dt>Скатов</dt>
                <dd>{facetList.length || '—'}</dd>
                <dt>Панелей</dt>
                <dd>{panelCountActive || '—'}</dd>
              </dl>
            </>
          )}
        </div>
        <div ref={viewportRef} className="constructor-3d__viewport">
          <div className="constructor-3d__compass" aria-label="Компас — ориентир по сторонам света">
            <div className="constructor-3d__compass-ring">
              <span className="constructor-3d__compass-n">N</span>
              <span className="constructor-3d__compass-e">E</span>
              <span className="constructor-3d__compass-s">S</span>
              <span className="constructor-3d__compass-w">W</span>
            </div>
          </div>
          <button
            type="button"
            className="constructor-3d__fs-btn"
            onClick={toggleFullscreen}
            title={fullscreen ? 'Выйти из полноэкранного режима (Esc)' : 'Открыть на весь экран'}
            aria-label={fullscreen ? 'Выйти из полноэкранного режима' : 'Открыть на весь экран'}
          >
            {fullscreen ? '✕' : '⛶'}
          </button>
          {fullscreen && (
            <p className="constructor-3d__fs-hint">ЛКМ — вращение · колёсико — масштаб · ПКМ — сдвиг · Esc — выход</p>
          )}
        </div>
      </div>
      {!fullscreen && (
        <p className="constructor-map-hint">
          <strong>3D крыша</strong> · ЛКМ — вращение · колёсико — масштаб · ПКМ — сдвиг
          {' · '}
          <button type="button" className="constructor-3d__fs-link" onClick={toggleFullscreen}>
            На весь экран
          </button>
          {' · '}
          уклон {pitchDeg}°
          {meshInfo?.baseH > 0 ? ` · карниз ${meshInfo.baseH} м` : ''}
          {edgeCount > 0 ? ` · рёбер: ${edgeCount}` : ` · азимут ${azimuthDeg}°`}
          {meshInfo?.maxH > 0 ? ` · конёк ~${meshInfo.maxH} м` : ''}
          {meshInfo?.facets > 0 ? ` · скатов: ${meshInfo.facets}` : ''}
          {meshInfo?.obsCount > 0 ? ` · препятствий: ${meshInfo.obsCount}` : ''}
          {panelsVisible3d && meshInfo?.panelCount > 0 ? ` · панелей: ${meshInfo.panelCount} (${mountLabel})` : ''}
          {!hasRoof ? ' · обведите крышу на карте' : ''}
        </p>
      )}
    </div>
  );
}
