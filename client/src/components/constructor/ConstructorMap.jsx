import { useEffect, useRef } from 'react';

import L from 'leaflet';

import 'leaflet/dist/leaflet.css';

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

  selectedObstacleId,

  drawMode,

  mapStyle = 'hybrid',

  flyToKey,

  onMapClick,

  onObstacleAdd,

  onObstacleSelect,

  onObstacleUpdate,

}) {

  const mapRef = useRef(null);

  const mapInstance = useRef(null);

  const baseLayerRef = useRef(null);

  const layersRef = useRef({ polygon: null, edges: [], draft: null, markers: [], obstacles: [], obstacleHandles: [], pin: null });

  const drawModeRef = useRef(drawMode);

  const obstaclesRef = useRef(obstacles);

  const callbacksRef = useRef({ onObstacleAdd, onObstacleSelect, onObstacleUpdate, onMapClick });



  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);

  useEffect(() => { obstaclesRef.current = obstacles; }, [obstacles]);

  useEffect(() => {
    callbacksRef.current = { onObstacleAdd, onObstacleSelect, onObstacleUpdate, onMapClick };
  }, [onObstacleAdd, onObstacleSelect, onObstacleUpdate, onMapClick]);



  useEffect(() => {

    if (mapInstance.current || !mapRef.current) return;



    const map = L.map(mapRef.current, { zoomControl: true }).setView([lat, lng], 18);

    const layers = buildLayers();

    baseLayerRef.current = layers[mapStyle] || layers.hybrid;

    baseLayerRef.current.addTo(map);



    map.on('click', (e) => {

      const pos = { lat: e.latlng.lat, lng: e.latlng.lng };

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

    layersRef.current.obstacleHandles.forEach((h) => h.remove());

    layersRef.current.obstacleHandles = [];

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

      const colors = OBSTACLE_COLORS[obs.shape] || OBSTACLE_COLORS.tree;

      const selected = obs.id === selectedObstacleId;

      const path = obstacleFootprintPath(obs).map((p) => [p.lat, p.lng]);

      const poly = L.polygon(path, {

        color: selected ? '#E3A50B' : colors.stroke,

        fillColor: colors.fill,

        fillOpacity: selected ? 0.42 : 0.3,

        weight: selected ? 3 : 2,

      }).addTo(map).bindTooltip(`${obs.shape}, h=${obs.heightM} м`);

      poly.on('click', () => callbacksRef.current.onObstacleSelect?.(obs.id));

      layersRef.current.obstacles.push(poly);

      if (!selected) return;

      const handleIcon = (fill, size = 14) => L.divIcon({
        className: 'constructor-obs-handle',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `<span class="constructor-obs-handle__dot" style="width:${size}px;height:${size}px;background:${fill}"></span>`,
      });

      const center = L.marker([obs.lat, obs.lng], {
        draggable: true,
        icon: handleIcon('#E3A50B', 18),
      }).addTo(map);

      center.on('dragend', (e) => {
        const ll = e.target.getLatLng();
        callbacksRef.current.onObstacleUpdate?.(moveObstacle(obs, ll.lat, ll.lng));
      });

      layersRef.current.obstacleHandles.push(center);

      obstacleCorners(obs).forEach((c, idx) => {

        const m = L.marker([c.lat, c.lng], {
          draggable: true,
          icon: handleIcon('#ffffff', 14),
        }).addTo(map);

        m.on('dragend', (e) => {
          const ll = e.target.getLatLng();
          callbacksRef.current.onObstacleUpdate?.(resizeObstacleCorner(obs, idx, ll.lat, ll.lng));
        });

        layersRef.current.obstacleHandles.push(m);

      });

      obstacleEdgeMidpoints(obs).forEach(({ lat: mLat, lng: mLng, edgeIndex }) => {

        const m = L.marker([mLat, mLng], {
          draggable: true,
          icon: handleIcon('#93c5fd', 12),
        }).addTo(map);

        m.on('dragend', (e) => {
          const ll = e.target.getLatLng();
          callbacksRef.current.onObstacleUpdate?.(resizeObstacleEdge(obs, edgeIndex, ll.lat, ll.lng));
        });

        layersRef.current.obstacleHandles.push(m);

      });

    });

  }, [roofPolygon, roofRectDraft, roofEdges, edgeDraft, obstacles, selectedObstacleId, lat, lng]);



  const modeHint = {

    roof: 'Кликайте по углам крыши на спутнике (минимум 3 точки)',

    edge: edgeDraft?.length ? 'Рёбра: 2-й клик — направление, линия до периметра' : 'Рёбра: 1-й клик на крыше или у края',

    obstacle: 'Клик — новое препятствие · клик по фигуре — выбор · тяните маркеры',

    view: 'Просмотр — клик по препятствию для выбора',

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

        Препятствий: {obstacles?.length || 0}

        {' · '}

        {lat.toFixed(5)}, {lng.toFixed(5)}

      </p>

    </div>

  );

}



export { DEFAULT_CENTER };


