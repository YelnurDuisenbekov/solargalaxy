import { useEffect, useState } from 'react';

import { Link, Navigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

import { Reveal, RevealGroup, RevealItem } from '../../components/motion/ScrollReveal';

import { crmApi, erpApi, financeApi, warehouseApi } from '../../api';

import { formatMoney, formatNum, formatDateTime, formatDuration } from '../../utils/format';

import {

  LEAD_STATUS, OBJECT_TYPE, SYSTEM_TYPE, sourceBadge, leadBadge,

} from '../../utils/crmLabels';

import LeadWhatsAppLink from '../../components/LeadWhatsAppLink';
import WhatsAppIcon from '../../components/WhatsAppIcon';
import { getLeadUrgency, URGENCY_LABELS } from '../../utils/leadUrgency';
import { openLeadWhatsApp } from '../../utils/whatsapp';

import './app-pages.css';



export default function Dashboard() {

  const { user, isCrm, isContractor, isClient, isAccountant, hasPerm } = useAuth();

  const [leads, setLeads] = useState([]);

  const [stats, setStats] = useState(null);

  const [error, setError] = useState('');



  useEffect(() => {

    if (isCrm) {

      crmApi.leads().then(setLeads).catch(() => {});

      Promise.all([

        crmApi.summary(),

        erpApi.summary(),

        financeApi.summary(),

        warehouseApi.summary(),

      ]).then(([crm, erp, finance, wh]) => {

        setStats({ crm, erp, finance, wh });

      }).catch(() => {});

    }

  }, [isCrm]);



  const claimLead = async (id) => {

    try {

      await crmApi.claimLead(id);

      setLeads(await crmApi.leads());

    } catch (e) { setError(e.message); }

  };

  const markLeadContact = async (lead) => {

    try {

      await crmApi.markLeadContact(lead.id);

      setLeads(await crmApi.leads());

    } catch (e) { setError(e.message); }

  };

  const openAlertWhatsApp = async (lead, reason) => {
    const kind = reason === 'qualified_stale' ? 'followup' : 'initial';
    const result = await openLeadWhatsApp(lead, user, { kind });
    if (!result.opened) {
      setError(result.error || 'Не удалось открыть WhatsApp');
      return;
    }
    if (kind === 'initial') {
      try {
        await crmApi.markLeadContact(lead.id);
        setLeads(await crmApi.leads());
      } catch (e) { setError(e.message); }
    }
  };



  if (isClient) {

    return <Navigate to="/app/portal" replace />;

  }



  if (isAccountant && !isCrm) {

    return <AccountantDashboard />;

  }



  if (isContractor) {

    return <NavigateContractor />;

  }



  // Отдельный «Обзор» только для роли снабжения / склада (не для менеджеров с доступом к вкладке)

  if (user?.role === 'SUPPLY') {

    return <NavigateSupply />;

  }



  if (user?.role === 'WAREHOUSE') {

    return <WarehouseDashboard />;

  }



  if (!isCrm) {

    return (

      <Reveal>

        <h1 className="app-page-title">Solar Galaxy</h1>

        <p className="app-page-desc">Добро пожаловать, {user?.fullName}</p>

      </Reveal>

    );

  }



  const activeLeads = leads.filter((l) => !['CONVERTED', 'LOST'].includes(l.status));

  const urgentAlerts = activeLeads.flatMap((lead) => {
    const urgency = getLeadUrgency(lead);
    if (!urgency) return [];
    return [{
      id: `${lead.id}-${urgency.reason}`,
      lead,
      reason: urgency.reason,
      title: URGENCY_LABELS[urgency.reason],
      message: `${lead.fullName} · ${lead.phone}${lead.city ? ` · ${lead.city}` : ''}`,
    }];
  });

  const cards = stats ? [

    { label: 'Лидов (новые)', value: stats.crm.leads.find((l) => l.status === 'NEW')?._count ?? 0, link: '/app/crm' },

    { label: 'Заинтересованных', value: stats.crm.leads.find((l) => l.status === 'QUALIFIED')?._count ?? 0, link: '/app/crm' },

    { label: 'Проектов создано', value: stats.crm.leads.find((l) => l.status === 'CONVERTED')?._count ?? 0, link: '/app/projects' },

    { label: 'Активных проектов', value: stats.erp.activeProjects, link: '/app/projects' },

    { label: 'К оплате', value: formatMoney(stats.finance.pending), link: '/app/finance' },

    { label: 'Низкий остаток', value: formatNum(stats.wh.lowStockCount), link: '/app/warehouse', alert: stats.wh.lowStockCount > 0 },

  ] : [];



  return (

    <div>

      <Reveal>

        <h1 className="app-page-title">Все лиды</h1>

        <p className="app-page-desc">Заявки со всех каналов — сайт, реклама, соцсети, телефон. Забирайте лиды и ведите проекты.</p>

      </Reveal>



      {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}



      {urgentAlerts.length > 0 && (

        <Reveal delay={0.05}>

          <div className="card app-section-card" style={{ marginBottom: 24, borderLeft: '4px solid #dc2626' }}>

            <div className="app-toolbar">

              <h2 className="app-section-card__title" style={{ margin: 0 }}>Требуют внимания ({urgentAlerts.length})</h2>

              <Link to="/app/crm" className="btn btn--outline-dark">CRM</Link>

            </div>

            <div className="app-activity-list">

              {urgentAlerts.map((a) => (

                <div
                  key={a.id}
                  className="card app-activity-item app-urgency-alert"
                  role="button"
                  tabIndex={0}
                  onClick={() => openAlertWhatsApp(a.lead, a.reason)}
                  onKeyDown={(e) => { if (e.key === 'Enter') openAlertWhatsApp(a.lead, a.reason); }}
                >

                  <div className="app-activity-item__body" style={{ flex: 1 }}>

                    <div className="app-activity-item__title">{a.title}</div>

                    <p style={{ fontSize: '0.875rem', marginTop: 6 }}>{a.message}</p>

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Нажмите — откроется WhatsApp с текстом сообщения
                    </p>

                  </div>

                  <span className="btn btn--whatsapp app-lead-actions__icon-btn" style={{ pointerEvents: 'none' }} aria-label="WhatsApp">
                    <WhatsAppIcon size={18} />
                  </span>

                </div>

              ))}

            </div>

          </div>

        </Reveal>

      )}



      <RevealGroup className="app-stats-grid" stagger={0.06}>

        {cards.map((c) => (

          <RevealItem key={c.label}>

            <Link to={c.link} className="card app-stat-card" style={{ display: 'block', textDecoration: 'none' }}>

              <p className="app-stat-card__label">{c.label}</p>

              <p className="app-stat-card__value" style={{ color: c.alert ? '#b91c1c' : 'var(--primary)' }}>{c.value ?? '—'}</p>

            </Link>

          </RevealItem>

        ))}

      </RevealGroup>



      <Reveal delay={0.1}>

        <div className="card app-section-card" style={{ marginTop: 24 }}>

          <div className="app-toolbar">

            <h2 className="app-section-card__title" style={{ margin: 0 }}>Входящие лиды ({activeLeads.length})</h2>

            <Link to="/app/crm" className="btn btn--primary">CRM → лиды</Link>

          </div>

          <div className="table-wrap">

            <table className="table">

              <thead>

                <tr>

                  <th>ФИО</th>

                  <th>Телефон</th>

                  <th>Город</th>

                  <th>Объект</th>

                  <th>Система</th>

                  <th>кВт</th>

                  <th>Источник</th>

                  <th>Получен</th>

                  <th>До контакта</th>

                  <th>Статус</th>

                  <th>Менеджер</th>

                  <th></th>

                </tr>

              </thead>

              <tbody>

                {activeLeads.map((l) => {
                  const urgency = getLeadUrgency(l);
                  return (
                  <tr
                    key={l.id}
                    className={urgency ? 'app-lead-row--urgent' : undefined}
                    title={urgency ? URGENCY_LABELS[urgency.reason] : undefined}
                  >

                    <td>

                      <strong>{l.fullName}</strong>

                      {l.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.notes.slice(0, 50)}</div>}

                    </td>

                    <td>{l.phone}</td>

                    <td>{l.city || '—'}</td>

                    <td>{OBJECT_TYPE[l.objectType] || '—'}</td>

                    <td>{SYSTEM_TYPE[l.systemType] || '—'}</td>

                    <td>{l.capacityKw ? formatNum(l.capacityKw) : '—'}</td>

                    <td><span className={`badge ${sourceBadge[l.source] || 'badge--new'}`}>{l.source || '—'}</span></td>

                    <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{formatDateTime(l.createdAt)}</td>

                    <td style={{ fontSize: '0.8125rem' }}>{l.contactedAt ? formatDuration(l.createdAt, l.contactedAt) : '—'}</td>

                    <td><span className={`badge ${leadBadge[l.status]}`}>{LEAD_STATUS[l.status]}</span></td>

                    <td>{l.assignee?.fullName || '—'}</td>

                    <td>
                      <div className="app-lead-actions">
                        <div className="app-lead-actions__row">
                          <LeadWhatsAppLink lead={l} user={user} onContact={markLeadContact} />
                        </div>
                        {!l.assignee && l.status !== 'CONVERTED' && (
                          <button type="button" className="btn btn--dark app-lead-actions__claim" onClick={() => claimLead(l.id)}>
                            Забрать
                          </button>
                        )}
                        {l.assignee?.id === user?.id && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--primary)', textAlign: 'center' }}>Ваш</span>
                        )}
                      </div>
                    </td>

                  </tr>
                  );
                })}

                {!activeLeads.length && (

                  <tr><td colSpan={12} style={{ color: 'var(--text-muted)' }}>Лидов пока нет</td></tr>

                )}

              </tbody>

            </table>

          </div>

        </div>

      </Reveal>

    </div>

  );

}



function NavigateContractor() {

  return (

    <Reveal>

      <h1 className="app-page-title">Кабинет подрядчика</h1>

      <p className="app-page-desc">Проекты на разогреве — выставляйте цену. Побеждает минимальная ставка.</p>

      <Link to="/app/auctions" className="btn btn--primary">Открытые торги</Link>

    </Reveal>

  );

}



function NavigateSupply() {

  const [count, setCount] = useState(0);

  useEffect(() => { operationsApi.unreadCount().then((r) => setCount(r.count)).catch(() => {}); }, []);

  return (

    <Reveal>

      <h1 className="app-page-title">Снабжение</h1>

      <p className="app-page-desc">Уведомления о необходимости докупки товара по ERP.</p>

      <Link to="/app/supply" className="btn btn--primary">

        Уведомления{count > 0 ? ` (${count})` : ''}

      </Link>

    </Reveal>

  );

}



function WarehouseDashboard() {

  const [wh, setWh] = useState(null);

  const [projects, setProjects] = useState([]);



  useEffect(() => {

    warehouseApi.summary().then(setWh).catch(() => {});

    erpApi.projects().then((p) => setProjects(p.filter((x) => ['PROCUREMENT', 'INSTALLATION'].includes(x.phase)))).catch(() => {});

  }, []);



  return (

    <div>

      <Reveal>

        <h1 className="app-page-title">Склад — выдача материалов</h1>

        <p className="app-page-desc">Выдача товара при передаче проекта на реализацию. При нехватке — уведомление снабженцу.</p>

      </Reveal>

      <RevealGroup className="app-stats-grid" stagger={0.06}>

        <RevealItem>

          <div className="card app-stat-card">

            <p className="app-stat-card__label">SKU на складе</p>

            <p className="app-stat-card__value">{wh?.totalSkus ?? '—'}</p>

          </div>

        </RevealItem>

        <RevealItem>

          <div className="card app-stat-card">

            <p className="app-stat-card__label">Низкий остаток</p>

            <p className="app-stat-card__value" style={{ color: wh?.lowStockCount > 0 ? '#b91c1c' : 'var(--primary)' }}>

              {wh?.lowStockCount ?? '—'}

            </p>

          </div>

        </RevealItem>

        <RevealItem>

          <div className="card app-stat-card">

            <p className="app-stat-card__label">Проектов к выдаче</p>

            <p className="app-stat-card__value">{projects.length}</p>

          </div>

        </RevealItem>

      </RevealGroup>

      <Reveal delay={0.1}>

        <div className="card app-section-card" style={{ marginTop: 24 }}>

          <h2 className="app-section-card__title">Проекты на реализации</h2>

          {projects.length ? projects.map((p) => (

            <div key={p.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>

              <strong>{p.title}</strong> — {p.city || '—'}

              <Link to="/app/projects" className="btn btn--dark app-table-btn" style={{ marginLeft: 12 }}>Выдать</Link>

            </div>

          )) : <p style={{ color: 'var(--text-muted)' }}>Нет проектов в фазе закупки/монтажа</p>}

        </div>

      </Reveal>

    </div>

  );

}



function AccountantDashboard() {

  const [finance, setFinance] = useState(null);

  useEffect(() => {

    financeApi.summary().then(setFinance).catch(() => {});

  }, []);

  return (

    <div>

      <Reveal>

        <h1 className="app-page-title">Бухгалтерия</h1>

        <p className="app-page-desc">Счета и финансовая сводка</p>

      </Reveal>

      <RevealGroup className="app-stats-grid" stagger={0.06}>

        <RevealItem>

          <Link to="/app/finance" className="card app-stat-card" style={{ display: 'block', textDecoration: 'none' }}>

            <p className="app-stat-card__label">К оплате</p>

            <p className="app-stat-card__value">{finance ? formatMoney(finance.pending) : '—'}</p>

          </Link>

        </RevealItem>

        <RevealItem>

          <div className="card app-stat-card">

            <p className="app-stat-card__label">Оплачено</p>

            <p className="app-stat-card__value">{finance ? formatMoney(finance.paid) : '—'}</p>

          </div>

        </RevealItem>

        <RevealItem>

          <div className="card app-stat-card">

            <p className="app-stat-card__label">Счетов</p>

            <p className="app-stat-card__value">{finance?.totalInvoices ?? '—'}</p>

          </div>

        </RevealItem>

      </RevealGroup>

      <Reveal delay={0.1}>

        <Link to="/app/finance" className="btn btn--primary" style={{ marginTop: 24 }}>Перейти к счетам</Link>

      </Reveal>

    </div>

  );

}


