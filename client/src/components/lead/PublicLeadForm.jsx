import { useEffect, useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import '../../pages/app/app-pages.css';

import './PublicLeadForm.css';

import { publicApi } from '../../api';

import LeadFormFields, { emptyLeadForm } from './LeadFormFields';

import { validateLeadForm, resolveCity } from '../../utils/leadValidation';

import { calcRecommendedKw, PANEL_EFFICIENCY_PCT } from '../../utils/solarEstimate';

import { formatNum, formatTariff } from '../../utils/format';

import TariffChart, { TARIFF_HISTORY } from '../TariffChart';



function FormErrors({ error, fieldErrors }) {

  if (!error && !Object.keys(fieldErrors || {}).length) return null;

  return (

    <div className="app-form-errors">

      {error && <p className="error-msg">{error}</p>}

      {Object.keys(fieldErrors || {}).length > 1 && (

        <ul className="app-form-errors__list">

          {Object.entries(fieldErrors).map(([key, msg]) => (

            <li key={key}>{msg}</li>

          ))}

        </ul>

      )}

    </div>

  );

}



export default function PublicLeadForm({

  onSubmitted,

  submitLabel = 'Отправить заявку',

  className = '',

  withCalculator = false,

}) {

  const [form, setForm] = useState({ ...emptyLeadForm });

  const [fieldErrors, setFieldErrors] = useState({});

  const [error, setError] = useState('');

  const [saving, setSaving] = useState(false);

  const [capacityTouched, setCapacityTouched] = useState(false);



  const [monthlyBill, setMonthlyBill] = useState(150000);

  const [roofArea, setRoofArea] = useState(200);

  const [currentTariff, setCurrentTariff] = useState(42);

  const [segment, setSegment] = useState('business');



  const marketTariff = TARIFF_HISTORY[TARIFF_HISTORY.length - 1];

  const marketRate = segment === 'household' ? marketTariff.household : marketTariff.business;

  const isBelowMarket = currentTariff > 0 && currentTariff < marketRate;

  const belowMarketPct = isBelowMarket

    ? Math.round(((marketRate - currentTariff) / marketRate) * 100)

    : 0;



  const estimate = useMemo(

    () => calcRecommendedKw({ monthlyBill, tariffPerKwh: currentTariff, roofArea }),

    [monthlyBill, currentTariff, roofArea],

  );



  useEffect(() => {

    if (!withCalculator || capacityTouched || !estimate?.recommendedKw) return;

    setForm((prev) => ({ ...prev, capacityKw: String(estimate.recommendedKw) }));

  }, [withCalculator, capacityTouched, estimate?.recommendedKw]);



  const submit = async (e) => {

    e.preventDefault();

    setError('');

    const { valid, fields } = validateLeadForm(form);

    setFieldErrors(fields);

    if (!valid) {

      setError('Исправьте ошибки в форме');

      return;

    }

    setSaving(true);

    try {

      const calcNotes = withCalculator && estimate

        ? [

          `Тариф: ${formatTariff(currentTariff)} ₸/кВт·ч`,

          `Счёт: ${formatNum(monthlyBill)} ₸/мес`,

          `Потребление: ~${formatNum(estimate.monthlyKwh)} кВт·ч/мес`,

          roofArea ? `Площадь под панели: ${formatNum(roofArea)} м²` : null,

          `Категория: ${segment === 'household' ? 'физ. лицо' : 'юр. лицо'}`,

        ].filter(Boolean).join(' · ')

        : '';



      const notes = [calcNotes, form.notes?.trim()].filter(Boolean).join('\n') || undefined;



      const payload = {

        fullName: form.fullName.trim(),

        phone: form.phone,

        city: resolveCity(form.citySelect, form.cityCustom),

        objectType: form.objectType,

        systemType: form.systemType,

        capacityKw: form.capacityKw ? Number(form.capacityKw) : undefined,

        source: 'Сайт',

        notes,

      };

      await publicApi.createLead(payload);

      onSubmitted?.({

        fullName: form.fullName.trim(),

        phone: form.phone,

        city: payload.city,

      });

      setForm({ ...emptyLeadForm });

      setFieldErrors({});

      setCapacityTouched(false);

    } catch (err) {

      setError(err.message || 'Не удалось отправить заявку');

      if (err.fields) setFieldErrors(err.fields);

    } finally {

      setSaving(false);

    }

  };



  return (

    <form className={`public-lead-form ${withCalculator ? 'public-lead-form--with-calc' : ''} ${className}`.trim()} onSubmit={submit}>

      {withCalculator && (

        <div className="calculator">

          <div className="calculator__form-wrap">

            <div className="card calculator__form">

              <div className="calculator__field">

                <label htmlFor="calc-tariff">Текущий тариф, ₸/кВт·ч</label>

                <input

                  id="calc-tariff"

                  className="input"

                  type="number"

                  min={5}

                  step={0.5}

                  value={currentTariff}

                  onChange={(e) => setCurrentTariff(Number(e.target.value) || 0)}

                />

                {isBelowMarket && (

                  <p className="calculator__tariff-hint calculator__tariff-hint--below">

                    Ваш тариф на <strong>{belowMarketPct}%</strong> ниже рыночного

                    ({formatTariff(marketRate)} ₸/кВт·ч в {marketTariff.year} г.)

                  </p>

                )}

                {currentTariff > marketRate && (

                  <p className="calculator__tariff-hint calculator__tariff-hint--above">

                    Ваш тариф на <strong>{Math.round(((currentTariff - marketRate) / marketRate) * 100)}%</strong> выше рыночного

                    ({formatTariff(marketRate)} ₸/кВт·ч в {marketTariff.year} г.)

                  </p>

                )}

              </div>

              <div className="calculator__field">

                <label htmlFor="calc-segment">Категория потребителя</label>

                <select

                  id="calc-segment"

                  className="input"

                  value={segment}

                  onChange={(e) => {

                    setSegment(e.target.value);

                    setCurrentTariff(e.target.value === 'household' ? 25.5 : 44);

                  }}

                >

                  <option value="household">Физическое лицо (частник)</option>

                  <option value="business">Юридическое лицо</option>

                </select>

              </div>

              <div className="calculator__field">

                <label htmlFor="calc-bill">Счёт за электроэнергию в месяц, ₸</label>

                <input

                  id="calc-bill"

                  className="input"

                  type="text"

                  inputMode="numeric"

                  placeholder={formatNum(150000)}

                  value={monthlyBill ? formatNum(monthlyBill) : ''}

                  onChange={(e) => setMonthlyBill(Number(e.target.value.replace(/\s/g, '')) || 0)}

                />

              </div>

              <div className="calculator__field">

                <label htmlFor="calc-area">Доступная площадь под панели, м²</label>

                <input

                  id="calc-area"

                  className="input"

                  type="text"

                  inputMode="numeric"

                  value={roofArea ? formatNum(roofArea) : ''}

                  onChange={(e) => setRoofArea(Number(e.target.value.replace(/\s/g, '')) || 0)}

                />

              </div>



              {estimate && (

                <div className="public-lead-form__estimate">

                  <p><strong>Потребление:</strong> ~{formatNum(estimate.monthlyKwh)} кВт·ч в месяц</p>

                  <p>

                    <strong>Рекомендуемая СЭС:</strong> ~{formatNum(estimate.recommendedKw)} кВт

                    {' '}(КПД модулей {PANEL_EFFICIENCY_PCT}%)

                  </p>

                  <p className="app-field__hint">Мощность подставится в заявку — можно изменить ниже.</p>

                </div>

              )}

            </div>

          </div>



          <div className="calculator__chart-wrap">

            <div className="card calculator__chart">

              <TariffChart currentTariff={currentTariff} segment={segment} />

            </div>

          </div>

        </div>

      )}



      <div className="public-lead-form__fields card">

        {withCalculator && (

          <h3 className="public-lead-form__fields-title">Данные для расчёта и связи</h3>

        )}

        <LeadFormFields

          form={form}

          setForm={(newForm) => {

            if (newForm.capacityKw !== form.capacityKw) setCapacityTouched(true);

            setForm(newForm);

          }}

          fieldErrors={fieldErrors}

        />

        <FormErrors error={error} fieldErrors={fieldErrors} />

        <button type="submit" className="btn btn--primary btn--cta" disabled={saving}>

          {saving ? 'Отправка…' : submitLabel}

        </button>

      </div>

    </form>

  );

}



export function RegisterPromptModal({ lead, onClose }) {

  const navigate = useNavigate();



  const goRegister = () => {

    navigate('/login', {

      state: {

        mode: 'register',

        fullName: lead.fullName,

        phone: lead.phone,

      },

    });

  };



  return (

    <div className="app-modal-backdrop public-register-prompt" onClick={onClose}>

      <div className="app-modal" onClick={(e) => e.stopPropagation()}>

        <h2>Заявка принята!</h2>

        <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>

          Менеджер Solar Galaxy свяжется с вами в ближайшее время.

          Зарегистрируйтесь в личном кабинете — там будут видны ваши проекты и расчёты.

        </p>

        <div className="public-register-prompt__data card" style={{ padding: 14, marginBottom: 16, background: 'var(--bg-alt)' }}>

          <p style={{ margin: 0, fontSize: '0.875rem' }}><strong>{lead.fullName}</strong></p>

          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{lead.phone}</p>

        </div>

        <div className="app-modal__actions">

          <button type="button" className="btn btn--primary" onClick={goRegister}>Зарегистрироваться</button>

          <button type="button" className="btn btn--outline-dark" onClick={onClose}>Позже</button>

        </div>

      </div>

    </div>

  );

}


