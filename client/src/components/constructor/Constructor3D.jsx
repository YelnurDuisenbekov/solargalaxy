import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildRoofSurfaceData } from '../../utils/constructor/roofMesh3d.js';
import { buildBuildingMesh, buildGroundPlane, buildObstacleMeshes3d } from '../../utils/constructor/obstacleMesh3d.js';
import { buildPanelMeshes3d } from '../../utils/constructor/panelMesh3d.js';
import { migrateObstacles } from '../../utils/constructor/obstacles.js';
import { MODULES } from '../../utils/constructor/equipment.js';

const SCENE_BG = 0x1e293b;

function disposeObject(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
    }
  });
}

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
}) {
  const rootRef = useRef(null);
  const wrapRef = useRef(null);
  const engineRef = useRef(null);
  const geomFingerprintRef = useRef('');
  const [ready, setReady] = useState(false);
  const [meshInfo, setMeshInfo] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);

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
    const wrap = wrapRef.current;
    if (!wrap) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BG);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 800);
    camera.position.set(12, 9, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.className = 'constructor-3d__canvas';
    wrap.appendChild(renderer.domElement);

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
      const w = Math.max(wrap.clientWidth, 280);
      const h = Math.max(wrap.clientHeight, 280);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    engineRef.current = { scene, camera, renderer, controls, content, resize };
    setReady(true);

    return () => {
      setReady(false);
      cancelAnimationFrame(frameId);
      ro.disconnect();
      controls.dispose();
      disposeObject(content);
      renderer.dispose();
      if (wrap.contains(renderer.domElement)) wrap.removeChild(renderer.domElement);
      engineRef.current = null;
    };
  }, []);

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
      (roofEdges || []).map((e) => `${e.id}:${e.from?.lat},${e.from?.lng}-${e.to?.lat},${e.to?.lng}`).join('|'),
      pitchDeg,
      azimuthDeg,
      roofBaseHeightM,
    ].join('::');
    const shouldFitCamera = geomFingerprint !== geomFingerprintRef.current;

    const data = buildRoofSurfaceData(
      roofPolygon,
      roofEdges,
      Number(pitchDeg),
      azimuthDeg,
      Number(roofBaseHeightM) || 0,
    );
    if (!data) {
      setMeshInfo(null);
      return;
    }
    setMeshInfo({
      facets: data.facetGroups?.length || 0,
      maxH: Math.round(data.maxHeight * 10) / 10,
      baseH: Math.round((data.roofBaseHeightM || 0) * 10) / 10,
      obsCount: (obstacles || []).length,
      panelCount: panelsVisible3d ? (panels?.filter((p) => p.active).length || 0) : 0,
    });

    const sceneGroup = new THREE.Group();

    const groundSpan = Math.max(
      ...data.polyLocal.map((p) => Math.hypot(p.x - data.cx, p.y - data.cz)),
      8,
    );
    sceneGroup.add(buildGroundPlane(groundSpan * 1.8));

    const building = buildBuildingMesh(data.polyLocal, data.roofBaseHeightM);
    if (building) sceneGroup.add(building);

    if (data.solidVertices?.length >= 9) {
      const solidGeo = new THREE.BufferGeometry();
      solidGeo.setAttribute('position', new THREE.Float32BufferAttribute(data.solidVertices, 3));
      solidGeo.setAttribute('normal', new THREE.Float32BufferAttribute(data.solidNormals, 3));
      solidGeo.computeBoundingSphere();
      sceneGroup.add(new THREE.Mesh(
        solidGeo,
        new THREE.MeshStandardMaterial({
          color: 0x4a5568,
          roughness: 0.9,
          metalness: 0.02,
          flatShading: true,
        }),
      ));
    }

    const roofGroup = new THREE.Group();

    if (data.facetGroups?.length > 0) {
      data.facetGroups.forEach((fg) => {
        const byteStart = fg.startIndex * 3;
        const byteCount = fg.count * 3;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(data.vertices.slice(byteStart, byteStart + byteCount), 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals.slice(byteStart, byteStart + byteCount), 3));
        geo.computeBoundingSphere();
        roofGroup.add(new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({
            color: fg.color,
            roughness: 0.82,
            metalness: 0.05,
            flatShading: true,
          }),
        ));
      });
    } else if (data.vertices.length >= 9) {
      const roofGeo = new THREE.BufferGeometry();
      roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(data.vertices, 3));
      roofGeo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
      roofGeo.computeBoundingSphere();
      roofGroup.add(new THREE.Mesh(
        roofGeo,
        new THREE.MeshStandardMaterial({
          color: 0x64748b,
          roughness: 0.82,
          metalness: 0.05,
          flatShading: true,
        }),
      ));
    }

    data.ridgeLines.forEach((line) => {
      const dir = new THREE.Vector3(line.to.x - line.from.x, line.to.y - line.from.y, line.to.z - line.from.z);
      const len = dir.length();
      if (len < 0.05) return;
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.16, 0.22),
        new THREE.MeshStandardMaterial({ color: 0x103b5e, roughness: 0.45 }),
      );
      rib.position.set(
        (line.from.x + line.to.x) / 2,
        (line.from.y + line.to.y) / 2 + 0.06,
        (line.from.z + line.to.z) / 2,
      );
      rib.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
      roofGroup.add(rib);
    });

    sceneGroup.add(roofGroup);

    const obsGroup = buildObstacleMeshes3d(migrateObstacles(obstacles), {
      refLat: data.refLat,
      refLng: data.refLng,
      facets: data.facets,
      roofEdges,
      pitchDeg: Number(pitchDeg),
      roofBaseHeightM: data.roofBaseHeightM,
      polyLocal: data.polyLocal,
    });
    sceneGroup.add(obsGroup);

    if (panelsVisible3d && panels?.length && module) {
      const panelGroup = buildPanelMeshes3d(panels, {
        module,
        mountMode: panelMountMode || 'racked',
        panelLayout: panelLayout || 'horizontal',
        mountTiltDeg: panelMountTiltDeg ?? 30,
        facets: data.facets,
        roofEdges,
        pitchDeg: Number(pitchDeg),
        roofBaseHeightM: data.roofBaseHeightM,
        polyLocal: data.polyLocal,
      });
      sceneGroup.add(panelGroup);
    }

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
  }, [ready, roofPolygon, roofEdges, pitchDeg, azimuthDeg, roofBaseHeightM, obstacles, hasRoof, panels, module, moduleSku, panelsVisible3d, panelMountMode, panelMountTiltDeg, panelLayout]);

  const edgeCount = roofEdges?.length || 0;
  const activePanelCount = panels?.filter((p) => p.active).length || 0;
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
          <div className="constructor-3d__toolbar-row">
            <button
              type="button"
              className="constructor-3d__tool-btn constructor-3d__tool-btn--primary"
              disabled={!hasRoof}
              onClick={onAddPanels}
              title={hasRoof ? 'Разместить панели на крыше с выбранным креплением' : 'Сначала обведите крышу на карте'}
            >
              {panelsVisible3d && activePanelCount > 0 ? 'Обновить панели' : 'Добавить панели'}
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
                <input
                  type="number"
                  className="constructor-3d__input"
                  min={0}
                  max={90}
                  step={1}
                  value={panelMountTiltDeg ?? 30}
                  onChange={(e) => onMountTiltChange?.(+e.target.value)}
                  onBlur={(e) => {
                    const v = Math.min(90, Math.max(0, Number(e.target.value) || 0));
                    onMountTiltChange?.(v);
                  }}
                  title="Целевой угол панели от горизонта; профили компенсируют уклон крыши"
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
