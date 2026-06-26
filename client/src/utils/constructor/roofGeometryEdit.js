/** Точное редактирование контура крыши: длины сторон, углы, перемещение вершин */

import { latLngToLocalMeters, localMetersToLatLng } from './calc.js';
import { getPolygonRef, toLocalPolygon } from './roofFacets.js';

function dist2d(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Внутренний угол в вершине curr, ° (0–180) */
export function interiorAngleDeg(prev, curr, next) {
  const v1x = prev.x - curr.x;
  const v1y = prev.y - curr.y;
  const v2x = next.x - curr.x;
  const v2y = next.y - curr.y;
  const len1 = Math.hypot(v1x, v1y);
  const len2 = Math.hypot(v2x, v2y);
  if (len1 < 1e-9 || len2 < 1e-9) return 0;
  let cos = (v1x * v2x + v1y * v2y) / (len1 * len2);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function getRoofBlueprint(roofPolygon) {
  if (!roofPolygon || roofPolygon.length < 3) {
    return { vertices: [], edges: [], refLat: 0, refLng: 0 };
  }

  const { refLat, refLng } = getPolygonRef(roofPolygon);
  const poly = toLocalPolygon(roofPolygon, refLat, refLng);
  const n = poly.length;

  const vertices = poly.map((curr, i) => {
    const prev = poly[(i - 1 + n) % n];
    const next = poly[(i + 1) % n];
    return {
      index: i,
      lat: roofPolygon[i].lat,
      lng: roofPolygon[i].lng,
      interiorAngleDeg: Math.round(interiorAngleDeg(prev, curr, next) * 10) / 10,
    };
  });

  const edges = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const mid = localMetersToLatLng((a.x + b.x) / 2, (a.y + b.y) / 2, refLat, refLng);
    return {
      index: i,
      lengthM: Math.round(dist2d(a, b) * 100) / 100,
      fromIndex: i,
      toIndex: (i + 1) % n,
      midLat: mid.lat,
      midLng: mid.lng,
    };
  });

  return { vertices, edges, refLat, refLng };
}

export function moveRoofVertex(roofPolygon, vertexIndex, lat, lng) {
  if (!roofPolygon?.length || vertexIndex < 0 || vertexIndex >= roofPolygon.length) {
    return roofPolygon;
  }
  return roofPolygon.map((p, i) => (i === vertexIndex ? { lat, lng } : p));
}

/** Задать длину ребра edgeIndex (от вершины i к i+1); хвост контура сдвигается */
export function setRoofEdgeLengthM(roofPolygon, edgeIndex, lengthM) {
  if (!roofPolygon || roofPolygon.length < 3) return roofPolygon;
  const len = Number(lengthM);
  if (!Number.isFinite(len) || len < 0.1) return roofPolygon;

  const n = roofPolygon.length;
  const { refLat, refLng } = getPolygonRef(roofPolygon);
  const poly = toLocalPolygon(roofPolygon, refLat, refLng).map((p) => ({ ...p }));

  const a = poly[edgeIndex];
  const bi = (edgeIndex + 1) % n;
  const b = poly[bi];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const curLen = Math.hypot(dx, dy) || 1;
  const ux = dx / curLen;
  const uy = dy / curLen;
  const newB = { x: a.x + ux * len, y: a.y + uy * len };
  const dispX = newB.x - b.x;
  const dispY = newB.y - b.y;

  poly[bi] = newB;
  for (let j = edgeIndex + 2; j < n; j += 1) {
    poly[j] = { x: poly[j].x + dispX, y: poly[j].y + dispY };
  }

  return poly.map((p) => localMetersToLatLng(p.x, p.y, refLat, refLng));
}

/** Задать внутренний угол в вершине; последующие вершины вращаются вокруг неё */
export function setRoofVertexAngleDeg(roofPolygon, vertexIndex, angleDeg) {
  if (!roofPolygon || roofPolygon.length < 3) return roofPolygon;
  const target = Number(angleDeg);
  if (!Number.isFinite(target) || target < 1 || target > 179) return roofPolygon;

  const n = roofPolygon.length;
  const { refLat, refLng } = getPolygonRef(roofPolygon);
  const poly = toLocalPolygon(roofPolygon, refLat, refLng).map((p) => ({ ...p }));

  const prev = poly[(vertexIndex - 1 + n) % n];
  const curr = poly[vertexIndex];
  const next = poly[(vertexIndex + 1) % n];
  const current = interiorAngleDeg(prev, curr, next);
  const deltaRad = ((target - current) * Math.PI) / 180;
  if (Math.abs(deltaRad) < 1e-9) return roofPolygon;

  const cos = Math.cos(deltaRad);
  const sin = Math.sin(deltaRad);
  const rotate = (p) => {
    const dx = p.x - curr.x;
    const dy = p.y - curr.y;
    return {
      x: curr.x + dx * cos - dy * sin,
      y: curr.y + dx * sin + dy * cos,
    };
  };

  for (let j = vertexIndex + 1; j < n; j += 1) {
    poly[j] = rotate(poly[j]);
  }

  return poly.map((p) => localMetersToLatLng(p.x, p.y, refLat, refLng));
}

/** Ближайшее ребро к точке клика */
export function findNearestRoofEdgeIndex(point, roofPolygon, maxDistM = 12) {
  if (!roofPolygon || roofPolygon.length < 3) return null;

  const { refLat, refLng } = getPolygonRef(roofPolygon);
  const poly = toLocalPolygon(roofPolygon, refLat, refLng);
  const p = latLngToLocalMeters(point.lat, point.lng, refLat, refLng);

  let bestIdx = null;
  let bestDist = maxDistM;

  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 1e-12) {
      t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
    }
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  return bestIdx;
}

/**
 * Азимут односкатной крыши по выбранному карнизу (ребро edgeIndex).
 * Направление ската — внутрь контура, перпендикулярно карнизу.
 */
export function azimuthFromEaveEdge(roofPolygon, edgeIndex) {
  if (!roofPolygon || roofPolygon.length < 3 || edgeIndex == null) return null;

  const { refLat, refLng } = getPolygonRef(roofPolygon);
  const poly = toLocalPolygon(roofPolygon, refLat, refLng);
  const n = poly.length;
  const i = ((edgeIndex % n) + n) % n;
  const a = poly[i];
  const b = poly[(i + 1) % n];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;

  let nx = -dy / len;
  let ny = dx / len;
  const cx = poly.reduce((s, p) => s + p.x, 0) / n;
  const cy = poly.reduce((s, p) => s + p.y, 0) / n;
  const midx = (a.x + b.x) / 2;
  const midy = (a.y + b.y) / 2;
  if ((cx - midx) * nx + (cy - midy) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }

  let az = (Math.atan2(nx, ny) * 180) / Math.PI;
  if (az < 0) az += 360;
  return Math.round(az);
}
