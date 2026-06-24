/** Геометрия рёбер крыши и скатов (сторон) для расстановки панелей и 3D */

import { latLngToLocalMeters } from './calc.js';

export function getPolygonRef(roofPolygon) {
  const refLat = roofPolygon.reduce((s, p) => s + p.lat, 0) / roofPolygon.length;
  const refLng = roofPolygon.reduce((s, p) => s + p.lng, 0) / roofPolygon.length;
  return { refLat, refLng };
}

export function toLocalPolygon(roofPolygon, refLat, refLng) {
  return roofPolygon.map((p) => latLngToLocalMeters(p.lat, p.lng, refLat, refLng));
}

export function edgeToLocal(edge, refLat, refLng) {
  return {
    from: latLngToLocalMeters(edge.from.lat, edge.from.lng, refLat, refLng),
    to: latLngToLocalMeters(edge.to.lat, edge.to.lng, refLat, refLng),
  };
}

/** Сторона относительно направления from→to: a — слева, b — справа */
export function pointSideOfEdge(point, edgeLocal) {
  const { from, to } = edgeLocal;
  const cross = (to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x);
  if (Math.abs(cross) < 1e-9) return null;
  return cross > 0 ? 'a' : 'b';
}

function lineIntersection(p1, p2, p3, p4) {
  const x1 = p1.x;
  const y1 = p1.y;
  const x2 = p2.x;
  const y2 = p2.y;
  const x3 = p3.x;
  const y3 = p3.y;
  const x4 = p4.x;
  const y4 = p4.y;
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-12) return null;
  const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom;
  const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom;
  return { x: px, y: py };
}

export function clipPolygonByHalfPlane(polygon, edgeLocal, keepSide) {
  if (polygon.length < 3) return [];
  const { from, to } = edgeLocal;
  const output = [];

  for (let i = 0; i < polygon.length; i += 1) {
    const curr = polygon[i];
    const prev = polygon[(i + polygon.length - 1) % polygon.length];
    const currSide = pointSideOfEdge(curr, edgeLocal);
    const prevSide = pointSideOfEdge(prev, edgeLocal);
    const currInside = currSide === keepSide || currSide === null;
    const prevInside = prevSide === keepSide || prevSide === null;

    if (currInside) {
      if (!prevInside) {
        const inter = lineIntersection(prev, curr, from, to);
        if (inter) output.push(inter);
      }
      output.push(curr);
    } else if (prevInside) {
      const inter = lineIntersection(prev, curr, from, to);
      if (inter) output.push(inter);
    }
  }

  return output.length >= 3 ? output : [];
}

export function facetIdForPoint(point, roofEdges, refLat, refLng) {
  if (!roofEdges?.length) return 'whole';
  let mask = 0;
  for (let i = 0; i < roofEdges.length; i += 1) {
    const el = edgeToLocal(roofEdges[i], refLat, refLng);
    const side = pointSideOfEdge(point, el);
    if (side === 'b') mask |= (1 << i);
    else if (side !== 'a') return null;
  }
  return `f-${mask}`;
}

/** @deprecated use facetIdForPoint */
export function facetSignature(point, roofEdges, refLat, refLng) {
  return facetIdForPoint(point, roofEdges, refLat, refLng) || 'n';
}

export function isPointInActiveRegion(point, roofEdges, refLat, refLng) {
  if (!roofEdges?.length) return true;
  for (const edge of roofEdges) {
    const el = edgeToLocal(edge, refLat, refLng);
    const side = pointSideOfEdge(point, el);
    if (side === null) continue;
    if (side === 'a' && !edge.sideAActive) return false;
    if (side === 'b' && !edge.sideBActive) return false;
  }
  return true;
}

/** Азимут ската (куда «смотрит» плоскость): 180° = юг */
export function sideAzimuthDeg(edge, side, refLat, refLng) {
  const { from, to } = edgeToLocal(edge, refLat, refLng);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  let fx;
  let fy;
  if (side === 'a') {
    fx = dy / len;
    fy = -dx / len;
  } else {
    fx = -dy / len;
    fy = dx / len;
  }
  let az = (Math.atan2(fx, fy) * 180) / Math.PI;
  if (az < 0) az += 360;
  return Math.round(az);
}

function polygonAreaLocal(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const j = (i + 1) % points.length;
    sum += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(sum) / 2;
}

export function computeFacets(roofPolygon, roofEdges, pitchDeg, fallbackAzimuth) {
  if (!roofPolygon || roofPolygon.length < 3) return [];

  const { refLat, refLng } = getPolygonRef(roofPolygon);
  const polyLocal = toLocalPolygon(roofPolygon, refLat, refLng);

  if (!roofEdges?.length) {
    return [{
      id: 'whole',
      polygon: polyLocal,
      pitchDeg,
      azimuthDeg: fallbackAzimuth,
      active: true,
      label: 'Весь контур',
      areaM2: Math.round(polygonAreaLocal(polyLocal)),
      refLat,
      refLng,
    }];
  }

  const n = roofEdges.length;
  const facets = [];

  for (let mask = 0; mask < (1 << n); mask += 1) {
    let poly = polyLocal;
    const sides = {};
    let active = true;
    const labelParts = [];

    for (let i = 0; i < n; i += 1) {
      const edge = roofEdges[i];
      const side = (mask & (1 << i)) ? 'b' : 'a';
      sides[edge.id] = side;
      const sideActive = side === 'a' ? edge.sideAActive : edge.sideBActive;
      if (!sideActive) {
        active = false;
        break;
      }
      const el = edgeToLocal(edge, refLat, refLng);
      poly = clipPolygonByHalfPlane(poly, el, side);
      if (poly.length < 3) {
        active = false;
        break;
      }
      labelParts.push(`Р${i + 1}${side === 'a' ? 'А' : 'Б'}`);
    }

    if (!active || poly.length < 3) continue;

    const area = polygonAreaLocal(poly);
    if (area < 0.5) continue;

    const azEdge = roofEdges[roofEdges.length - 1];
    const azimuthDeg = sideAzimuthDeg(azEdge, sides[azEdge.id], refLat, refLng);

    facets.push({
      id: `f-${mask}`,
      polygon: poly,
      pitchDeg,
      azimuthDeg,
      active: true,
      sides,
      label: labelParts.join(' · '),
      areaM2: Math.round(area),
      refLat,
      refLng,
    });
  }

  return facets;
}

export function migrateRidgeToEdges(raw) {
  const state = { ...raw };
  if (!state.roofEdges?.length && state.ridgeLine?.from && state.ridgeLine?.to) {
    state.roofEdges = [{
      id: 'edge-1',
      from: state.ridgeLine.from,
      to: state.ridgeLine.to,
      sideAActive: true,
      sideBActive: true,
    }];
  }
  if (!state.roofEdges) state.roofEdges = [];
  if (!state.edgeDraft) state.edgeDraft = [];
  delete state.ridgeLine;
  delete state.ridgeDraft;
  if (state.drawMode === 'ridge') state.drawMode = 'edge';
  return state;
}
