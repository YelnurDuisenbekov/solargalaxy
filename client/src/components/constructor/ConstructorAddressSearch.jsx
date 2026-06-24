import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CONSTRUCTOR_COUNTRIES,
  fetchAddressSuggestions,
  fetchCitySuggestions,
  geocodeFreeText,
  resolveSuggestion,
} from '../../utils/constructor/geocode.js';

function useDebounced(value, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function SuggestionList({ items, onPick, emptyText }) {
  if (!items?.length) {
    return emptyText ? <p className="constructor-suggest-empty">{emptyText}</p> : null;
  }
  return (
    <ul className="constructor-suggest-list" role="listbox">
      {items.map((item) => (
        <li key={item.id}>
          <button type="button" className="constructor-suggest-item" role="option" onClick={() => onPick(item)}>
            <span className="constructor-suggest-item__label">{item.label}</span>
            {item.subtitle && <span className="constructor-suggest-item__sub">{item.subtitle}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function ConstructorAddressSearch({
  countryCode, city, address, lat, lng, onLocationSelect, onPatch,
}) {
  const cityWrapRef = useRef(null);
  const addressWrapRef = useRef(null);
  const [cityQuery, setCityQuery] = useState(city || '');
  const [addressQuery, setAddressQuery] = useState(address || '');
  const [cityOpen, setCityOpen] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  const debouncedCity = useDebounced(cityQuery);
  const debouncedAddress = useDebounced(addressQuery);

  useEffect(() => { setCityQuery(city || ''); }, [city]);
  useEffect(() => { setAddressQuery(address || ''); }, [address]);

  useEffect(() => {
    const onDoc = (e) => {
      if (cityWrapRef.current && !cityWrapRef.current.contains(e.target)) setCityOpen(false);
      if (addressWrapRef.current && !addressWrapRef.current.contains(e.target)) setAddressOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!cityOpen) return;
    let cancelled = false;
    fetchCitySuggestions(debouncedCity, countryCode)
      .then((items) => { if (!cancelled) setCitySuggestions(items); })
      .catch(() => { if (!cancelled) setCitySuggestions([]); });
    return () => { cancelled = true; };
  }, [debouncedCity, countryCode, cityOpen]);

  useEffect(() => {
    if (!addressOpen) {
      setAddressSuggestions([]);
      return;
    }
    let cancelled = false;
    const q = debouncedAddress.trim();
    if (q.length < 2 && !cityQuery) return;
    fetchAddressSuggestions(q || cityQuery, { countryCode, city: cityQuery || city, lat, lng })
      .then((items) => { if (!cancelled) setAddressSuggestions(items); })
      .catch(() => { if (!cancelled) setAddressSuggestions([]); });
    return () => { cancelled = true; };
  }, [debouncedAddress, countryCode, city, cityQuery, addressOpen, lat, lng]);

  const applyLocation = useCallback(async (suggestion, mode) => {
    setLoading(true);
    setSearchError('');
    try {
      const loc = await resolveSuggestion(suggestion, { countryCode, city: cityQuery || city });
      onLocationSelect({
        countryCode: loc.countryCode || countryCode,
        city: loc.city || cityQuery,
        address: mode === 'city' ? '' : (loc.address || addressQuery),
        formattedAddress: loc.formattedAddress,
        lat: loc.lat,
        lng: loc.lng,
      });
      if (loc.city) setCityQuery(loc.city);
      if (mode !== 'city' && loc.address) setAddressQuery(loc.address);
      setCityOpen(false);
      setAddressOpen(false);
    } catch (e) {
      setSearchError(e.message || 'Не удалось найти место');
    } finally {
      setLoading(false);
    }
  }, [countryCode, city, cityQuery, addressQuery, onLocationSelect]);

  const handleSearch = async () => {
    if (!cityQuery.trim() && !addressQuery.trim()) {
      setSearchError('Укажите хотя бы город или адрес');
      return;
    }
    setLoading(true);
    setSearchError('');
    try {
      const loc = await geocodeFreeText({
        countryCode, city: cityQuery, address: addressQuery, lat, lng,
      });
      onLocationSelect({
        countryCode,
        city: loc.city || cityQuery,
        address: addressQuery || loc.address,
        formattedAddress: loc.formattedAddress,
        lat: loc.lat,
        lng: loc.lng,
      });
    } catch (e) {
      setSearchError(e.message || 'Адрес не найден');
    } finally {
      setLoading(false);
    }
  };

  const countryName = CONSTRUCTOR_COUNTRIES.find((c) => c.code === countryCode)?.name || '';

  return (
    <div className="constructor-address">
      <p className="constructor-address__tip">
        {typeof window !== 'undefined' && import.meta.env.VITE_GOOGLE_MAPS_API_KEY
          ? 'Поиск адреса через Google Places. Выберите вариант из списка.'
          : 'Бесплатный поиск через OpenStreetMap. Выберите вариант из списка.'}
      </p>
      <div className="constructor-address__grid">
        <label>
          Страна
          <select
            className="input"
            value={countryCode}
            onChange={(e) => {
              onPatch({ countryCode: e.target.value, city: '', address: '' });
              setCityQuery('');
              setAddressQuery('');
            }}
          >
            {CONSTRUCTOR_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </label>

        <label ref={cityWrapRef} className="constructor-address__field">
          Город
          <input
            className="input"
            value={cityQuery}
            placeholder={`Алматы, Астана… (${countryName})`}
            autoComplete="off"
            onFocus={() => setCityOpen(true)}
            onChange={(e) => {
              setCityQuery(e.target.value);
              setCityOpen(true);
              onPatch({ city: e.target.value });
            }}
          />
          {cityOpen && (
            <SuggestionList
              items={citySuggestions}
              onPick={(item) => applyLocation(item, 'city')}
              emptyText={cityQuery.length < 1 ? 'Кликните — покажем города KZ' : 'Нет совпадений — попробуйте латиницу или «Показать на карте»'}
            />
          )}
        </label>

        <label ref={addressWrapRef} className="constructor-address__field constructor-address__field--wide">
          Улица, дом
          <input
            className="input"
            value={addressQuery}
            placeholder="пр. Абая 150, мкр. Самал-2…"
            autoComplete="off"
            onFocus={() => setAddressOpen(true)}
            onChange={(e) => {
              setAddressQuery(e.target.value);
              setAddressOpen(true);
              onPatch({ address: e.target.value });
            }}
          />
          {addressOpen && (addressQuery.trim().length >= 2 || cityQuery) && (
            <SuggestionList
              items={addressSuggestions}
              onPick={(item) => applyLocation(item, 'address')}
              emptyText="Нет вариантов — уточните улицу или нажмите «Показать на карте»"
            />
          )}
        </label>
      </div>

      <div className="constructor-address__actions">
        <button type="button" className="btn btn--primary" disabled={loading} onClick={handleSearch}>
          {loading ? 'Поиск…' : 'Показать на карте'}
        </button>
        {searchError && <span className="constructor-address__error">{searchError}</span>}
      </div>
    </div>
  );
}
