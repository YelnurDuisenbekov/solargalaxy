/** Построение 3D-поверхности крыши по контуру и рёбрам */

import { computeFacets, edgeToLocal, getPolygonRef, pointSideOfEdge, toLocalPolygon } from './roofFacets.js';

function pointToSegmentDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(p.x - px, p.y - py);
}

function singleSlopeHeight(point, polyLocal, pitchDeg, azimuthDeg) {
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const downRad = (azimuthDeg * Math.PI) / 180;
  const downX = Math.sin(downRad);
  const downY = Math.cos(downRad);
  const projs = polyLocal.map((v) => v.x * downX + v.y * downY);
  const maxProj = Math.max(...projs);
  const proj = point.x * downX + point.y * downY;
  return Math.max(0, (maxProj - proj) * Math.tan(pitchRad));
}

export function facetHeightAt(point, facet, roofEdges, pitchDeg) {
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const { refLat, refLng, polygon, sides } = facet;

  if (!sides || !Object.keys(sides).length) {
    return singleSlopeHeight(point, polygon, pitchDeg, facet.azimuthDeg);
  }

  let height = 0;
  Object.entries(sides).forEach(([edgeId, side]) => {
    const edge = roofEdges.find((e) => e.id === edgeId);
    if (!edge) return;
    const el = edgeToLocal(edge, refLat, refLng);
    const ps = pointSideOfEdge(point, el);
    if (ps !== null && ps !== side) return;

    let maxRun = 0;
    polygon.forEach((v) => {
      const vs = pointSideOfEdge(v, el);
      if (vs === side || vs === null) {
        maxRun = Math.max(maxRun, pointToSegmentDistance(v, el.from, el.to));
      }
    });
    if (maxRun < 0.01) return;
    const distToRidge = pointToSegmentDistance(point, el.from, el.to);
    height = Math.max(height, (maxRun - distToRidge) * Math.tan(pitchRad));
  });

  return Math.max(0, height);
}

function pushTri3(positions, normals, a, b, c) {
  const e1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const e2 = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const nx = e1.y * e2.z - e1.z * e2.y;
  const ny = e1.z * e2.x - e1.x * e2.z;
  const nz = e1.x * e2.y - e1.y * e2.x;
  const nlen = Math.hypot(nx, ny, nz) || 1;
  [a, b, c].forEach((p) => {
    positions.push(p.x, p.y, p.z);
    normals.push(nx / nlen, ny / nlen, nz / nlen);
  });
}

function facetTopY(point, facet, roofEdges, pitchDeg, baseH) {
  return facetHeightAt(point, facet, roofEdges, pitchDeg) + baseH;
}

function edgeOnOuterBoundary(p1, p2, polyLocal, eps = 0.2) {
  if (!polyLocal || polyLocal.length < 3) return false;
  for (let i = 0; i < polyLocal.length; i += 1) {
    const a = polyLocal[i];
    const b = polyLocal[(i + 1) % polyLocal.length];
    const d1 = pointToSegmentDistance(p1, a, b);
    const d2 = pointToSegmentDistance(p2, a, b);
    if (d1 <= eps && d2 <= eps) return true;
  }
  return false;
}

/** Низ ската (плоский потолок на карнизе) + стены по карнизу */
function appendFacetUnderside(positions, normals, facet, roofEdges, pitchDeg, baseH, polyLocal) {
  const { polygon } = facet;
  if (!polygon || polygon.length < 3) return;

  for (let i = 1; i < polygon.length - 1; i += 1) {
    pushTri3(
      positions,
      normals,
      { x: polygon[0].x, y: baseH, z: polygon[0].y },
      { x: polygon[i + 1].x, y: baseH, z: polygon[i + 1].y },
      { x: polygon[i].x, y: baseH, z: polygon[i].y },
    );
  }

  for (let i = 0; i < polygon.length; i += 1) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    if (!edgeOnOuterBoundary(p1, p2, polyLocal)) continue;

    const topA = { x: p1.x, y: facetTopY(p1, facet, roofEdges, pitchDeg, baseH), z: p1.y };
    const topB = { x: p2.x, y: facetTopY(p2, facet, roofEdges, pitchDeg, baseH), z: p2.y };
    const botA = { x: p1.x, y: baseH, z: p1.y };
    const botB = { x: p2.x, y: baseH, z: p2.y };
    pushTri3(positions, normals, topA, botA, botB);
    pushTri3(positions, normals, topA, botB, topB);
  }
}

/** Закрыть пространство под коньком/ребром */
function appendRidgeUndersides(positions, normals, roofEdges, facets, refLat, refLng, pitchDeg, baseH) {
  (roofEdges || []).forEach((edge) => {
    const el = edgeToLocal(edge, refLat, refLng);
    const ridgeY = (pt) => {
      let h = 0;
      facets.forEach((f) => {
        if (!pointInLocalPolygon(pt.x, pt.y, f.polygon)) return;
        h = Math.max(h, facetHeightAt(pt, f, roofEdges, pitchDeg));
      });
      return h + baseH;
    };

    const topA = { x: el.from.x, y: ridgeY(el.from), z: el.from.y };
    const topB = { x: el.to.x, y: ridgeY(el.to), z: el.to.y };
    const botA = { x: el.from.x, y: baseH, z: el.from.y };
    const botB = { x: el.to.x, y: baseH, z: el.to.y };
    pushTri3(positions, normals, topA, botB, botA);
    pushTri3(positions, normals, topA, topB, botB);
  });
}

function pointInLocalPolygon(x, y, polygon) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Высота поверхности крыши в точке (локальные метры, y вверх) */
export function roofSurfaceYAtPoint(local, facets, roofEdges, pitchDeg, roofBaseHeightM, polyLocal) {
  const baseH = Number(roofBaseHeightM) || 0;
  let slopeH = null;

  facets?.forEach((facet) => {
    if (!pointInLocalPolygon(local.x, local.y, facet.polygon)) return;
    const h = facetHeightAt(local, facet, roofEdges, pitchDeg);
    if (slopeH === null || h < slopeH) slopeH = h;
  });

  if (slopeH === null && polyLocal && pointInLocalPolygon(local.x, local.y, polyLocal)) {
    slopeH = 0;
  }

  if (slopeH === null) return 0;
  return baseH + slopeH;
}

function getRidgeBasis(el, side) {
  const dx = el.to.x - el.from.x;
  const dy = el.to.y - el.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const alongX = dx / len;
  const alongY = dy / len;
  const downX = side === 'a' ? -dy / len : dy / len;
  const downY = side === 'a' ? dx / len : -dx / len;
  return { alongX, alongY, downX, downY, len };
}

function buildFacetHeightMesh(facet, roofEdges, pitchDeg, baseHeightM = 0) {
  const poly = facet.polygon;
  if (!poly || poly.length < 3) return { positions: [], normals: [], maxY: 0 };

  const positions = [];
  const normals = [];

  const to3 = (p) => ({
    x: p.x,
    y: facetHeightAt(p, facet, roofEdges, pitchDeg) + baseHeightM,
    z: p.y,
  });

  const pushTri = (p1, p2, p3) => {
    const a = to3(p1);
    const b = to3(p2);
    const c = to3(p3);
    pushTri3(positions, normals, a, b, c);
  };

  for (let i = 1; i < poly.length - 1; i += 1) {
    pushTri(poly[0], poly[i], poly[i + 1]);
  }

  const maxY = Math.max(...poly.map((p) => facetHeightAt(p, facet, roofEdges, pitchDeg))) + baseHeightM;
  return { positions, normals, maxY };
}

/** @deprecated — используйте buildFacetHeightMesh */
function buildFacetSlopedMesh(facet, roofEdges, pitchDeg, baseHeightM = 0) {
  const { refLat, refLng, polygon, sides } = facet;
  const edgeId = Object.keys(sides)[0];
  const edge = roofEdges.find((e) => e.id === edgeId);
  if (!edge) return { positions: [], normals: [], maxY: 0 };

  const el = edgeToLocal(edge, refLat, refLng);
  const side = sides[edgeId];
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const { alongX, alongY, downX, downY } = getRidgeBasis(el, side);

  let maxRun = 0;
  polygon.forEach((p) => {
    const relX = p.x - el.from.x;
    const relY = p.y - el.from.y;
    const w = relX * downX + relY * downY;
    maxRun = Math.max(maxRun, w);
  });
  if (maxRun < 0.01) return { positions: [], normals: [], maxY: 0 };

  const positions = [];
  const normals = [];

  const pushTri = (p1, p2, p3) => {
    const to3 = (p) => {
      const relX = p.x - el.from.x;
      const relY = p.y - el.from.y;
      const w = Math.max(0, relX * downX + relY * downY);
      const y = Math.max(0, (maxRun - w) * Math.tan(pitchRad)) + baseHeightM;
      return { x: p.x, y, z: p.y };
    };
    const a = to3(p1);
    const b = to3(p2);
    const c = to3(p3);
    const e1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const e2 = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const nx = e1.y * e2.z - e1.z * e2.y;
    const ny = e1.z * e2.x - e1.x * e2.z;
    const nz = e1.x * e2.y - e1.y * e2.x;
    const nlen = Math.hypot(nx, ny, nz) || 1;
    [a, b, c].forEach((p) => {
      positions.push(p.x, p.y, p.z);
      normals.push(nx / nlen, ny / nlen, nz / nlen);
    });
  };

  const ridgePts = [];
  const eavePts = [];
  const threshold = Math.min(0.5, maxRun * 0.05);

  polygon.forEach((p) => {
    const relX = p.x - el.from.x;
    const relY = p.y - el.from.y;
    const w = Math.max(0, relX * downX + relY * downY);
    if (w < threshold) ridgePts.push(p);
    else eavePts.push(p);
  });

  const sortAlongRidge = (arr) => arr.sort((a, b) => {
    const ta = (a.x - el.from.x) * alongX + (a.y - el.from.y) * alongY;
    const tb = (b.x - el.from.x) * alongX + (b.y - el.from.y) * alongY;
    return ta - tb;
  });

  sortAlongRidge(ridgePts);
  sortAlongRidge(eavePts);

  if (ridgePts.length >= 2 && eavePts.length >= 2) {
    pushTri(ridgePts[0], ridgePts[ridgePts.length - 1], eavePts[0]);
    pushTri(ridgePts[ridgePts.length - 1], eavePts[eavePts.length - 1], eavePts[0]);
  } else {
    for (let i = 1; i < polygon.length - 1; i += 1) {
      pushTri(polygon[0], polygon[i], polygon[i + 1]);
    }
  }

  const maxY = positions.length
    ? Math.max(...positions.filter((_, i) => i % 3 === 1))
    : 0;

  return { positions, normals, maxY };
}

function buildSingleSlopeMesh(facet, pitchDeg, baseHeightM = 0) {
  const poly = facet.polygon;
  const positions = [];
  const normals = [];

  const to3 = (p) => ({
    x: p.x,
    y: singleSlopeHeight(p, poly, pitchDeg, facet.azimuthDeg) + baseHeightM,
    z: p.y,
  });

  const pushTri = (p1, p2, p3) => {
    const a = to3(p1);
    const b = to3(p2);
    const c = to3(p3);
    const e1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const e2 = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const nx = e1.y * e2.z - e1.z * e2.y;
    const ny = e1.z * e2.x - e1.x * e2.z;
    const nz = e1.x * e2.y - e1.y * e2.x;
    const nlen = Math.hypot(nx, ny, nz) || 1;
    [a, b, c].forEach((p) => {
      positions.push(p.x, p.y, p.z);
      normals.push(nx / nlen, ny / nlen, nz / nlen);
    });
  };

  for (let i = 1; i < poly.length - 1; i += 1) {
    pushTri(poly[0], poly[i], poly[i + 1]);
  }

  const maxY = Math.max(...poly.map((p) => singleSlopeHeight(p, poly, pitchDeg, facet.azimuthDeg))) + baseHeightM;
  return { positions, normals, maxY };
}

export function buildRoofSurfaceData(roofPolygon, roofEdges, pitchDeg, azimuthDeg, roofBaseHeightM = 0, azimuthOverrides = {}) {
  if (!roofPolygon || roofPolygon.length < 3) return null;

  const pitch = Number(pitchDeg) || 0;
  const baseH = Number(roofBaseHeightM) || 0;
  const facets = computeFacets(roofPolygon, roofEdges, pitch, azimuthDeg, azimuthOverrides);
  if (!facets.length) return null;

  const { refLat, refLng } = getPolygonRef(roofPolygon);
  const polyLocal = toLocalPolygon(roofPolygon, refLat, refLng);

  const vertices = [];
  const normals = [];
  const solidVertices = [];
  const solidNormals = [];
  const facetGroups = [];
  let globalMaxY = 0;

  facets.forEach((facet, idx) => {
    const mesh = buildFacetHeightMesh(facet, roofEdges, pitch, baseH);

    globalMaxY = Math.max(globalMaxY, mesh.maxY);
    if (mesh.positions.length < 9) return;

    appendFacetUnderside(solidVertices, solidNormals, facet, roofEdges, pitch, baseH, polyLocal);

    const isActive = facet.active !== false;
    facetGroups.push({
      id: facet.id,
      label: facet.label,
      active: isActive,
      startIndex: vertices.length / 3,
      count: mesh.positions.length / 3,
      color: isActive
        ? (idx % 2 === 0 ? 0x64748b : 0x556275)
        : 0x94a3b8,
    });
    vertices.push(...mesh.positions);
    normals.push(...mesh.normals);
  });

  appendRidgeUndersides(solidVertices, solidNormals, roofEdges, facets, refLat, refLng, pitch, baseH);

  const cx = polyLocal.reduce((s, p) => s + p.x, 0) / polyLocal.length;
  const cz = polyLocal.reduce((s, p) => s + p.y, 0) / polyLocal.length;

  const ridgeLines = (roofEdges || []).map((edge) => {
    const el = edgeToLocal(edge, refLat, refLng);
    const ridgeH = (pt) => {
      let h = 0;
      facets.forEach((f) => {
        h = Math.max(h, facetHeightAt(pt, f, roofEdges, pitch));
      });
      return h + baseH;
    };
    return {
      from: { x: el.from.x, y: ridgeH(el.from), z: el.from.y },
      to: { x: el.to.x, y: ridgeH(el.to), z: el.to.y },
    };
  });

  return {
    vertices,
    normals,
    solidVertices,
    solidNormals,
    facetGroups,
    facets,
    cx,
    cz,
    ridgeLines,
    maxHeight: globalMaxY,
    roofBaseHeightM: baseH,
    refLat,
    refLng,
    polyLocal,
  };
}
