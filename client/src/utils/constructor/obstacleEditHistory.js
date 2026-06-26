import { latLngToLocalMeters, localMetersToLatLng } from './calc.js';
import { migrateObstacle } from './obstacles.js';

export function snapshotObstacles(list) {
  return (list || []).map((o) => migrateObstacle(o));
}

/** Копия препятствия со смещением в локальных метрах */
export function duplicateObstacle(obs, refLat, refLng, offsetM = 1.2) {
  const base = migrateObstacle(obs);
  const local = latLngToLocalMeters(base.lat, base.lng, refLat, refLng);
  const shifted = localMetersToLatLng(
    local.x + offsetM,
    local.y + offsetM * 0.65,
    refLat,
    refLng,
  );
  return {
    ...base,
    id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    lat: shifted.lat,
    lng: shifted.lng,
  };
}
