import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../../utils/googleMapsLoader.js';
import ConstructorMap from './ConstructorMap.jsx';

const MODE_HINT = {
  roof: 'Кликайте по углам крыши на спутнике (минимум 3 точки)',
  edge: 'Рёбра: две точки на линии ребра (скаты с двух сторон). Можно несколько',
  obstacle: 'Клик — добавить препятствие',
  view: 'Просмотр — перемещайте карту',
};

export default function ConstructorGoogleMap({
  lat,
  lng,
  roofPolygon,
  roofRectDraft,
  roofEdges,
  edgeDraft,
  obstacles,
  drawMode,
  mapType = 'hybrid',
  flyToKey,
  onMapClick,
  onObstacleAdd,
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const overlaysRef = useRef({ markers: [], polygon: null, edges: [], draft: null, obstacles: [], pin: null });
  const drawModeRef = useRef(drawMode);
  const [fallback, setFallback] = useState(false);

  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);

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
          if (mode === 'roof' || mode === 'edge') onMapClick?.(pos);
          if (mode === 'obstacle') onObstacleAdd?.(pos);
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

    overlaysRef.current.pin = new maps.Marker({
      map,
      position: { lat, lng },
      title: 'Центр объекта',
      clickable: false,
      icon: {
        path: maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: '#E3A50B',
        fillOpacity: 1,
        strokeColor: '#103B5E',
        strokeWeight: 2,
      },
      zIndex: 10,
    });

    roofRectDraft?.forEach((p, i) => {
      const marker = new maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        clickable: false,
        label: { text: `Ч${i + 1}`, color: '#103B5E', fontWeight: '700', fontSize: '11px' },
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#E3A50B',
          fillOpacity: 1,
          strokeColor: '#103B5E',
          strokeWeight: 2,
        },
      });
      overlaysRef.current.markers.push(marker);
    });

    roofPolygon?.forEach((p, i) => {
      const marker = new maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        clickable: false,
        label: { text: String(i + 1), color: '#103B5E', fontWeight: '700', fontSize: '11px' },
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#ffffff',
          fillOpacity: 1,
          strokeColor: '#E3A50B',
          strokeWeight: 2,
        },
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
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#103B5E',
          fillOpacity: 1,
          strokeColor: '#E3A50B',
          strokeWeight: 2,
        },
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
      const circle = new maps.Circle({
        map,
        center: { lat: obs.lat, lng: obs.lng },
        radius: obs.radiusM || 2,
        strokeColor: '#b91c1c',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#b91c1c',
        fillOpacity: 0.28,
        clickable: false,
      });
      overlaysRef.current.obstacles.push(circle);
    });
  }, [roofPolygon, roofRectDraft, roofEdges, edgeDraft, obstacles, lat, lng]);

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
        drawMode={drawMode}
        mapStyle={mapType}
        flyToKey={flyToKey}
        onMapClick={onMapClick}
        onObstacleAdd={onObstacleAdd}
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
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </p>
    </div>
  );
}
