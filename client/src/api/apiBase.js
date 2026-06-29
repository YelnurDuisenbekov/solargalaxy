/** Базовый URL API (без /api). Пусто — Vite proxy на localhost. */
export function getApiRoot() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
}

export function publicApiUrl(path) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const root = getApiRoot();
  return root ? `${root}/api/public${suffix}` : `/api/public${suffix}`;
}
