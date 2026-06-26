import { useEffect, useRef, useState } from 'react';

import L from 'leaflet';

import 'leaflet/dist/leaflet.css';

import { createLeafletProjection } from '../../utils/constructor/mapProjection.js';
import ConstructorRoofGeometryHud from './ConstructorRoofGeometryHud.jsx';

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

  azimuthArrow,
  azimuthDraft,

  obstacles,

  selectedObstacleId,

  drawMode,

  mapStyle = 'hybrid',

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

  const mapInstance = useRef(null);

  const projectionRef = useRef(null);

  const [mapProjection, setMapProjection] = useState(null);

  const baseLayerRef = useRef(null);

  const layersRef = useRef({ polygon: null, facets: [], edges: [], draft: null, azimuth: null, markers: [], obstacles: [], obstacleHandles: [], pin: null });

  const drawModeRef = useRef(drawMode);

  const obstaclesRef = useRef(obstacles);

  const obstacleDragRef = useRef(null);

  const obstacleDragMovedRef = useRef(false);

  const callbacksRef = useRef({
    onObstacleAdd, onObstacleSelect, onObstacleUpdate, onObstacleGestureStart, onMapClick,
    onRoofVertexDrag, onRoofVertexSelect, onRoofEdgeSelect,
  });



  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);

  useEffect(() => { obstaclesRef.current = obstacles; }, [obstacles]);

  useEffect(() => {
    callbacksRef.current = {
      onObstacleAdd, onObstacleSelect, onObstacleUpdate, onObstacleGestureStart, onMapClick,
      onRoofVertexDrag, onRoofVertexSelect, onRoofEdgeSelect,
    };
  }, [onObstacleAdd, onObstacleSelect, onObstacleUpdate, onObstacleGestureStart, onMapClick, onRoofVertexDrag, onRoofVertexSelect, onRoofEdgeSelect]);



  useEffect(() => {

    if (mapInstance.current || !mapRef.current) return;



    const map = L.map(mapRef.current, { zoomControl: true }).setView([lat, lng], 18);

    const layers = buildLayers();

    baseLayerRef.current = layers[mapStyle] || layers.hybrid;

    baseLayerRef.current.addTo(map);



    map.on('click', (e) => {

      if (obstacleDragMovedRef.current) return;

      const pos = { lat: e.latlng.lat, lng: e.latlng.lng };

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

      map.dragging.enable();

      map.getContainer().style.cursor = '';

      obstacleDragRef.current = null;

      window.setTimeout(() => { obstacleDragMovedRef.current = false; }, 0);

    };



    const onObstacleDragMove = (e) => {

      const drag = obstacleDragRef.current;

      if (!drag) return;

      obstacleDragMovedRef.current = true;

      const current = obstaclesRef.current?.find((o) => o.id === drag.id) || drag.baseObs;

      drag.baseObs = current;

      const moved = obstacleAtDragDelta(drag, e.latlng.lat, e.latlng.lng);

      callbacksRef.current.onObstacleUpdate?.(moved, { transient: true });

    };



    map.on('mousemove', onObstacleDragMove);

    map.on('mouseup', finishObstacleDrag);

    map.on('mouseleave', finishObstacleDrag);



    mapInstance.current = map;

    projectionRef.current = createLeafletProjection(map);
    setMapProjection(projectionRef.current);

    const ro = new ResizeObserver(() => {
      window.requestAnimationFrame(() => map.invalidateSize());
    });
    if (mapRef.current) ro.observe(mapRef.current);

    return () => {
      ro.disconnect();

      projectionRef.current?.destroy?.();
      projectionRef.current = null;
      setMapProjection(null);

      map.off('mousemove', onObstacleDragMove);
      map.off('mouseup', finishObstacleDrag);
      map.off('mouseleave', finishObstacleDrag);

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



    const isRefine = drawMode === 'refine';

    layersRef.current.markers.forEach((m) => m.remove());

    layersRef.current.markers = [];

    layersRef.current.pin?.remove();

    layersRef.current.polygon?.remove();

    layersRef.current.facets.forEach((f) => f.remove());
    layersRef.current.facets = [];

    layersRef.current.edges.forEach((e) => e.remove());

    layersRef.current.edges = [];

    layersRef.current.draft?.remove();
    layersRef.current.azimuth?.remove();

    layersRef.current.obstacles.forEach((o) => o.remove());

    layersRef.current.obstacles = [];

    layersRef.current.obstacleHandles.forEach((h) => h.remove());

    layersRef.current.obstacleHandles = [];

    layersRef.current.polygon = null;

    layersRef.current.draft = null;
    layersRef.current.azimuth = null;



    layersRef.current.pin = L.circleMarker([lat, lng], {

      radius: 8,

      color: '#103B5E',

      fillColor: '#E3A50B',

      fillOpacity: 1,

      weight: 2,

      interactive: false,

    });

    if (!isRefine) layersRef.current.pin.addTo(map).bindTooltip('Центр объекта');



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

      const selected = selectedRoofVertexIndex === i;

      const marker = L.circleMarker([p.lat, p.lng], {

        radius: isRefine ? 11 : 9,

        color: selected ? '#103B5E' : '#E3A50B',

        fillColor: selected ? '#E3A50B' : '#fff',

        fillOpacity: 1,

        weight: selected ? 4 : 3,

        draggable: isRefine,

        interactive: true,

      }).addTo(map).bindTooltip(`Угол ${i + 1}`, { permanent: false });

      if (isRefine) {
        marker.on('click', () => callbacksRef.current.onRoofVertexSelect?.(i));
        marker.on('dragend', (e) => {
          const { lat: plat, lng: plng } = e.target.getLatLng();
          callbacksRef.current.onRoofVertexDrag?.(i, plat, plng);
        });
      }

      layersRef.current.markers.push(marker);

    });



    if (roofPolygon?.length >= 3) {
      const mapFacets = facetsForMapDraw(
        roofPolygon,
        roofEdges,
        pitchDeg,
        azimuthDeg,
        facetAzimuthOverrides,
      );

      mapFacets.forEach((facet, idx) => {
        const style = facetMapStyle(facet, idx, selectedFacetId);
        const path = facetRingLatLng(facet).map((p) => [p.lat, p.lng]);
        const poly = L.polygon(path, {
          color: style.stroke,
          fillColor: style.fill,
          fillOpacity: style.fillOpacity,
          weight: style.strokeWeight,
          interactive: false,
        }).addTo(map);
        layersRef.current.facets.push(poly);
      });

      const hasFacetFill = mapFacets.length > 0;

      layersRef.current.polygon = L.polygon(

        roofPolygon.map((p) => [p.lat, p.lng]),

        {
          color: '#1B8A45',
          fillColor: '#1B8A45',
          fillOpacity: hasFacetFill ? 0 : (isRefine ? 0.12 : 0.28),
          weight: isRefine ? 2.5 : 2,
          interactive: isRefine,
        },

      ).addTo(map);

      if (isRefine) {
        layersRef.current.polygon.on('click', (e) => {
          callbacksRef.current.onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }

    } else if (roofPolygon?.length >= 2) {

      layersRef.current.polygon = L.polyline(

        roofPolygon.map((p) => [p.lat, p.lng]),

        { color: '#1B8A45', weight: 2, dashArray: '6 4', interactive: false },

      ).addTo(map);

    }



    if (roofPolygon?.length >= 3) {
      for (let i = 0; i < roofPolygon.length; i += 1) {
        const a = roofPolygon[i];
        const b = roofPolygon[(i + 1) % roofPolygon.length];
        const isEave = slopeEaveEdgeIndex === i;
        const isSel = selectedRoofEdgeIndex === i;
        const line = L.polyline(
          edgeLinePathLatLng(a, b, roofPolygon).map((p) => [p.lat, p.lng]),
          {
            color: isEave ? '#E3A50B' : (isSel ? '#0ea5e9' : '#1B8A45'),
            weight: isEave ? 5 : (isSel ? 4 : 2),
            opacity: isEave || isSel ? 1 : 0.55,
            interactive: isRefine || drawMode === 'azimuth',
          },
        ).addTo(map);
        if (isRefine || drawMode === 'azimuth') {
          const edgeIdx = i;
          line.on('click', () => callbacksRef.current.onRoofEdgeSelect?.(edgeIdx));
        }
        layersRef.current.edges.push(line);
      }
    }



    roofEdges?.forEach((edge, idx) => {

      if (!edge.from || !edge.to) return;

      const line = L.polyline(

        edgeLinePathLatLng(edge.from, edge.to, roofPolygon).map((p) => [p.lat, p.lng]),

        { color: '#103B5E', weight: 4, interactive: false },

      ).addTo(map).bindTooltip(`Ребро ${idx + 1}`);

      layersRef.current.edges.push(line);

    });



    if (edgeDraft?.length) {

      layersRef.current.draft = L.polyline(

        edgeDraft.length >= 2
          ? edgeLinePathLatLng(edgeDraft[0], edgeDraft[1], roofPolygon).map((p) => [p.lat, p.lng])
          : edgeDraft.map((p) => [p.lat, p.lng]),

        { color: '#103B5E', weight: 3, dashArray: '4 4', interactive: false },

      ).addTo(map);

    }

    if (azimuthArrow?.from && azimuthArrow?.to) {
      layersRef.current.azimuth = L.polyline(
        edgeLinePathLatLng(azimuthArrow.from, azimuthArrow.to, roofPolygon, 32).map((p) => [p.lat, p.lng]),
        { color: '#E3A50B', weight: 4, interactive: false },
      ).addTo(map);
    } else if (azimuthDraft?.length === 1) {
      layersRef.current.azimuth = L.polyline(
        edgeLinePathLatLng(azimuthDraft[0], { lat, lng }, roofPolygon, 16).map((p) => [p.lat, p.lng]),
        { color: '#E3A50B', weight: 3, dashArray: '6 4', interactive: false },
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

      }).addTo(map).bindTooltip(`${obs.shape}, h=${obs.heightM} м · тяните для перемещения`);

      poly.on('click', () => callbacksRef.current.onObstacleSelect?.(obs.id));

      if (canDragObstacleOnMap(drawMode)) {

        poly.on('mousedown', (e) => {

          L.DomEvent.stopPropagation(e);

          map.dragging.disable();

          obstacleDragMovedRef.current = false;

          obstacleDragRef.current = startObstacleDrag(obs, e.latlng.lat, e.latlng.lng);

          callbacksRef.current.onObstacleGestureStart?.();

          callbacksRef.current.onObstacleSelect?.(obs.id);

          map.getContainer().style.cursor = 'grabbing';

        });

        poly.on('mouseover', () => {

          if (canDragObstacleOnMap(drawModeRef.current)) {

            map.getContainer().style.cursor = 'grab';

          }

        });

        poly.on('mouseout', () => {

          if (!obstacleDragRef.current) map.getContainer().style.cursor = '';

        });

      }

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

  }, [roofPolygon, roofRectDraft, roofEdges, edgeDraft, azimuthArrow, azimuthDraft, obstacles, selectedObstacleId, lat, lng, drawMode, selectedRoofVertexIndex, selectedRoofEdgeIndex, slopeEaveEdgeIndex, pitchDeg, azimuthDeg, facetAzimuthOverrides, selectedFacetId]);



  const modeHint = {

    roof: 'Кликайте по углам крыши на спутнике (минимум 3 точки)',

    refine: 'Чертёж: тяните углы · L — длина · ∠ — угол',

    edge: 'Рёбра: перпендикулярный — клик по краю; свободный — 2 точки',

    azimuth: 'Односкатная: клик по карнизу · иначе — стрелка',

    obstacle: 'Клик — новое препятствие · тяните фигуру или маркеры · Enter в полях — применить',

    view: 'Тяните препятствие по карте · клик — выбор',

  }[drawMode] || '';



  return (

    <div className={`constructor-map-wrap constructor-map-wrap--${drawMode}`}>

      <div ref={mapRef} className="constructor-map" />

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


