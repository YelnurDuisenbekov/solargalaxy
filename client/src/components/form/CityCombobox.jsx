import { useEffect, useId, useRef, useState } from 'react';
import { KZ_CITIES, CITY_OTHER, filterKzCities } from '../../utils/leadValidation';
import { isCityEmpty, publicInputClass } from '../../utils/publicFormInput';
import { focusSelectAll } from '../../utils/formFieldFocus';
import FormField from './FormField';
import '../lead/PublicLeadForm.css';

export default function CityCombobox({
  citySelect,
  cityCustom,
  onCitySelect,
  onCityCustom,
  error,
  customError,
  publicStyle = false,
}) {
  const listId = useId();
  const wrapRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (citySelect && citySelect !== CITY_OTHER) setQuery(citySelect);
    else if (!citySelect) setQuery('');
  }, [citySelect]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = filterKzCities(query);
  const showOther = !query.trim() || 'другое'.includes(query.trim().toLowerCase());

  const pickCity = (city) => {
    onCitySelect(city);
    setQuery(city);
    setOpen(false);
  };

  const pickOther = () => {
    onCitySelect(CITY_OTHER);
    setOpen(false);
  };

  const onInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setOpen(true);
    const exact = KZ_CITIES.find((c) => c.toLowerCase() === val.trim().toLowerCase());
    if (exact) onCitySelect(exact);
    else if (citySelect && citySelect !== CITY_OTHER) onCitySelect('');
  };

  const cityEmpty = isCityEmpty(citySelect, cityCustom, query);
  const ic = (value) => (publicStyle ? publicInputClass(value) : 'input');
  const cityClass = publicStyle
    ? publicInputClass(cityEmpty ? '' : (citySelect || query))
    : 'input';

  return (
    <>
      <FormField label="Город *" error={error} className={publicStyle ? 'public-lead-form__field--span2' : undefined}>
        <div className="city-combobox" ref={wrapRef}>
          <input
            className={cityClass}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            placeholder="Начните вводить город…"
            value={query}
            onFocus={(e) => { setOpen(true); if (publicStyle) focusSelectAll(e); }}
            onChange={onInputChange}
            autoComplete="off"
          />
          {open && (filtered.length > 0 || showOther) && (
            <ul className="city-combobox__list" id={listId} role="listbox">
              {filtered.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    role="option"
                    className={`city-combobox__option${citySelect === c ? ' city-combobox__option--active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickCity(c)}
                  >
                    {c}
                  </button>
                </li>
              ))}
              {showOther && (
                <li>
                  <button
                    type="button"
                    role="option"
                    className={`city-combobox__option city-combobox__option--other${citySelect === CITY_OTHER ? ' city-combobox__option--active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={pickOther}
                  >
                    Другое…
                  </button>
                </li>
              )}
              {query.trim() && filtered.length === 0 && (
                <li className="city-combobox__empty">Нет совпадений — выберите «Другое»</li>
              )}
            </ul>
          )}
        </div>
      </FormField>
      {citySelect === CITY_OTHER && (
        <FormField label="Укажите город *" error={customError || error}>
          <input
            className={ic(cityCustom)}
            placeholder="Название населённого пункта"
            value={cityCustom}
            onFocus={publicStyle ? focusSelectAll : undefined}
            onChange={(e) => onCityCustom(e.target.value)}
          />
        </FormField>
      )}
    </>
  );
}
