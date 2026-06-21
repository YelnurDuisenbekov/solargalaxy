import FormField from '../form/FormField';
import CityCombobox from '../form/CityCombobox';
import {
  formatKzPhone, SYSTEM_TYPE_HINTS, CITY_OTHER,
} from '../../utils/leadValidation';
import { OBJECT_TYPE, SYSTEM_TYPE, LEAD_SOURCES } from '../../utils/crmLabels';

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
}) {
  const setField = (patch) => setForm({ ...form, ...patch });

  return (
    <>
      <FormField label="ФИО *" error={fieldErrors.fullName}>
        <input
          className="input"
          required
          value={form.fullName}
          onChange={(e) => setField({ fullName: e.target.value })}
        />
      </FormField>
      <FormField label="Телефон *" error={fieldErrors.phone} hint="Формат: +7 XXX XXX XXXX">
        <input
          className="input"
          required
          inputMode="tel"
          placeholder="+7 777 123 4567"
          value={form.phone}
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
      />
      <FormField label="Тип объекта" error={fieldErrors.objectType}>
        <select className="input" value={form.objectType} onChange={(e) => setField({ objectType: e.target.value })}>
          {Object.entries(OBJECT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </FormField>
      <FormField label="Тип системы" error={fieldErrors.systemType}>
        <select className="input" value={form.systemType} onChange={(e) => setField({ systemType: e.target.value })}>
          {Object.entries(SYSTEM_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <p className="app-field__hint">{SYSTEM_TYPE_HINTS[form.systemType]}</p>
      </FormField>
      <FormField label="Мощность, кВт" error={fieldErrors.capacityKw}>
        <input
          className="input"
          type="number"
          step="0.1"
          min="0.1"
          value={form.capacityKw}
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
        <textarea className="input" rows={2} value={form.notes || ''} onChange={(e) => setField({ notes: e.target.value })} />
      </FormField>
    </>
  );
}
