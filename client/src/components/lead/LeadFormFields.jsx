import { Fragment } from 'react';
import FormField from '../form/FormField';
import CityCombobox from '../form/CityCombobox';
import {
  formatKzPhone, SYSTEM_TYPE_HINTS, CITY_OTHER,
} from '../../utils/leadValidation';
import { OBJECT_TYPE, SYSTEM_TYPE, LEAD_SOURCES } from '../../utils/crmLabels';
import { publicInputClass } from '../../utils/publicFormInput';
import { focusPhoneInput, focusSelectAll } from '../../utils/formFieldFocus';

export const emptyLeadForm = {
  fullName: '',
  phone: '+7',
  citySelect: '',
  cityCustom: '',
  objectType: 'OTHER',
  systemType: 'ON_GRID',
  capacityKw: '',
  source: 'Сайт',
  notes: '',
};

export default function LeadFormFields({
  form,
  setForm,
  fieldErrors = {},
  showSource = false,
  sourceReadonly = false,
  managerName,
  publicStyle = false,
  onCapacityFocus,
  minimal = false,
}) {
  const setField = (patch) => setForm({ ...form, ...patch });
  const ic = (value, opts) => (publicStyle ? publicInputClass(value, opts) : 'input');
  const Wrap = publicStyle ? 'div' : Fragment;
  const wrapProps = publicStyle ? { className: 'public-lead-form__fields-grid' } : {};

  if (minimal) {
    return (
      <Wrap {...wrapProps}>
        <FormField label="Ваше имя *" error={fieldErrors.fullName}>
          <input
            className={ic(form.fullName)}
            required
            placeholder="Как к вам обращаться"
            value={form.fullName}
            onFocus={publicStyle ? focusSelectAll : undefined}
            onChange={(e) => setField({ fullName: e.target.value })}
          />
        </FormField>
        <FormField label="Телефон *" error={fieldErrors.phone}>
          <input
            className={ic(form.phone, { type: 'phone' })}
            required
            inputMode="tel"
            placeholder="+7 777 123 4567"
            value={form.phone}
            onFocus={publicStyle ? (e) => focusPhoneInput(e, form.phone) : undefined}
            onChange={(e) => setField({ phone: formatKzPhone(e.target.value) })}
          />
        </FormField>
      </Wrap>
    );
  }

  return (
    <Wrap {...wrapProps}>
      <FormField label="ФИО *" error={fieldErrors.fullName}>
        <input
          className={ic(form.fullName)}
          required
          placeholder="Иванов Иван"
          value={form.fullName}
          onFocus={publicStyle ? focusSelectAll : undefined}
          onChange={(e) => setField({ fullName: e.target.value })}
        />
      </FormField>
      <FormField label="Телефон *" error={fieldErrors.phone} hint={publicStyle ? undefined : 'Формат: +7 XXX XXX XXXX'}>
        <input
          className={ic(form.phone, { type: 'phone' })}
          required
          inputMode="tel"
          placeholder="+7 777 123 4567"
          value={form.phone}
          onFocus={publicStyle ? (e) => focusPhoneInput(e, form.phone) : undefined}
          onChange={(e) => setField({ phone: formatKzPhone(e.target.value) })}
        />
      </FormField>
      <CityCombobox
        citySelect={form.citySelect}
        cityCustom={form.cityCustom}
        onCitySelect={(citySelect) => setField({
          citySelect,
          cityCustom: citySelect === CITY_OTHER ? form.cityCustom : '',
        })}
        onCityCustom={(cityCustom) => setField({ cityCustom })}
        error={fieldErrors.city}
        customError={fieldErrors.cityCustom}
        publicStyle={publicStyle}
      />
      <FormField label="Тип объекта" error={fieldErrors.objectType}>
        <select className={ic(form.objectType)} value={form.objectType} onChange={(e) => setField({ objectType: e.target.value })}>
          {Object.entries(OBJECT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </FormField>
      <FormField label="Тип системы" error={fieldErrors.systemType}>
        <select className={ic(form.systemType)} value={form.systemType} onChange={(e) => setField({ systemType: e.target.value })}>
          {Object.entries(SYSTEM_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <p className="app-field__hint">{SYSTEM_TYPE_HINTS[form.systemType]}</p>
      </FormField>
      <FormField label="Мощность, кВт" error={fieldErrors.capacityKw}>
        <input
          className={ic(form.capacityKw)}
          type="number"
          step="0.1"
          min="0.1"
          placeholder="10"
          value={form.capacityKw}
          onFocus={publicStyle ? (e) => { onCapacityFocus?.(); focusSelectAll(e); } : undefined}
          onChange={(e) => setField({ capacityKw: e.target.value })}
        />
      </FormField>
      {showSource && (
        <FormField label="Источник" error={fieldErrors.source}>
          {sourceReadonly ? (
            <input className="input" value={form.source} readOnly disabled />
          ) : (
            <select className="input" value={form.source} onChange={(e) => setField({ source: e.target.value })}>
              {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </FormField>
      )}
      {managerName && (
        <FormField label="Менеджер">
          <input className="input" value={managerName} readOnly disabled />
        </FormField>
      )}
      <FormField label="Примечание" error={fieldErrors.notes}>
        <textarea
          className={ic(form.notes)}
          rows={2}
          placeholder="Дополнительные пожелания (необязательно)"
          value={form.notes || ''}
          onFocus={publicStyle ? focusSelectAll : undefined}
          onChange={(e) => setField({ notes: e.target.value })}
        />
      </FormField>
    </Wrap>
  );
}
