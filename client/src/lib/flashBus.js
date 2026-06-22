/** Глобальная шина для toast без React-контекста (из api/index.js). */
let flashApi = null;

export function registerFlash(api) {
  flashApi = api;
}

export function unregisterFlash() {
  flashApi = null;
}

export function flashSuccess(message) {
  flashApi?.success(message);
}

export function flashError(message) {
  flashApi?.error(message);
}

export function flashInfo(message) {
  flashApi?.info(message);
}
