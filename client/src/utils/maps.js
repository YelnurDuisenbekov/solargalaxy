/** Полный адрес объекта: «Город, улица…» */
export function formatProjectAddress(city, address) {
  const parts = [city, address].map((s) => s?.trim()).filter(Boolean);
  return parts.join(', ');
}

/** Ссылка на поиск в Google Maps */
export function googleMapsSearchUrl(city, address) {
  const query = formatProjectAddress(city, address);
  if (!query || query.length < 3) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
