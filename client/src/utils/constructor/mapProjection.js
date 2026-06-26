/** Проекция lat/lng → пиксели контейнера карты (Google Maps) */

export function attachGoogleMapProjection(map, onReady) {
  const maps = window.google?.maps;
  if (!map || !maps) return () => {};

  const helper = new maps.OverlayView();
  const listeners = new Set();

  helper.onAdd = function onAdd() {
    const proj = this.getProjection();
    if (!proj) return;

    const projectFn = (lat, lng) => {
      const point = proj.fromLatLngToContainerPixel(new maps.LatLng(lat, lng));
      if (!point) return null;
      return { x: point.x, y: point.y };
    };

    onReady({
      project: projectFn,
      subscribe: (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
    });
  };

  helper.draw = function draw() {
    listeners.forEach((cb) => cb());
  };

  helper.setMap(map);

  return () => {
    helper.setMap(null);
  };
}

/** Leaflet: проекция через latLngToContainerPoint */
export function createLeafletProjection(map) {
  if (!map) return null;

  const notify = new Set();
  const bump = () => notify.forEach((cb) => cb());

  map.on('move', bump);
  map.on('zoom', bump);
  map.on('resize', bump);

  return {
    project: (lat, lng) => {
      const pt = map.latLngToContainerPoint([lat, lng]);
      return { x: pt.x, y: pt.y };
    },
    subscribe: (cb) => {
      notify.add(cb);
      return () => notify.delete(cb);
    },
    destroy: () => {
      map.off('move', bump);
      map.off('zoom', bump);
      map.off('resize', bump);
      notify.clear();
    },
  };
}
