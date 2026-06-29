import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { analyticsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Reveal } from '../../components/motion/ScrollReveal';
import { formatDateTime } from '../../utils/format';
import { LEAD_STATUS } from '../../utils/crmLabels';
import './app-pages.css';

const PERIOD_OPTIONS = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
];

const PATH_LABELS = {
  '/': 'Главная',
  '/about': 'О компании',
  '/services': 'Услуги',
  '/contact': 'Контакты',
  '/login': 'Вход',
};

const FORM_LABELS = {
  'home-quote': 'Калькулятор на главной',
  'contact-form': 'Форма на контактах',
};

function pathLabel(path) {
  return PATH_LABELS[path] || path;
}

function formLabel(formId) {
  return FORM_LABELS[formId] || formId;
}

function pct(value) {
  return `${value}%`;
}

export default function AnalyticsPage() {
  const { isAdmin } = useAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    analyticsApi.summary(days)
      .then((res) => { setData(res); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [days]);

  if (!isAdmin) return <Navigate to="/app" replace />;

  const t = data?.totals;

  const kpiCards = data ? [
    { label: 'Уникальные посетители', value: t.visitors },
    { label: 'Просмотры страниц', value: t.pageViews },
    { label: 'Просмотры форм', value: t.formViews },
    { label: 'Начали заполнять', value: t.formStarts },
    { label: 'Отправили форму', value: t.formSubmits },
    { label: 'Заявки с сайта', value: t.siteLeads, highlight: true },
    { label: 'Конверсия (визит → заявка)', value: pct(t.conversionFromVisitors) },
    { label: 'Конверсия (форма → заявка)', value: pct(t.conversionFromFormViews) },
  ] : [];

  const maxDaily = data?.daily?.length
    ? Math.max(...data.daily.map((d) => d.visitors), 1)
    : 1;

  return (
    <div>
      <Reveal>
        <div className="app-page-head-row">
          <div>
            <h1 className="app-page-title">Аналитика сайта</h1>
            <p className="app-page-desc">
              Посещения, воронка форм и заявки с публичного сайта.
            </p>
          </div>
          <div className="analytics-period">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`btn btn--sm${days === opt.value ? ' btn--primary' : ' btn--outline-dark'}`}
                onClick={() => setDays(opt.value)}
              >
                {opt.label}
              </button>
            ))}
            <button type="button" className="btn btn--outline-dark btn--sm" onClick={load}>
              Обновить
            </button>
          </div>
        </div>
      </Reveal>

      {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}
      {loading && !data && <p style={{ color: 'var(--text-muted)' }}>Загрузка…</p>}

      {data && (
        <>
          <div className="app-stats-grid analytics-kpi-grid">
            {kpiCards.map((card) => (
              <div key={card.label} className="card app-stat-card">
                <p className="app-stat-card__label">{card.label}</p>
                <p
                  className="app-stat-card__value"
                  style={{ color: card.highlight ? 'var(--green)' : 'var(--primary)' }}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <div className="card app-section-card analytics-section">
            <h2 className="app-section-card__title">Воронка</h2>
            <div className="analytics-funnel">
              {data.funnel.map((step, index) => {
                const base = data.funnel[0]?.count || 1;
                const width = Math.max(12, Math.round((step.count / base) * 100));
                return (
                  <div key={step.step} className="analytics-funnel__row">
                    <span className="analytics-funnel__label">{step.step}</span>
                    <div className="analytics-funnel__bar-wrap">
                      <div className="analytics-funnel__bar" style={{ width: `${width}%` }} />
                    </div>
                    <span className="analytics-funnel__count">{step.count}</span>
                    {index > 0 && data.funnel[index - 1].count > 0 && (
                      <span className="analytics-funnel__pct muted">
                        {Math.round((step.count / data.funnel[index - 1].count) * 100)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="analytics-two-col">
            <div className="card app-section-card analytics-section">
              <h2 className="app-section-card__title">Посетители по дням</h2>
              {data.daily.length === 0 ? (
                <p className="muted">Нет данных за период</p>
              ) : (
                <div className="analytics-chart">
                  {data.daily.map((row) => (
                    <div key={row.date} className="analytics-chart__row">
                      <span className="analytics-chart__date">{row.date.slice(5)}</span>
                      <div className="analytics-chart__bar-wrap">
                        <div
                          className="analytics-chart__bar"
                          style={{ width: `${Math.round((row.visitors / maxDaily) * 100)}%` }}
                          title={`${row.visitors} посет., ${row.views} просм.`}
                        />
                      </div>
                      <span className="analytics-chart__value">{row.visitors}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card app-section-card analytics-section">
              <h2 className="app-section-card__title">Страницы</h2>
              <table className="table table--compact analytics-table">
                <thead>
                  <tr>
                    <th>Страница</th>
                    <th>Просмотры</th>
                  </tr>
                </thead>
                <tbody>
                  {data.viewsByPath.length === 0 ? (
                    <tr><td colSpan={2} className="muted">Нет данных</td></tr>
                  ) : data.viewsByPath.map((row) => (
                    <tr key={row.path}>
                      <td>{pathLabel(row.path)}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="analytics-two-col">
            <div className="card app-section-card analytics-section">
              <h2 className="app-section-card__title">Формы заявок</h2>
              <table className="table table--compact analytics-table">
                <thead>
                  <tr>
                    <th>Форма</th>
                    <th>Просмотр</th>
                    <th>Старт</th>
                    <th>Отправка</th>
                    <th>Ошибка</th>
                  </tr>
                </thead>
                <tbody>
                  {data.forms.length === 0 ? (
                    <tr><td colSpan={5} className="muted">Нет данных</td></tr>
                  ) : data.forms.map((row) => (
                    <tr key={row.formId}>
                      <td>{formLabel(row.formId)}</td>
                      <td>{row.view}</td>
                      <td>{row.start}</td>
                      <td>{row.submit}</td>
                      <td>{row.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card app-section-card analytics-section">
              <h2 className="app-section-card__title">Заявки по источникам</h2>
              <table className="table table--compact analytics-table">
                <thead>
                  <tr>
                    <th>Источник</th>
                    <th>Кол-во</th>
                  </tr>
                </thead>
                <tbody>
                  {data.leadsBySource.length === 0 ? (
                    <tr><td colSpan={2} className="muted">Нет заявок</td></tr>
                  ) : data.leadsBySource.map((row) => (
                    <tr key={row.source}>
                      <td>{row.source}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card app-section-card analytics-section">
            <h2 className="app-section-card__title">Последние заявки</h2>
            <table className="table table--compact analytics-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Источник</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {data.recentLeads.length === 0 ? (
                  <tr><td colSpan={3} className="muted">Нет заявок за период</td></tr>
                ) : data.recentLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{formatDateTime(lead.createdAt)}</td>
                    <td>{lead.source}</td>
                    <td>{LEAD_STATUS[lead.status] || lead.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
