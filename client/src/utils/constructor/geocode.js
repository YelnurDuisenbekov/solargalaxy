import { filterKzCities, KZ_CITIES } from '../leadValidation.js';
import { getGoogleMapsApiKey, loadGoogleMaps } from '../googleMapsLoader.js';

export const CONSTRUCTOR_COUNTRIES = [
  { code: 'kz', name: 'Казахстан' },
  { code: 'ru', name: 'Россия' },
  { code: 'uz', name: 'Узбекистан' },
  { code: 'kg', name: 'Кыргызстан' },
  { code: 'tj', name: 'Таджикистан' },
  { code: 'tm', name: 'Туркменистан' },
  { code: 'by', name: 'Беларусь' },
  { code: 'ua', name: 'Украина' },
  { code: 'ge', name: 'Грузия' },
  { code: 'am', name: 'Армения' },
  { code: 'az', name: 'Азербайджан' },
];

function countryName(code) {
  return CONSTRUCTOR_COUNTRIES.find((c) => c.code === code)?.name || '';
}

/** Локальные подсказки городов KZ */
export function localCitySuggestions(query, countryCode) {
  if (countryCode !== 'kz') return [];
  const list = query.trim() ? filterKzCities(query) : KZ_CITIES;
  return list.slice(0, 12).map((name) => ({
    id: `local-city-${name}`,
    label: name,
    subtitle: 'Казахстан · локальный справочник',
    source: 'local',
    city: name,
    country: 'Казахстан',
    countryCode: 'kz',
  }));
}

/** Photon (Komoot) — бесплатный геокодер, без API-ключа */
async function photonSearch(query, { limit = 10, lat, lng } = {}) {
  const params = new URLSearchParams({ q: query, limit: String(limit), lang: 'ru' });
  if (lat != null && lng != null) {
    params.set('lat', String(lat));
    params.set('lon', String(lng));
  }
  const res = await fetch(`https://photon.komoot.io/api/?${params}`);
  if (!res.ok) throw new Error('Photon недоступен');
  const data = await res.json();
  return (data.features || []).map((f) => {
    const p = f.properties || {};
    const [lon, latCoord] = f.geometry?.coordinates || [];
    const city = p.city || p.locality || p.district || p.county || p.state || '';
    const street = [p.street, p.housenumber].filter(Boolean).join(' ');
    const label = street || p.name || city || query;
    const subtitle = [city, p.state, p.country].filter(Boolean).join(', ');
    return {
      id: `photon-${f.properties?.osm_id || `${lon}-${latCoord}`}`,
      label,
      subtitle: subtitle || p.country,
      source: 'photon',
      lat: latCoord,
      lng: lon,
      formattedAddress: [label, subtitle, p.country].filter(Boolean).join(', '),
      city,
      country: p.country || '',
      countryCode: (p.countrycode || '').toLowerCase(),
      street,
      house: p.housenumber || '',
    };
  });
}

/** Nominatim — запасной бесплатный геокодер */
async function nominatimSearch(query, { countryCode, limit = 8 } = {}) {
  const params = new URLSearchParams({
    format: 'json',
    q: query,
    limit: String(limit),
    'accept-language': 'ru',
    addressdetails: '1',
  });
  if (countryCode) params.set('countrycodes', countryCode);

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!res.ok) throw new Error('Nominatim недоступен');
  const data = await res.json();
  return data.map((item) => ({
    id: `osm-${item.place_id}`,
    label: item.display_name.split(',')[0],
    subtitle: item.display_name,
    source: 'nominatim',
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    formattedAddress: item.display_name,
    city: item.address?.city || item.address?.town || item.address?.village || item.address?.state || '',
    country: item.address?.country || '',
    countryCode: item.address?.country_code || countryCode,
  }));
}

async function freeSearch(query, opts = {}) {
  try {
    const photon = await photonSearch(query, opts);
    if (photon.length) return photon;
  } catch { /* fallback */ }
  return nominatimSearch(query, { countryCode: opts.countryCode, limit: opts.limit || 10 });
}

function googlePredictionsToSuggestions(predictions) {
  return (predictions || []).map((p) => ({
    id: p.place_id,
    label: p.structured_formatting?.main_text || p.description,
    subtitle: p.structured_formatting?.secondary_text || p.description,
    source: 'google',
    placeId: p.place_id,
  }));
}

async function googlePredictions(input, { countryCode, types }) {
  if (!getGoogleMapsApiKey()) return [];
  await loadGoogleMaps();
  const svc = new window.google.maps.places.AutocompleteService();
  return new Promise((resolve) => {
    svc.getPlacePredictions(
      {
        input,
        componentRestrictions: countryCode ? { country: countryCode } : undefined,
        types,
      },
      (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) resolve(results || []);
        else resolve([]);
      },
    );
  });
}

async function googleGeocode(query) {
  if (!getGoogleMapsApiKey()) return null;
  await loadGoogleMaps();
  const geocoder = new window.google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ address: query, language: 'ru', region: 'KZ' }, (results, status) => {
      if (status === 'OK' && results?.[0]) resolve(results[0]);
      else resolve(null);
    });
  });
}

async function googlePlaceDetails(placeId) {
  await loadGoogleMaps();
  const geocoder = new window.google.maps.Geocoder();
  return new Promise((resolve, reject) => {
    geocoder.geocode({ placeId }, (results, status) => {
      if (status === 'OK' && results?.[0]) resolve(results[0]);
      else reject(new Error(status));
    });
  });
}

function parseGoogleResult(result) {
  const pick = (type) => result.address_components?.find((c) => c.types.includes(type))?.long_name || '';
  const loc = result.geometry.location;
  return {
    lat: loc.lat(),
    lng: loc.lng(),
    city: pick('locality') || pick('administrative_area_level_2') || pick('administrative_area_level_1'),
    country: pick('country'),
    countryCode: result.address_components?.find((c) => c.types.includes('country'))?.short_name?.toLowerCase(),
    formattedAddress: result.formatted_address,
    address: [pick('route'), pick('street_number')].filter(Boolean).join(' ') || result.formatted_address.split(',')[0],
  };
}

export async function fetchCitySuggestions(query, countryCode) {
  const local = localCitySuggestions(query, countryCode);
  const q = query.trim();
  if (q.length < 2) return local;

  const country = countryName(countryCode);
  try {
    const predictions = await googlePredictions(`${q}, ${country}`, { countryCode, types: ['(cities)'] });
    const google = googlePredictionsToSuggestions(predictions);
    if (google.length) {
      const merged = [...local];
      google.forEach((g) => {
        if (!merged.some((m) => m.label.toLowerCase() === g.label.toLowerCase())) merged.push(g);
      });
      return merged.slice(0, 12);
    }
  } catch { /* free fallback */ }

  const remote = await freeSearch(`${q}, ${country}`, { countryCode, limit: 8 });
  const merged = [...local];
  remote.forEach((r) => {
    if (!merged.some((m) => m.label.toLowerCase() === r.label.toLowerCase())) merged.push(r);
  });
  return merged.slice(0, 12);
}

export async function fetchAddressSuggestions(query, { countryCode, city, lat, lng }) {
  const q = query.trim();
  if (q.length < 2 && !city) return [];

  const country = countryName(countryCode);
  const fullQuery = [q, city, country].filter(Boolean).join(', ');

  try {
    const predictions = await googlePredictions(fullQuery, { countryCode, types: ['geocode', 'establishment'] });
    const google = googlePredictionsToSuggestions(predictions);
    if (google.length) return google.slice(0, 12);
  } catch { /* free fallback */ }

  return freeSearch(fullQuery, { countryCode, limit: 12, lat, lng });
}

export async function resolveSuggestion(suggestion, { countryCode, city }) {
  if (suggestion.lat != null && suggestion.lng != null) {
    return {
      lat: suggestion.lat,
      lng: suggestion.lng,
      city: suggestion.city || city,
      country: suggestion.country || countryName(countryCode),
      countryCode: suggestion.countryCode || countryCode,
      address: suggestion.street
        ? [suggestion.street, suggestion.house].filter(Boolean).join(' ')
        : (suggestion.label || ''),
      formattedAddress: suggestion.formattedAddress || suggestion.subtitle || suggestion.label,
    };
  }

  if (suggestion.source === 'local') {
    const country = countryName(countryCode);
    const results = await freeSearch(`${suggestion.city}, ${country}`, { countryCode, limit: 1 });
    if (results[0]) {
      return {
        lat: results[0].lat,
        lng: results[0].lng,
        city: suggestion.city,
        country,
        countryCode,
        address: '',
        formattedAddress: `${suggestion.city}, ${country}`,
      };
    }
  }

  if (suggestion.placeId) {
    try {
      const result = await googlePlaceDetails(suggestion.placeId);
      return { ...parseGoogleResult(result), countryCode: parseGoogleResult(result).countryCode || countryCode };
    } catch { /* fallback below */ }
  }

  throw new Error('Не удалось определить координаты');
}

export async function geocodeFreeText({ countryCode, city, address, lat, lng }) {
  const country = countryName(countryCode);
  const variants = [
    [address, city, country].filter(Boolean).join(', '),
    [city, address, country].filter(Boolean).join(', '),
    [address, country].filter(Boolean).join(', '),
    city ? `${city}, ${country}` : '',
  ].filter(Boolean);

  for (const query of variants) {
    try {
      const g = await googleGeocode(query);
      if (g) {
        const parsed = parseGoogleResult(g);
        return {
          ...parsed,
          countryCode: parsed.countryCode || countryCode,
          address: address || parsed.address,
        };
      }
    } catch { /* next variant */ }

    const results = await freeSearch(query, { countryCode, limit: 3, lat, lng });
    if (results[0]) {
      const r = results[0];
      return {
        lat: r.lat,
        lng: r.lng,
        city: r.city || city,
        country: r.country || country,
        countryCode: r.countryCode || countryCode,
        address: address || r.label,
        formattedAddress: r.formattedAddress,
      };
    }
  }

  throw new Error('Адрес не найден. Попробуйте выбрать вариант из списка или укажите город и улицу отдельно.');
}

export { KZ_CITIES };
