import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = { lat: 43.238949, lng: 76.945465 };

const MAP_LAYERS = {
  hybrid: null,
  satellite: null,
  roadmap: null,
};

function buildLayers() {
  if (MAP_LAYERS.hybrid) return MAP_LAYERS;

  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Esri', maxZoom: 20 },
  );
  const labels = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
    { subdomains: 'abcd', maxZoom: 20, opacity: 0.92, pane: 'overlayPane' },
  );
  const hybrid = L.layerGroup([satellite, labels]);

  const roadmap = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '© OpenStreetMap', maxZoom: 19 },
  );

  MAP_LAYERS.satellite = satellite;
  MAP_LAYERS.hybrid = hybrid;
  MAP_LAYERS.roadmap = roadmap;
  return MAP_LAYERS;
}

export default function ConstructorMap({
  lat,
  lng,
  roofPolygon,
  roofRectDraft,
  roofEdges,
  edgeDraft,
  obstacles,
  drawMode,
  mapStyle = 'hybrid',
  flyToKey,
  onMapClick,
  onObstacleAdd,
}) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const baseLayerRef = useRef(null);
  const layersRef = useRef({ polygon: null, edges: [], draft: null, markers: [], obstacles: [], pin: null });
  const drawModeRef = useRef(drawMode);

  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);

  useEffect(() => {
    if (mapInstance.current || !mapRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: true }).setView([lat, lng], 18);
    const layers = buildLayers();
    baseLayerRef.current = layers[mapStyle] || layers.hybrid;
    baseLayerRef.current.addTo(map);

    map.on('click', (e) => {
      const pos = { lat: e.latlng.lat, lng: e.latlng.lng };
      const mode = drawModeRef.current;
      if (mode === 'roof' || mode === 'edge') onMapClick?.(pos);
      if (mode === 'obstacle') onObstacleAdd?.(pos);
    });

    mapInstance.current = map;
    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    const layers = buildLayers();
    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);
    baseLayerRef.current = layers[mapStyle] || layers.hybrid;
    baseLayerRef.current.addTo(map);
  }, [mapStyle]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !flyToKey) return;
    map.flyTo([lat, lng], 19, { duration: 1.2 });
  }, [flyToKey, lat, lng]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    layersRef.current.markers.forEach((m) => m.remove());
    layersRef.current.markers = [];
    layersRef.current.pin?.remove();
    layersRef.current.polygon?.remove();
    layersRef.current.edges.forEach((e) => e.remove());
    layersRef.current.edges = [];
    layersRef.current.draft?.remove();
    layersRef.current.obstacles.forEach((o) => o.remove());
    layersRef.current.obstacles = [];
    layersRef.current.polygon = null;
    layersRef.current.draft = null;

    layersRef.current.pin = L.circleMarker([lat, lng], {
      radius: 8,
      color: '#103B5E',
      fillColor: '#E3A50B',
      fillOpacity: 1,
      weight: 2,
      interactive: false,
    }).addTo(map).bindTooltip('Центр объекта');

    roofRectDraft?.forEach((p, i) => {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 9,
        color: '#103B5E',
        fillColor: '#E3A50B',
        fillOpacity: 1,
        weight: 3,
        interactive: false,
      }).addTo(map).bindTooltip(`Черновик ${i + 1}`);
      layersRef.current.markers.push(marker);
    });

    roofPolygon?.forEach((p, i) => {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 9,
        color: '#E3A50B',
        fillColor: '#fff',
        fillOpacity: 1,
        weight: 3,
        interactive: false,
      }).addTo(map).bindTooltip(`Угол ${i + 1}`, { permanent: false });
      layersRef.current.markers.push(marker);
    });

    if (roofPolygon?.length >= 3) {
      layersRef.current.polygon = L.polygon(
        roofPolygon.map((p) => [p.lat, p.lng]),
        { color: '#1B8A45', fillColor: '#1B8A45', fillOpacity: 0.28, weight: 2, interactive: false },
      ).addTo(map);
    } else if (roofPolygon?.length >= 2) {
      layersRef.current.polygon = L.polyline(
        roofPolygon.map((p) => [p.lat, p.lng]),
        { color: '#1B8A45', weight: 2, dashArray: '6 4', interactive: false },
      ).addTo(map);
    }

    roofEdges?.forEach((edge, idx) => {
      if (!edge.from || !edge.to) return;
      const line = L.polyline(
        [[edge.from.lat, edge.from.lng], [edge.to.lat, edge.to.lng]],
        { color: '#103B5E', weight: 4, interactive: false },
      ).addTo(map).bindTooltip(`Ребро ${idx + 1}`);
      layersRef.current.edges.push(line);
    });

    if (edgeDraft?.length) {
      layersRef.current.draft = L.polyline(
        edgeDraft.map((p) => [p.lat, p.lng]),
        { color: '#103B5E', weight: 3, dashArray: '4 4', interactive: false },
      ).addTo(map);
    }

    obstacles?.forEach((obs) => {
      const circle = L.circle([obs.lat, obs.lng], {
        radius: obs.radiusM || 2,
        color: '#b91c1c',
        fillColor: '#b91c1c',
        fillOpacity: 0.35,
      }).addTo(map).bindTooltip(`Препятствие, h=${obs.heightM} м`);
      layersRef.current.obstacles.push(circle);
    });
  }, [roofPolygon, roofRectDraft, roofEdges, edgeDraft, obstacles, lat, lng]);

  const modeHint = {
    roof: 'Кликайте по углам крыши на спутнике (минимум 3 точки)',
    edge: edgeDraft?.length ? 'Рёбра: выберите 2-ю точку на карте' : 'Рёбра: выберите 1-ю точку линии ребра',
    obstacle: 'Клик — добавить препятствие (дерево, труба)',
    view: 'Просмотр — перемещайте и масштабируйте карту',
  }[drawMode] || '';

  return (
    <div className={`constructor-map-wrap constructor-map-wrap--${drawMode}`}>
      <div ref={mapRef} className="constructor-map" />
      <p className="constructor-map-hint">
        <strong>{modeHint}</strong>
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

export { DEFAULT_CENTER };
