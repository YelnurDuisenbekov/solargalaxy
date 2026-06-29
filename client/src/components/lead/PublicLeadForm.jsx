import { useEffect, useMemo, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import '../../pages/app/app-pages.css';

import './PublicLeadForm.css';

import { useAuth } from '../../context/AuthContext';
import { publicApi } from '../../api';

import LeadFormFields, { emptyLeadForm } from './LeadFormFields';

import { validateLeadForm, resolveCity } from '../../utils/leadValidation';

import { calcRecommendedKw, PANEL_EFFICIENCY_PCT } from '../../utils/solarEstimate';

import { formatNum, formatTariff, formatMoney } from '../../utils/format';
import { publicInputClass } from '../../utils/publicFormInput';
import { CALC_PRESETS, focusClearPreset, focusSelectAll } from '../../utils/formFieldFocus';
import { trackFormEvent } from '../../utils/analyticsTracking';

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

  formId = 'quote-form',

}) {

  const { user, isClient } = useAuth();

  const startedRef = useRef(false);

  const [form, setForm] = useState({ ...emptyLeadForm });

  const [fieldErrors, setFieldErrors] = useState({});

  const [error, setError] = useState('');

  const [saving, setSaving] = useState(false);

  const [capacityTouched, setCapacityTouched] = useState(false);



  useEffect(() => {

    if (!isClient || !user?.phone) return;

    setForm((prev) => (prev.phone && prev.phone !== '+7' ? prev : { ...prev, phone: user.phone, fullName: prev.fullName || user.fullName || '' }));

  }, [isClient, user?.phone, user?.fullName]);



  const [monthlyBill, setMonthlyBill] = useState(CALC_PRESETS.monthlyBill);
  const [roofArea, setRoofArea] = useState(CALC_PRESETS.roofArea);

  const [currentTariff, setCurrentTariff] = useState(CALC_PRESETS.tariffBusiness);

  const [segment, setSegment] = useState('business');



  const marketTariff = TARIFF_HISTORY[TARIFF_HISTORY.length - 1];

  const marketRate = segment === 'household' ? marketTariff.household : marketTariff.business;

  const isBelowMarket = currentTariff > 0 && currentTariff < marketRate;

  const belowMarketPct = isBelowMarket

    ? Math.round(((marketRate - currentTariff) / marketRate) * 100)

    : 0;



  const tariffPreset = segment === 'household' ? CALC_PRESETS.tariffHousehold : CALC_PRESETS.tariffBusiness;

  const handleCapacityFocus = () => {
    if (!capacityTouched && form.capacityKw) {
      setForm((prev) => ({ ...prev, capacityKw: '' }));
      setCapacityTouched(true);
    }
  };

  const estimate = useMemo(
    () => calcRecommendedKw({ monthlyBill, tariffPerKwh: currentTariff, roofArea, segment }),
    [monthlyBill, currentTariff, roofArea, segment],
  );



  useEffect(() => {

    if (!withCalculator || capacityTouched || !estimate?.recommendedKw) return;

    setForm((prev) => ({ ...prev, capacityKw: String(estimate.recommendedKw) }));

  }, [withCalculator, capacityTouched, estimate?.recommendedKw]);



  useEffect(() => {

    trackFormEvent(formId, 'view');

  }, [formId]);



  const onFormStart = () => {

    if (startedRef.current) return;

    startedRef.current = true;

    trackFormEvent(formId, 'start');

  };



  const submit = async (e) => {

    e.preventDefault();

    setError('');

    const { valid, fields } = validateLeadForm(form);

    setFieldErrors(fields);

    if (!valid) {

      setError('Исправьте ошибки в форме');

      trackFormEvent(formId, 'error');

      return;

    }

    setSaving(true);

    try {

      const calcNotes = withCalculator && estimate

        ? [

          `Тариф: ${formatTariff(currentTariff)} ₸/кВт·ч`,

          `Счёт: ${formatNum(monthlyBill)} ₸/мес`,

          `Потребление: ~${formatNum(estimate.monthlyKwh)} кВт·ч/мес`,
          `Рекомендуемая СЭС: ~${formatNum(estimate.recommendedKw)} кВт`,
          `Выработка: ~${formatNum(estimate.annualGenerationKwh)} кВт·ч/год`,
          `Окупаемость: ${estimate.paybackYears} лет (факт) / ${estimate.paybackYearsWithTariffGrowth} лет (рост тарифов ~${estimate.tariffGrowthPct}%/год)`,

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

      const created = await publicApi.createLead(payload);

      trackFormEvent(formId, 'submit');

      onSubmitted?.({

        fullName: form.fullName.trim(),

        phone: form.phone,

        city: payload.city,

        alreadyClient: Boolean(created?.clientId),

      });

      setForm({ ...emptyLeadForm });

      setFieldErrors({});

      setCapacityTouched(false);

    } catch (err) {

      setError(err.message || 'Не удалось отправить заявку');

      trackFormEvent(formId, 'error');

      if (err.fields) setFieldErrors(err.fields);

    } finally {

      setSaving(false);

    }

  };



  return (
    <form
      className={`public-lead-form ${withCalculator ? 'public-lead-form--with-calc' : ''} ${className}`.trim()}
      onSubmit={submit}
      onFocusCapture={onFormStart}
    >
      {withCalculator ? (
        <div className="public-lead-form__unified card">
          <div className="calculator__chart-section">
            <TariffChart currentTariff={currentTariff} segment={segment} />
          </div>

          <div className="public-lead-form__section" id="quote-form">
            <div className="public-lead-form__section-head">
              <span className="public-lead-form__step">1</span>
              <div>
                <h3 className="public-lead-form__section-title">Параметры для расчёта</h3>
                <p className="public-lead-form__section-hint">Серый текст — поле нужно заполнить</p>
              </div>
            </div>
            <div className="calculator__inputs">
              <div className="calculator__field">
                <label htmlFor="calc-tariff">Текущий тариф, ₸/кВт·ч</label>
                <input
                  id="calc-tariff"
                  className={publicInputClass(currentTariff)}
                  type="number"
                  min={5}
                  step={0.5}
                  placeholder={String(tariffPreset)}
                  value={currentTariff || ''}
                  onFocus={(e) => focusClearPreset(e, {
                    value: currentTariff,
                    preset: tariffPreset,
                    onClear: () => setCurrentTariff(0),
                  })}
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
                  className={publicInputClass(segment)}
                  value={segment}
                  onChange={(e) => {
                    setSegment(e.target.value);
                    setCurrentTariff(e.target.value === 'household'
                      ? CALC_PRESETS.tariffHousehold
                      : CALC_PRESETS.tariffBusiness);
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
                  className={publicInputClass(monthlyBill)}
                  type="text"
                  inputMode="numeric"
                  placeholder="150 000"
                  value={monthlyBill ? formatNum(monthlyBill) : ''}
                  onFocus={(e) => focusClearPreset(e, {
                    value: monthlyBill,
                    preset: CALC_PRESETS.monthlyBill,
                    onClear: () => setMonthlyBill(0),
                  })}
                  onChange={(e) => setMonthlyBill(Number(e.target.value.replace(/\s/g, '')) || 0)}
                />
              </div>

              <div className="calculator__field">
                <label htmlFor="calc-area">Доступная площадь под панели, м²</label>
                <input
                  id="calc-area"
                  className={publicInputClass(roofArea)}
                  type="text"
                  inputMode="numeric"
                  placeholder="200"
                  value={roofArea ? formatNum(roofArea) : ''}
                  onFocus={(e) => focusClearPreset(e, {
                    value: roofArea,
                    preset: CALC_PRESETS.roofArea,
                    onClear: () => setRoofArea(0),
                  })}
                  onChange={(e) => setRoofArea(Number(e.target.value.replace(/\s/g, '')) || 0)}
                />
              </div>
            </div>

          </div>

          <div className="public-lead-form__section public-lead-form__section--contacts">
            <div className="public-lead-form__section-head">
              <span className="public-lead-form__step">2</span>
              <div>
                <h3 className="public-lead-form__section-title">Контакты для связи</h3>
                <p className="public-lead-form__section-hint">Заполните обязательные поля (*)</p>
              </div>
            </div>
            <LeadFormFields
              form={form}
              setForm={(newForm) => {
                if (newForm.capacityKw !== form.capacityKw) setCapacityTouched(true);
                setForm(newForm);
              }}
              fieldErrors={fieldErrors}
              publicStyle
              onCapacityFocus={handleCapacityFocus}
            />
          </div>

          <FormErrors error={error} fieldErrors={fieldErrors} />

          <button type="submit" className="btn btn--primary btn--cta" disabled={saving}>
            {saving ? 'Отправка…' : submitLabel}
          </button>

          {estimate && (
            <div className="public-lead-form__estimate public-lead-form__estimate--footer">
              <h4 className="public-lead-form__estimate-title">Ориентировочный расчёт СЭС</h4>
              <div className="public-lead-form__metrics">
                <div className="public-lead-form__metric">
                  <span>Потребление</span>
                  <strong>~{formatNum(estimate.monthlyKwh)} кВт·ч/мес</strong>
                </div>
                <div className="public-lead-form__metric">
                  <span>Рекомендуемая мощность</span>
                  <strong>~{formatNum(estimate.recommendedKw)} кВт</strong>
                </div>
                <div className="public-lead-form__metric">
                  <span>Выработка в год</span>
                  <strong>{formatNum(estimate.annualGenerationKwh)} кВт·ч</strong>
                </div>
                <div className="public-lead-form__metric">
                  <span>Экономия в год</span>
                  <strong>{formatMoney(estimate.annualSaving)}</strong>
                </div>
                <div className="public-lead-form__metric">
                  <span>Стоимость «под ключ»</span>
                  <strong>~{formatMoney(estimate.installCost)}</strong>
                </div>
                {(estimate.paybackYears != null || estimate.paybackYearsWithTariffGrowth != null) && (
                  <div className="public-lead-form__metric public-lead-form__metric--payback">
                    <div className="public-lead-form__payback-labels">
                      <span>Окупаемость (факт.)</span>
                      <span title={`С учётом роста тарифа ~${formatNum(estimate.tariffGrowthPct)}% в год`}>
                        Окупаемость (рост тарифа)
                      </span>
                    </div>
                    <div className="public-lead-form__payback-values">
                      <strong>{estimate.paybackYears} лет</strong>
                      <strong>{estimate.paybackYearsWithTariffGrowth} лет</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {estimate && (
            <p className="public-lead-form__estimate-note public-lead-form__estimate-note--footer">
              Это предварительный расчёт при тарифе {formatTariff(currentTariff)} ₸/кВт·ч, КПД модулей {PANEL_EFFICIENCY_PCT}%
              и инсоляции Казахстана. «Рост тарифа» — окупаемость с учётом среднего повышения тарифа по данным 2019–2026.
              Точный расчёт произведёт менеджер после получения заявки.
              Мощность подставится в заявку — можно изменить выше.
            </p>
          )}
        </div>
      ) : (
        <div className="public-lead-form__fields card">
          <LeadFormFields
            form={form}
            setForm={setForm}
            fieldErrors={fieldErrors}
          />
          <FormErrors error={error} fieldErrors={fieldErrors} />
          <button type="submit" className="btn btn--primary btn--cta" disabled={saving}>
            {saving ? 'Отправка…' : submitLabel}
          </button>
        </div>
      )}
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



  if (lead.alreadyClient) {

    return (

      <div className="app-modal-backdrop public-register-prompt" onClick={onClose}>

        <div className="app-modal" onClick={(e) => e.stopPropagation()}>

          <h2>Заявка принята!</h2>

          <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>

            Менеджер Solar Galaxy свяжется с вами в ближайшее время.

            Заявка уже привязана к вашему личному кабинету — войдите, чтобы видеть статус, расчёт и КП.

          </p>

          <div className="app-modal__actions">

            <button type="button" className="btn btn--primary" onClick={() => navigate('/login')}>Войти в кабинет</button>

            <button type="button" className="btn btn--outline-dark" onClick={onClose}>Закрыть</button>

          </div>

        </div>

      </div>

    );

  }



  return (

    <div className="app-modal-backdrop public-register-prompt" onClick={onClose}>

      <div className="app-modal" onClick={(e) => e.stopPropagation()}>

        <h2>Заявка принята!</h2>

        <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>

          Менеджер Solar Galaxy свяжется с вами в ближайшее время.

          Зарегистрируйтесь в личном кабинете — заявка, предварительный расчёт и КП появятся во вкладке «Мои заявки».

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


