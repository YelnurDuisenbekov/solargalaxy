import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../../utils/googleMapsLoader.js';
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

const MODE_HINT = {
  roof: 'Кликайте по углам крыши на спутнике (минимум 3 точки)',
  edge: 'Рёбра: две точки — линия продлится до периметра контура',
  obstacle: 'Клик — новое препятствие · клик по фигуре — выбор · тяните маркеры',
  view: 'Просмотр — перемещайте карту · клик по препятствию — выбор',
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
  obstacles,
  selectedObstacleId,
  drawMode,
  mapType = 'hybrid',
  flyToKey,
  onMapClick,
  onObstacleAdd,
  onObstacleSelect,
  onObstacleUpdate,
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const overlaysRef = useRef({
    markers: [],
    polygon: null,
    edges: [],
    draft: null,
    obstacles: [],
    obstacleHandles: [],
    pin: null,
  });
  const drawModeRef = useRef(drawMode);
  const obstaclesRef = useRef(obstacles);
  const callbacksRef = useRef({ onObstacleAdd, onObstacleSelect, onObstacleUpdate, onMapClick });
  const [fallback, setFallback] = useState(false);

  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);
  useEffect(() => { obstaclesRef.current = obstacles; }, [obstacles]);
  useEffect(() => {
    callbacksRef.current = { onObstacleAdd, onObstacleSelect, onObstacleUpdate, onMapClick };
  }, [onObstacleAdd, onObstacleSelect, onObstacleUpdate, onMapClick]);

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
          const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          const mode = drawModeRef.current;
          const cb = callbacksRef.current;

          if (mode === 'roof' || mode === 'edge') {
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

        mapInstance.current = map;
      })
      .catch(() => {
        if (!cancelled) setFallback(true);
      });

    return () => { cancelled = true; };
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
    overlaysRef.current.edges.forEach((e) => e.setMap(null));
    overlaysRef.current.edges = [];
    overlaysRef.current.draft?.setMap(null);
    overlaysRef.current.obstacles.forEach((o) => o.setMap(null));
    overlaysRef.current.obstacles = [];
    overlaysRef.current.obstacleHandles.forEach((h) => h.setMap(null));
    overlaysRef.current.obstacleHandles = [];

    overlaysRef.current.pin = new maps.Marker({
      map,
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
      const marker = new maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        clickable: false,
        label: { text: String(i + 1), color: '#103B5E', fontWeight: '700', fontSize: '11px' },
        icon: handleIcon(maps, 10, '#ffffff', '#E3A50B'),
        title: `Угол ${i + 1}`,
      });
      overlaysRef.current.markers.push(marker);
    });

    if (roofPolygon?.length >= 3) {
      overlaysRef.current.polygon = new maps.Polygon({
        map,
        paths: roofPolygon.map((p) => ({ lat: p.lat, lng: p.lng })),
        strokeColor: '#1B8A45',
        strokeOpacity: 0.95,
        strokeWeight: 2,
        fillColor: '#1B8A45',
        fillOpacity: 0.28,
        clickable: false,
      });
    } else if (roofPolygon?.length >= 2) {
      overlaysRef.current.polygon = new maps.Polyline({
        map,
        path: roofPolygon.map((p) => ({ lat: p.lat, lng: p.lng })),
        strokeColor: '#1B8A45',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        clickable: false,
      });
    }

    roofEdges?.forEach((edge, idx) => {
      if (!edge.from || !edge.to) return;
      const line = new maps.Polyline({
        map,
        path: [
          { lat: edge.from.lat, lng: edge.from.lng },
          { lat: edge.to.lat, lng: edge.to.lng },
        ],
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
        path: edgeDraft.map((p) => ({ lat: p.lat, lng: p.lng })),
        strokeColor: '#103B5E',
        strokeOpacity: 0.7,
        strokeWeight: 3,
        clickable: false,
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
  }, [roofPolygon, roofRectDraft, roofEdges, edgeDraft, obstacles, selectedObstacleId, lat, lng]);

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
        onMapClick={onMapClick}
        onObstacleAdd={onObstacleAdd}
        onObstacleSelect={onObstacleSelect}
        onObstacleUpdate={onObstacleUpdate}
      />
    );
  }

  const edgeHint = drawMode === 'edge'
    ? ` — точка ${Math.min((edgeDraft?.length || 0) + 1, 2)} из 2`
    : '';

  return (
    <div className={`constructor-map-wrap constructor-map-wrap--${drawMode}`}>
      <div ref={mapRef} className="constructor-map constructor-map--google" />
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
