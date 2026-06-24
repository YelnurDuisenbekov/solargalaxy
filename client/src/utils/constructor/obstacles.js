/** Модель препятствий на карте конструктора */

import { latLngToLocalMeters, localMetersToLatLng } from './calc.js';

export const OBSTACLE_SHAPES = [
  { id: 'tree', label: 'Дерево', icon: '🌳' },
  { id: 'cone', label: 'Конус', icon: '🔺' },
  { id: 'cylinder', label: 'Цилиндр', icon: '⬤' },
  { id: 'cube', label: 'Куб', icon: '⬛' },
];

export const OBSTACLE_COLORS = {
  tree: { stroke: '#15803d', fill: '#22c55e' },
  cone: { stroke: '#c2410c', fill: '#fb923c' },
  cylinder: { stroke: '#475569', fill: '#94a3b8' },
  cube: { stroke: '#b91c1c', fill: '#ef4444' },
};

const SHAPE_DEFAULTS = {
  tree: { heightM: 8, widthM: 4, lengthM: 4 },
  cone: { heightM: 6, widthM: 3, lengthM: 3 },
  cylinder: { heightM: 5, widthM: 2.5, lengthM: 2.5 },
  cube: { heightM: 3, widthM: 4, lengthM: 3 },
};

export function getShapeDefaults(shape) {
  return { ...(SHAPE_DEFAULTS[shape] || SHAPE_DEFAULTS.tree) };
}

export function defaultObstacle(shape, lat, lng, preset = {}) {
  const dims = { ...getShapeDefaults(shape), ...preset };
  return {
    id: `obs-${Date.now()}`,
    shape: shape || 'tree',
    lat,
    lng,
    heightM: dims.heightM,
    widthM: dims.widthM,
    lengthM: dims.lengthM,
    rotationDeg: 0,
  };
}

export function migrateObstacle(obs) {
  if (!obs) return null;
  const shape = obs.shape || 'tree';
  const defaults = SHAPE_DEFAULTS[shape] || SHAPE_DEFAULTS.tree;
  const legacyRadius = obs.radiusM ?? defaults.widthM / 2;
  return {
    id: obs.id || `obs-${Date.now()}`,
    shape,
    lat: obs.lat,
    lng: obs.lng,
    heightM: obs.heightM ?? defaults.heightM,
    widthM: obs.widthM ?? legacyRadius * 2,
    lengthM: obs.lengthM ?? legacyRadius * 2,
    rotationDeg: obs.rotationDeg ?? 0,
  };
}

export function migrateObstacles(list) {
  return (list || []).map(migrateObstacle).filter(Boolean);
}

export function isCircularShape(shape) {
  return shape === 'tree' || shape === 'cone' || shape === 'cylinder';
}

/** Центр и ref для локальных координат */
function obstacleRef(obs) {
  return { refLat: obs.lat, refLng: obs.lng };
}

/** 4 угла описанного прямоугольника в lat/lng */
export function obstacleCorners(obs) {
  const { refLat, refLng } = obstacleRef(obs);
  const center = { x: 0, y: 0 };
  const hw = obs.widthM / 2;
  const hl = obs.lengthM / 2;
  const rad = (obs.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const local = [
    { x: -hw, y: -hl },
    { x: hw, y: -hl },
    { x: hw, y: hl },
    { x: -hw, y: hl },
  ].map(({ x, y }) => ({
    x: center.x + x * cos - y * sin,
    y: center.y + x * sin + y * cos,
  }));
  return local.map((p) => localMetersToLatLng(p.x, p.y, refLat, refLng));
}

/** Середины сторон (для растягивания по ребру) */
export function obstacleEdgeMidpoints(obs) {
  const corners = obstacleCorners(obs);
  return corners.map((c, i) => {
    const n = corners[(i + 1) % 4];
    return { lat: (c.lat + n.lat) / 2, lng: (c.lng + n.lng) / 2, edgeIndex: i };
  });
}

/** Точки окружности для круглых фигур */
export function obstacleCircleRing(obs, segments = 32) {
  const { refLat, refLng } = obstacleRef(obs);
  const r = Math.max(obs.widthM, obs.lengthM) / 2;
  const pts = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(localMetersToLatLng(Math.cos(a) * r, Math.sin(a) * r, refLat, refLng));
  }
  return pts;
}

export function obstacleFootprintPath(obs) {
  if (isCircularShape(obs.shape)) return obstacleCircleRing(obs);
  return obstacleCorners(obs);
}

export function pointInObstacle(lat, lng, obs) {
  const path = obstacleFootprintPath(obs);
  const { refLat, refLng } = obstacleRef(obs);
  const p = latLngToLocalMeters(lat, lng, refLat, refLng);
  const local = path.map((pt) => latLngToLocalMeters(pt.lat, pt.lng, refLat, refLng));

  if (isCircularShape(obs.shape)) {
    const r = Math.max(obs.widthM, obs.lengthM) / 2;
    return Math.hypot(p.x, p.y) <= r + 0.5;
  }

  let inside = false;
  for (let i = 0, j = local.length - 1; i < local.length; j = i, i += 1) {
    const xi = local[i].x;
    const yi = local[i].y;
    const xj = local[j].x;
    const yj = local[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function findObstacleAt(obstacles, lat, lng) {
  for (let i = obstacles.length - 1; i >= 0; i -= 1) {
    if (pointInObstacle(lat, lng, obstacles[i])) return obstacles[i];
  }
  return null;
}

/** Перемещение центра */
export function moveObstacle(obs, lat, lng) {
  return { ...obs, lat, lng };
}

/** Обновление из 4 углов (после перетаскивания угла) */
export function obstacleFromCorners(corners, base) {
  if (!corners || corners.length < 4) return base;
  const refLat = corners.reduce((s, p) => s + p.lat, 0) / corners.length;
  const refLng = corners.reduce((s, p) => s + p.lng, 0) / corners.length;
  const local = corners.map((p) => latLngToLocalMeters(p.lat, p.lng, refLat, refLng));
  const center = {
    x: local.reduce((s, p) => s + p.x, 0) / 4,
    y: local.reduce((s, p) => s + p.y, 0) / 4,
  };
  const cLatLng = localMetersToLatLng(center.x, center.y, refLat, refLng);
  const e0x = local[1].x - local[0].x;
  const e0y = local[1].y - local[0].y;
  const e1x = local[2].x - local[1].x;
  const e1y = local[2].y - local[1].y;
  let widthM = Math.hypot(e0x, e0y);
  let lengthM = Math.hypot(e1x, e1y);
  let rotationDeg = (Math.atan2(e0x, e0y) * 180) / Math.PI;
  if (rotationDeg < 0) rotationDeg += 360;

  if (isCircularShape(base.shape)) {
    const avg = (widthM + lengthM) / 2;
    widthM = avg;
    lengthM = avg;
  }

  return {
    ...base,
    lat: cLatLng.lat,
    lng: cLatLng.lng,
    widthM: Math.max(0.5, Math.round(widthM * 10) / 10),
    lengthM: Math.max(0.5, Math.round(lengthM * 10) / 10),
    rotationDeg: Math.round(rotationDeg),
  };
}

/** Изменение одного угла */
export function resizeObstacleCorner(obs, cornerIndex, lat, lng) {
  const corners = obstacleCorners(obs);
  corners[cornerIndex] = { lat, lng };
  return obstacleFromCorners(corners, obs);
}

/** Растягивание по середине ребра (противоположное ребро симметрично) */
export function resizeObstacleEdge(obs, edgeIndex, lat, lng) {
  const corners = obstacleCorners(obs);
  const i = edgeIndex;
  const j = (edgeIndex + 1) % 4;
  const k = (edgeIndex + 2) % 4;
  const l = (edgeIndex + 3) % 4;

  const { refLat, refLng } = obstacleRef(obs);
  const drag = latLngToLocalMeters(lat, lng, refLat, refLng);
  const ci = latLngToLocalMeters(corners[i].lat, corners[i].lng, refLat, refLng);
  const cj = latLngToLocalMeters(corners[j].lat, corners[j].lng, refLat, refLng);
  const ck = latLngToLocalMeters(corners[k].lat, corners[k].lng, refLat, refLng);
  const cl = latLngToLocalMeters(corners[l].lat, corners[l].lng, refLat, refLng);

  const midOld = { x: (ci.x + cj.x) / 2, y: (ci.y + cj.y) / 2 };
  const dx = drag.x - midOld.x;
  const dy = drag.y - midOld.y;

  corners[i] = localMetersToLatLng(ci.x + dx, ci.y + dy, refLat, refLng);
  corners[j] = localMetersToLatLng(cj.x + dx, cj.y + dy, refLat, refLng);
  corners[k] = localMetersToLatLng(ck.x - dx, ck.y - dy, refLat, refLng);
  corners[l] = localMetersToLatLng(cl.x - dx, cl.y - dy, refLat, refLng);
  return obstacleFromCorners(corners, obs);
}

/** Эффективный радиус для расчёта тени */
export function obstacleShadowRadius(obs) {
  if (isCircularShape(obs.shape)) return Math.max(obs.widthM, obs.lengthM) / 2;
  return Math.sqrt(obs.widthM * obs.lengthM) / 2;
}

export function clampObstacleMetrics(obs) {
  const next = { ...obs };
  next.heightM = Math.min(40, Math.max(0.5, Number(next.heightM) || 1));
  next.widthM = Math.min(30, Math.max(0.5, Number(next.widthM) || 1));
  next.lengthM = Math.min(30, Math.max(0.5, Number(next.lengthM) || 1));
  next.rotationDeg = ((Math.round(Number(next.rotationDeg) || 0) % 360) + 360) % 360;
  if (isCircularShape(next.shape)) {
    const d = Math.max(next.widthM, next.lengthM);
    next.widthM = d;
    next.lengthM = d;
  }
  return next;
}

export function applyObstacleMetricsPatch(obs, patch) {
  const next = { ...obs };
  for (const [key, val] of Object.entries(patch)) {
    if (val === null || val === undefined || val === '') {
      next[key] = null;
      continue;
    }
    const n = Number(String(val).replace(',', '.'));
    if (Number.isFinite(n)) next[key] = n;
  }
  return next;
}

export function finalizeObstacleMetrics(obs) {
  return clampObstacleMetrics(obs);
}

export function updateObstacleMetrics(obs, patch) {
  return clampObstacleMetrics(applyObstacleMetricsPatch(obs, patch));
}
