import { localMetersToLatLng } from './calc.js';
import { computeFacets } from './roofFacets.js';

/** Цвета заливки скатов на карте (чередуются) */
export const FACET_MAP_PALETTE = [
  { fill: '#1B8A45', stroke: '#15803d' },
  { fill: '#3b82f6', stroke: '#1d4ed8' },
  { fill: '#8b5cf6', stroke: '#6d28d9' },
  { fill: '#0d9488', stroke: '#0f766e' },
  { fill: '#d97706', stroke: '#b45309' },
];

export function facetRingLatLng(facet) {
  const { refLat, refLng } = facet;
  return facet.polygon.map((p) => {
    const ll = localMetersToLatLng(p.x, p.y, refLat, refLng);
    return { lat: ll.lat, lng: ll.lng };
  });
}

/** Скаты для отрисовки на карте (при наличии рёбер — по одному полигону на скат) */
export function facetsForMapDraw(roofPolygon, roofEdges, pitchDeg, azimuthDeg, facetAzimuthOverrides = {}) {
  if (!roofPolygon || roofPolygon.length < 3 || !roofEdges?.length) return [];
  return computeFacets(roofPolygon, roofEdges, pitchDeg, azimuthDeg, facetAzimuthOverrides)
    .filter((f) => f.polygon?.length >= 3);
}

export function facetMapStyle(facet, idx, selectedFacetId) {
  const palette = FACET_MAP_PALETTE[idx % FACET_MAP_PALETTE.length];
  const selected = selectedFacetId === facet.id;
  const inactive = facet.active === false;
  return {
    stroke: selected ? '#E3A50B' : palette.stroke,
    fill: selected ? '#fde047' : palette.fill,
    fillOpacity: inactive ? 0.14 : (selected ? 0.42 : 0.34),
    strokeWeight: selected ? 3 : 2,
    zIndex: selected ? 3 : 2,
  };
}
