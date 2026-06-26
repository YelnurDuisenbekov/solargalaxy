import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../../utils/googleMapsLoader.js';
import { attachGoogleMapProjection } from '../../utils/constructor/mapProjection.js';
import ConstructorRoofGeometryHud from './ConstructorRoofGeometryHud.jsx';
import ConstructorMap from './ConstructorMap.jsx';
import {
  OBSTACLE_COLORS,
  findObstacleAt,
  moveObstacle,
  obstacleCorners,
  obstacleEdgeMidpoints,
  obstacleFootprintPath,
  resizeObstacleCorner,
  resizeObstacleEdge,
} from '../../utils/constructor/obstacles.js';
import {
  canDragObstacleOnMap,
  obstacleAtDragDelta,
  startObstacleDrag,
} from '../../utils/constructor/obstacleMapDrag.js';
import { edgeLinePathLatLng } from '../../utils/constructor/roofFacets.js';
import {
  facetMapStyle,
  facetRingLatLng,
  facetsForMapDraw,
} from '../../utils/constructor/facetMapDraw.js';

const MODE_HINT = {
  roof: 'Кликайте по углам крыши на спутнике (минимум 3 точки)',
  refine: 'Чертёж: тяните углы · L — длина стороны · ∠ — угол · введите точные значения',
  edge: 'Рёбра: перпендикулярный — клик по краю; свободный — 2 точки до периметра',
  azimuth: 'Односкатная: клик по карнизу (стороне ската) · иначе — стрелка направления',
  obstacle: 'Клик — новое препятствие · тяните фигуру или маркеры · Enter — применить',
  view: 'Тяните препятствие по карте · клик — выбор',
};

function handleIcon(maps, scale, fill, stroke = '#103B5E', strokeWeight = 2) {
  return {
    path: maps.SymbolPath.CIRCLE,
    scale,
    fillColor: fill,
    fillOpacity: 1,
    strokeColor: stroke,
    strokeWeight,
  };
}

export default function ConstructorGoogleMap({
  lat,
  lng,
  roofPolygon,
  roofRectDraft,
  roofEdges,
  edgeDraft,
  azimuthArrow,
  azimuthDraft,
  obstacles,
  selectedObstacleId,
  drawMode,
  mapType = 'hybrid',
  flyToKey,
  selectedRoofVertexIndex,
  selectedRoofEdgeIndex,
  slopeEaveEdgeIndex,
  pitchDeg = 25,
  azimuthDeg = 180,
  facetAzimuthOverrides,
  selectedFacetId,
  onMapClick,
  onObstacleAdd,
  onObstacleSelect,
  onObstacleUpdate,
  onObstacleGestureStart,
  onRoofVertexDrag,
  onRoofVertexSelect,
  onRoofEdgeSelect,
  onRoofEdgeLengthChange,
  onRoofVertexAngleChange,
}) {
  const mapRef = useRef(null);
  const mapWrapRef = useRef(null);
  const mapInstance = useRef(null);
  const overlaysRef = useRef({
    markers: [],
    polygon: null,
    facets: [],
    edges: [],
    draft: null,
    azimuth: null,
    obstacles: [],
    obstacleHandles: [],
    pin: null,
  });
  const drawModeRef = useRef(drawMode);
  const obstaclesRef = useRef(obstacles);
  const obstacleDragRef = useRef(null);
  const obstacleDragMovedRef = useRef(false);
  const callbacksRef = useRef({
    onObstacleAdd, onObstacleSelect, onObstacleUpdate, onObstacleGestureStart, onMapClick,
    onRoofVertexDrag, onRoofVertexSelect, onRoofEdgeSelect,
  });
  const [fallback, setFallback] = useState(false);
  const [mapProjection, setMapProjection] = useState(null);

  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { obstaclesRef.current = obstacles; }, [obstacles]);
  useEffect(() => {
    callbacksRef.current = {
      onObstacleAdd, onObstacleSelect, onObstacleUpdate, onObstacleGestureStart, onMapClick,
      onRoofVertexDrag, onRoofVertexSelect, onRoofEdgeSelect,
    };
  }, [onObstacleAdd, onObstacleSelect, onObstacleUpdate, onObstacleGestureStart, onMapClick, onRoofVertexDrag, onRoofVertexSelect, onRoofEdgeSelect]);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapRef.current || mapInstance.current) return;

        const map = new maps.Map(mapRef.current, {
          center: { lat, lng },
          zoom: 19,
          mapTypeId: mapType,
          mapTypeControl: true,
          mapTypeControlOptions: {
            mapTypeIds: ['hybrid', 'roadmap', 'satellite', 'terrain'],
            style: maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: maps.ControlPosition.TOP_RIGHT,
          },
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
        });

        map.addListener('click', (e) => {
          if (obstacleDragMovedRef.current) return;

          const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          const mode = drawModeRef.current;
          const cb = callbacksRef.current;

          if (mode === 'refine') {
            cb.onMapClick?.(pos);
            return;
          }

          if (mode === 'roof' || mode === 'edge' || mode === 'azimuth') {
            cb.onMapClick?.(pos);
            return;
          }

          if (mode === 'obstacle' || mode === 'view') {
            const hit = findObstacleAt(obstaclesRef.current || [], pos.lat, pos.lng);
            if (hit) {
              cb.onObstacleSelect?.(hit.id);
              return;
            }
            if (mode === 'obstacle') cb.onObstacleAdd?.(pos);
          }
        });

        const finishObstacleDrag = () => {
          if (!obstacleDragRef.current) return;
          map.setOptions({ draggable: true });
          obstacleDragRef.current = null;
          window.setTimeout(() => { obstacleDragMovedRef.current = false; }, 0);
        };

        const onObstacleDragMove = (e) => {
          const drag = obstacleDragRef.current;
          if (!drag) return;
          obstacleDragMovedRef.current = true;
          const current = obstaclesRef.current?.find((o) => o.id === drag.id) || drag.baseObs;
          drag.baseObs = current;
          const moved = obstacleAtDragDelta(drag, e.latLng.lat(), e.latLng.lng());
          callbacksRef.current.onObstacleUpdate?.(moved, { transient: true });
        };

        map.addListener('mousemove', onObstacleDragMove);
        map.addListener('mouseup', finishObstacleDrag);

        mapInstance.current = map;
        attachGoogleMapProjection(map, setMapProjection);

        const ro = new ResizeObserver(() => {
          window.requestAnimationFrame(() => {
            window.google?.maps?.event?.trigger(map, 'resize');
          });
        });
        if (mapRef.current) ro.observe(mapRef.current);
        map._sgResizeObserver = ro;
      })
      .catch(() => {
        if (!cancelled) setFallback(true);
      });

    return () => {
      cancelled = true;
      mapInstance.current?._sgResizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !window.google) return;
    map.setMapTypeId(mapType);
  }, [mapType]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !window.google || !flyToKey) return;
    map.panTo({ lat, lng });
    map.setZoom(19);
  }, [flyToKey, lat, lng]);

  useEffect(() => {
    const map = mapInstance.current;
    const maps = window.google?.maps;
    if (!map || !maps) return;

    overlaysRef.current.markers.forEach((m) => m.setMap(null));
    overlaysRef.current.markers = [];
    overlaysRef.current.pin?.setMap(null);
    overlaysRef.current.polygon?.setMap(null);
    overlaysRef.current.facets.forEach((f) => f.setMap(null));
    overlaysRef.current.facets = [];
    overlaysRef.current.edges.forEach((e) => e.setMap(null));
    overlaysRef.current.edges = [];
    overlaysRef.current.draft?.setMap(null);
    overlaysRef.current.azimuth?.setMap(null);
    overlaysRef.current.azimuth = null;
    overlaysRef.current.obstacles.forEach((o) => o.setMap(null));
    overlaysRef.current.obstacles = [];
    overlaysRef.current.obstacleHandles.forEach((h) => h.setMap(null));
    overlaysRef.current.obstacleHandles = [];

    const isRefine = drawMode === 'refine';

    overlaysRef.current.pin = new maps.Marker({
      map: isRefine ? null : map,
      position: { lat, lng },
      title: 'Центр объекта',
      clickable: false,
      icon: handleIcon(maps, 9, '#E3A50B'),
      zIndex: 10,
    });

    roofRectDraft?.forEach((p, i) => {
      const marker = new maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        clickable: false,
        label: { text: `Ч${i + 1}`, color: '#103B5E', fontWeight: '700', fontSize: '11px' },
        icon: handleIcon(maps, 10, '#E3A50B'),
      });
      overlaysRef.current.markers.push(marker);
    });

    roofPolygon?.forEach((p, i) => {
      const selected = selectedRoofVertexIndex === i;
      const marker = new maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        draggable: isRefine,
        clickable: isRefine,
        label: { text: String(i + 1), color: '#103B5E', fontWeight: '700', fontSize: '11px' },
        icon: handleIcon(maps, isRefine ? 12 : 10, selected ? '#E3A50B' : '#ffffff', selected ? '#103B5E' : '#E3A50B', selected ? 3 : 2),
        title: `Угол ${i + 1}`,
        zIndex: isRefine ? 40 : 20,
      });
      if (isRefine) {
        marker.addListener('click', () => callbacksRef.current.onRoofVertexSelect?.(i));
        marker.addListener('dragend', (e) => {
          callbacksRef.current.onRoofVertexDrag?.(i, e.latLng.lat(), e.latLng.lng());
        });
      }
      overlaysRef.current.markers.push(marker);
    });

    if (roofPolygon?.length >= 3) {
      const mapFacets = facetsForMapDraw(
        roofPolygon,
        roofEdges,
        pitchDeg,
        azimuthDeg,
        facetAzimuthOverrides,
      );
      const hasFacetFill = mapFacets.length > 0;

      mapFacets.forEach((facet, idx) => {
        const style = facetMapStyle(facet, idx, selectedFacetId);
        const polygon = new maps.Polygon({
          map,
          paths: facetRingLatLng(facet),
          strokeColor: style.stroke,
          strokeOpacity: 0.95,
          strokeWeight: style.strokeWeight,
          fillColor: style.fill,
          fillOpacity: style.fillOpacity,
          clickable: false,
          zIndex: style.zIndex,
        });
        overlaysRef.current.facets.push(polygon);
      });

      const path = roofPolygon.map((p) => ({ lat: p.lat, lng: p.lng }));
      overlaysRef.current.polygon = new maps.Polygon({
        map,
        paths: path,
        strokeColor: '#1B8A45',
        strokeOpacity: 0.95,
        strokeWeight: isRefine ? 2.5 : 2,
        fillColor: '#1B8A45',
        fillOpacity: hasFacetFill ? 0 : (isRefine ? 0.12 : 0.28),
        clickable: isRefine,
        zIndex: 1,
      });
      if (isRefine) {
        overlaysRef.current.polygon.addListener('click', (e) => {
          callbacksRef.current.onMapClick?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
      }
    } else if (roofPolygon?.length >= 2) {
      overlaysRef.current.polygon = new maps.Polyline({
        map,
        path: roofPolygon.map((p) => ({ lat: p.lat, lng: p.lng })),
        geodesic: false,
        strokeColor: '#1B8A45',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        clickable: false,
      });
    }

    if (roofPolygon?.length >= 3) {
      for (let i = 0; i < roofPolygon.length; i += 1) {
        const a = roofPolygon[i];
        const b = roofPolygon[(i + 1) % roofPolygon.length];
        const isEave = slopeEaveEdgeIndex === i;
        const isSel = selectedRoofEdgeIndex === i;
        const line = new maps.Polyline({
          map,
          path: edgeLinePathLatLng(a, b, roofPolygon),
          geodesic: false,
          strokeColor: isEave ? '#E3A50B' : (isSel ? '#0ea5e9' : '#1B8A45'),
          strokeOpacity: isEave || isSel ? 1 : 0.55,
          strokeWeight: isEave ? 5 : (isSel ? 4 : 2),
          clickable: isRefine || drawMode === 'azimuth',
          zIndex: isEave ? 12 : 5,
        });
        if (isRefine || drawMode === 'azimuth') {
          const edgeIdx = i;
          line.addListener('click', () => callbacksRef.current.onRoofEdgeSelect?.(edgeIdx));
        }
        overlaysRef.current.edges.push(line);
      }
    }

    roofEdges?.forEach((edge, idx) => {
      if (!edge.from || !edge.to) return;
      const line = new maps.Polyline({
        map,
        path: edgeLinePathLatLng(edge.from, edge.to, roofPolygon),
        geodesic: false,
        strokeColor: '#103B5E',
        strokeOpacity: 1,
        strokeWeight: 4,
        clickable: false,
      });
      overlaysRef.current.edges.push(line);

      const midLat = (edge.from.lat + edge.to.lat) / 2;
      const midLng = (edge.from.lng + edge.to.lng) / 2;
      const label = new maps.Marker({
        map,
        position: { lat: midLat, lng: midLng },
        clickable: false,
        label: { text: `Р${idx + 1}`, color: '#fff', fontWeight: '700', fontSize: '10px' },
        icon: handleIcon(maps, 8, '#103B5E', '#E3A50B'),
      });
      overlaysRef.current.markers.push(label);
    });

    if (edgeDraft?.length) {
      overlaysRef.current.draft = new maps.Polyline({
        map,
        path: edgeDraft.length >= 2
          ? edgeLinePathLatLng(edgeDraft[0], edgeDraft[1], roofPolygon)
          : edgeDraft.map((p) => ({ lat: p.lat, lng: p.lng })),
        geodesic: false,
        strokeColor: '#103B5E',
        strokeOpacity: 0.7,
        strokeWeight: 3,
        clickable: false,
      });
    }

    const arrow = azimuthArrow;
    if (arrow?.from && arrow?.to) {
      overlaysRef.current.azimuth = new maps.Polyline({
        map,
        path: edgeLinePathLatLng(arrow.from, arrow.to, roofPolygon, 32),
        geodesic: false,
        strokeColor: '#E3A50B',
        strokeOpacity: 1,
        strokeWeight: 4,
        clickable: false,
        icons: [{
          icon: { path: maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 4, strokeColor: '#E3A50B', fillColor: '#E3A50B', fillOpacity: 1 },
          offset: '100%',
        }],
        zIndex: 8,
      });
    } else if (azimuthDraft?.length === 1) {
      overlaysRef.current.azimuth = new maps.Polyline({
        map,
        path: edgeLinePathLatLng(azimuthDraft[0], { lat, lng }, roofPolygon, 16),
        geodesic: false,
        strokeColor: '#E3A50B',
        strokeOpacity: 0.7,
        strokeWeight: 3,
        clickable: false,
        zIndex: 7,
      });
    }

    obstacles?.forEach((obs) => {
      const colors = OBSTACLE_COLORS[obs.shape] || OBSTACLE_COLORS.tree;
      const selected = obs.id === selectedObstacleId;
      const path = obstacleFootprintPath(obs);

      const polygon = new maps.Polygon({
        map,
        paths: path,
        strokeColor: selected ? '#E3A50B' : colors.stroke,
        strokeOpacity: 0.95,
        strokeWeight: selected ? 3 : 2,
        fillColor: colors.fill,
        fillOpacity: selected ? 0.42 : 0.3,
        clickable: true,
        zIndex: selected ? 6 : 3,
      });
      polygon.addListener('click', () => callbacksRef.current.onObstacleSelect?.(obs.id));

      if (canDragObstacleOnMap(drawMode)) {
        polygon.addListener('mousedown', (e) => {
          if (e.domEvent) {
            e.domEvent.preventDefault();
            e.domEvent.stopPropagation();
          }
          map.setOptions({ draggable: false });
          obstacleDragMovedRef.current = false;
          obstacleDragRef.current = startObstacleDrag(obs, e.latLng.lat(), e.latLng.lng());
          callbacksRef.current.onObstacleGestureStart?.();
          callbacksRef.current.onObstacleSelect?.(obs.id);
        });
      }

      overlaysRef.current.obstacles.push(polygon);

      const shapeLabel = { tree: 'Д', cone: 'К', cylinder: 'Ц', cube: 'Кб' }[obs.shape] || '?';
      const label = new maps.Marker({
        map,
        position: { lat: obs.lat, lng: obs.lng },
        clickable: false,
        label: { text: shapeLabel, color: '#fff', fontWeight: '700', fontSize: '10px' },
        icon: handleIcon(maps, 7, colors.stroke, '#fff', 1),
        zIndex: 7,
      });
      overlaysRef.current.markers.push(label);

      if (!selected) return;

      const centerMarker = new maps.Marker({
        map,
        position: { lat: obs.lat, lng: obs.lng },
        draggable: true,
        title: 'Переместить',
        icon: handleIcon(maps, 9, '#E3A50B', '#103B5E', 2),
        zIndex: 30,
      });
      centerMarker.addListener('dragend', (e) => {
        callbacksRef.current.onObstacleUpdate?.(
          moveObstacle(obs, e.latLng.lat(), e.latLng.lng()),
        );
      });
      overlaysRef.current.obstacleHandles.push(centerMarker);

      obstacleCorners(obs).forEach((c, idx) => {
        const m = new maps.Marker({
          map,
          position: c,
          draggable: true,
          title: 'Угол',
          icon: handleIcon(maps, 7, '#ffffff', '#103B5E', 2),
          zIndex: 31,
        });
        m.addListener('dragend', (e) => {
          callbacksRef.current.onObstacleUpdate?.(
            resizeObstacleCorner(obs, idx, e.latLng.lat(), e.latLng.lng()),
          );
        });
        overlaysRef.current.obstacleHandles.push(m);
      });

      obstacleEdgeMidpoints(obs).forEach(({ lat: mLat, lng: mLng, edgeIndex }) => {
        const m = new maps.Marker({
          map,
          position: { lat: mLat, lng: mLng },
          draggable: true,
          title: 'Ребро',
          icon: handleIcon(maps, 6, '#93c5fd', '#1e40af', 2),
          zIndex: 31,
        });
        m.addListener('dragend', (e) => {
          callbacksRef.current.onObstacleUpdate?.(
            resizeObstacleEdge(obs, edgeIndex, e.latLng.lat(), e.latLng.lng()),
          );
        });
        overlaysRef.current.obstacleHandles.push(m);
      });
    });
  }, [roofPolygon, roofRectDraft, roofEdges, edgeDraft, azimuthArrow, azimuthDraft, obstacles, selectedObstacleId, lat, lng, drawMode, selectedRoofVertexIndex, selectedRoofEdgeIndex, slopeEaveEdgeIndex, pitchDeg, azimuthDeg, facetAzimuthOverrides, selectedFacetId]);

  if (fallback) {
    return (
      <ConstructorMap
        lat={lat}
        lng={lng}
        roofPolygon={roofPolygon}
        roofRectDraft={roofRectDraft}
        roofEdges={roofEdges}
        edgeDraft={edgeDraft}
        obstacles={obstacles}
        selectedObstacleId={selectedObstacleId}
        drawMode={drawMode}
        mapStyle={mapType}
        flyToKey={flyToKey}
        selectedRoofVertexIndex={selectedRoofVertexIndex}
        selectedRoofEdgeIndex={selectedRoofEdgeIndex}
        slopeEaveEdgeIndex={slopeEaveEdgeIndex}
        pitchDeg={pitchDeg}
        azimuthDeg={azimuthDeg}
        facetAzimuthOverrides={facetAzimuthOverrides}
        selectedFacetId={selectedFacetId}
        onMapClick={onMapClick}
        onObstacleAdd={onObstacleAdd}
        onObstacleSelect={onObstacleSelect}
        onObstacleUpdate={onObstacleUpdate}
        onObstacleGestureStart={onObstacleGestureStart}
        onRoofVertexDrag={onRoofVertexDrag}
        onRoofVertexSelect={onRoofVertexSelect}
        onRoofEdgeSelect={onRoofEdgeSelect}
        onRoofEdgeLengthChange={onRoofEdgeLengthChange}
        onRoofVertexAngleChange={onRoofVertexAngleChange}
      />
    );
  }

  const edgeHint = drawMode === 'edge'
    ? ' — клик по контуру или 2 точки (свободный)'
    : '';

  return (
    <div ref={mapWrapRef} className={`constructor-map-wrap constructor-map-wrap--${drawMode}`}>
      <div ref={mapRef} className="constructor-map constructor-map--google" />
      <ConstructorRoofGeometryHud
        roofPolygon={roofPolygon}
        drawMode={drawMode}
        selectedRoofVertexIndex={selectedRoofVertexIndex}
        selectedRoofEdgeIndex={selectedRoofEdgeIndex}
        slopeEaveEdgeIndex={slopeEaveEdgeIndex}
        projectLatLng={mapProjection}
        onEdgeLengthChange={onRoofEdgeLengthChange}
        onVertexAngleChange={onRoofVertexAngleChange}
        onVertexSelect={onRoofVertexSelect}
        onEdgeSelect={onRoofEdgeSelect}
      />
      <p className="constructor-map-hint">
        <strong>Google Maps · {MODE_HINT[drawMode]}{edgeHint}</strong>
        {' · '}
        Углов: {roofPolygon?.length || 0}
        {' · '}
        Рёбер: {roofEdges?.length || 0}
        {' · '}
        Препятствий: {obstacles?.length || 0}
        {' · '}
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </p>
    </div>
  );
}
