import { moveObstacle } from './obstacles.js';

/** Смещение препятствия по дельте lat/lng от точки захвата */
export function obstacleAtDragDelta(drag, lat, lng) {
  const dLat = lat - drag.startLat;
  const dLng = lng - drag.startLng;
  const base = drag.baseObs;
  return moveObstacle(base, drag.origLat + dLat, drag.origLng + dLng);
}

/** Начало перетаскивания: сохраняем id и исходные координаты */
export function startObstacleDrag(obs, lat, lng) {
  return {
    id: obs.id,
    startLat: lat,
    startLng: lng,
    origLat: obs.lat,
    origLng: obs.lng,
    baseObs: obs,
  };
}

export function canDragObstacleOnMap(drawMode) {
  return drawMode === 'obstacle' || drawMode === 'view';
}
