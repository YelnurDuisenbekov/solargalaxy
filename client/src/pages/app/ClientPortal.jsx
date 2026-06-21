import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../../context/AuthContext';

import { portalApi } from '../../api';

import { Reveal, RevealGroup, RevealItem } from '../../components/motion/ScrollReveal';
import AddressMapsLink from '../../components/AddressMapsLink';

import { formatMoney, formatNum } from '../../utils/format';

import {

  DEAL_STATUS, PROJECT_PHASE, INVOICE_STATUS, OBJECT_TYPE, SYSTEM_TYPE,
  LEAD_STATUS,

  dealBadge, phaseBadge, invoiceBadge, leadBadge,

} from '../../utils/crmLabels';

import './app-pages.css';



const CLIENT_PHASES = ['DESIGN', 'PROCUREMENT', 'INSTALLATION', 'COMMISSIONING', 'COMPLETED'];



function phaseIndex(phase) {

  if (phase === 'BIDDING' || phase === 'SURVEY') return CLIENT_PHASES.indexOf('DESIGN');

  return CLIENT_PHASES.indexOf(phase);

}



function PhasePipeline({ phase }) {

  const current = phaseIndex(phase);

  return (

    <div className="app-phase-pipeline app-phase-pipeline--readonly">

      {CLIENT_PHASES.map((ph, i) => (

        <span

          key={ph}

          className={`app-phase-step${phase === ph || ((phase === 'BIDDING' || phase === 'SURVEY') && ph === 'DESIGN') ? ' app-phase-step--active' : ''}${i < current ? ' app-phase-step--done' : ''}`}

        >

          {PROJECT_PHASE[ph]}

        </span>

      ))}

    </div>

  );

}



function ProjectDetail({ project }) {

  const kit = project.deal?.kitItems?.length

    ? project.deal.kitItems

    : project.materials?.map((m) => ({

      name: m.product?.name || '—',

      quantity: m.quantityPlanned,

      category: null,

    })) || [];



  return (

    <div className="app-detail-panel" id="portal-detail">

      <div className="card app-section-card">

        <div className="app-toolbar">

          <div>

            {project.projectNumber && (

              <p className="app-portal-detail__number">{project.projectNumber}</p>

            )}

            <h2 className="app-section-card__title" style={{ margin: 0 }}>{project.title}</h2>

          </div>

          <span className={`badge ${phaseBadge[project.phase]}`}>{PROJECT_PHASE[project.phase]}</span>

        </div>



        <PhasePipeline phase={project.phase} />



        <div className="app-detail-grid">

          <div>

            <strong>Мощность:</strong> {project.capacityKw ? `${formatNum(project.capacityKw)} кВт` : '—'}<br />

            <strong>Город:</strong> {project.city || project.lead?.city || '—'}<br />

            <strong>Адрес:</strong> {project.address || project.deal?.address || '—'}<br />

            {(project.address || project.deal?.address) && (
              <>
                <AddressMapsLink
                  city={project.city || project.lead?.city}
                  address={project.address || project.deal?.address}
                />
                <br />
              </>
            )}

            {project.lead && (

              <>

                <strong>Тип объекта:</strong> {OBJECT_TYPE[project.lead.objectType] || '—'}<br />

                <strong>Тип системы:</strong> {SYSTEM_TYPE[project.lead.systemType] || '—'}<br />

              </>

            )}

          </div>

          <div>

            <strong>Менеджер:</strong> {project.assignee?.fullName || '—'}<br />

            {project.assignee?.phone && (

              <><strong>Тел. менеджера:</strong> {project.assignee.phone}<br /></>

            )}

            <strong>Старт:</strong> {project.startDate ? new Date(project.startDate).toLocaleDateString('ru-RU') : '—'}<br />

            <strong>Завершение:</strong> {project.endDate ? new Date(project.endDate).toLocaleDateString('ru-RU') : '—'}<br />

            <strong>Обновлён:</strong> {new Date(project.updatedAt).toLocaleDateString('ru-RU')}

          </div>

        </div>



        {project.notes && (

          <div className="app-portal-detail__notes">

            <strong>Примечания</strong>

            <p>{project.notes}</p>

          </div>

        )}



        {project.deal && (

          <div className="app-portal-detail__block">

            <h3 className="app-portal-detail__subtitle">Сделка</h3>

            <p>

              <strong>{project.deal.title}</strong> — {formatMoney(project.deal.amount)}

              {' '}<span className={`badge ${dealBadge[project.deal.status]}`}>{DEAL_STATUS[project.deal.status]}</span>

            </p>

          </div>

        )}



        {kit.length > 0 && (

          <div className="app-portal-detail__block">

            <h3 className="app-portal-detail__subtitle">Комплектация</h3>

            <div className="table-wrap">

              <table className="table table--compact">

                <thead><tr><th>Наименование</th><th>Кол-во</th></tr></thead>

                <tbody>

                  {kit.map((item, i) => (

                    <tr key={item.id || i}>

                      <td>{item.name}</td>

                      <td>{item.quantity}</td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>

        )}



        {project.invoices?.length > 0 && (

          <div className="app-portal-detail__block">

            <h3 className="app-portal-detail__subtitle">Счета по проекту</h3>

            <div className="table-wrap">

              <table className="table table--compact">

                <thead><tr><th>№</th><th>Сумма</th><th>Статус</th><th>Срок</th></tr></thead>

                <tbody>

                  {project.invoices.map((inv) => (

                    <tr key={inv.id}>

                      <td>{inv.number}</td>

                      <td>{formatMoney(inv.amount)}</td>

                      <td><span className={`badge ${invoiceBadge[inv.status]}`}>{INVOICE_STATUS[inv.status]}</span></td>

                      <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('ru-RU') : '—'}</td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>

        )}

      </div>

    </div>

  );

}



function DealDetail({ deal }) {

  return (

    <div className="app-detail-panel" id="portal-detail">

      <div className="card app-section-card">

        <div className="app-toolbar">

          <h2 className="app-section-card__title" style={{ margin: 0 }}>{deal.title}</h2>

          <span className={`badge ${dealBadge[deal.status]}`}>{DEAL_STATUS[deal.status]}</span>

        </div>



        <div className="app-detail-grid">

          <div>

            <strong>Сумма:</strong> {formatMoney(deal.amount)}<br />

            <strong>Мощность:</strong> {deal.capacityKw ? `${formatNum(deal.capacityKw)} кВт` : '—'}<br />

            <strong>Город:</strong> {deal.city || '—'}<br />

            <strong>Адрес:</strong> {deal.address || '—'}

          </div>

          <div>

            <strong>Тип объекта:</strong> {OBJECT_TYPE[deal.objectType] || '—'}<br />

            <strong>Тип системы:</strong> {SYSTEM_TYPE[deal.systemType] || '—'}<br />

            <strong>Менеджер:</strong> {deal.assignee?.fullName || '—'}<br />

            {deal.assignee?.phone && (

              <><strong>Тел. менеджера:</strong> {deal.assignee.phone}<br /></>

            )}

          </div>

        </div>



        {deal.notes && (

          <div className="app-portal-detail__notes">

            <strong>Примечания</strong>

            <p>{deal.notes}</p>

          </div>

        )}



        {deal.project && (

          <div className="app-portal-detail__block">

            <h3 className="app-portal-detail__subtitle">Связанный проект</h3>

            <p>

              {deal.project.projectNumber && <span style={{ marginRight: 8, color: 'var(--text-muted)' }}>{deal.project.projectNumber}</span>}

              {deal.project.title}

              {' '}<span className={`badge ${phaseBadge[deal.project.phase]}`}>{PROJECT_PHASE[deal.project.phase]}</span>

            </p>

          </div>

        )}



        {deal.kitItems?.length > 0 && (

          <div className="app-portal-detail__block">

            <h3 className="app-portal-detail__subtitle">Комплектация</h3>

            <div className="table-wrap">

              <table className="table table--compact">

                <thead><tr><th>Наименование</th><th>Кол-во</th><th>Цена</th></tr></thead>

                <tbody>

                  {deal.kitItems.map((item) => (

                    <tr key={item.id}>

                      <td>{item.name}</td>

                      <td>{item.quantity}</td>

                      <td>{formatMoney(item.unitPrice * item.quantity)}</td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>

        )}

      </div>

    </div>

  );

}



function InvoiceDetail({ invoice }) {

  return (

    <div className="app-detail-panel" id="portal-detail">

      <div className="card app-section-card">

        <div className="app-toolbar">

          <h2 className="app-section-card__title" style={{ margin: 0 }}>Счёт {invoice.number}</h2>

          <span className={`badge ${invoiceBadge[invoice.status]}`}>{INVOICE_STATUS[invoice.status]}</span>

        </div>



        <div className="app-detail-grid">

          <div>

            <strong>Сумма:</strong> {formatMoney(invoice.amount)}<br />

            <strong>Срок оплаты:</strong> {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('ru-RU') : '—'}<br />

            <strong>Оплачен:</strong> {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString('ru-RU') : '—'}

          </div>

          <div>

            {invoice.project && (

              <>

                <strong>Проект:</strong> {invoice.project.projectNumber ? `${invoice.project.projectNumber} · ` : ''}{invoice.project.title}<br />

                <strong>Этап:</strong> {PROJECT_PHASE[invoice.project.phase] || '—'}

              </>

            )}

          </div>

        </div>



        {invoice.notes && (

          <div className="app-portal-detail__notes">

            <strong>Примечания</strong>

            <p>{invoice.notes}</p>

          </div>

        )}

      </div>

    </div>

  );

}



function LeadDetail({ lead }) {

  return (

    <div className="app-detail-panel" id="portal-detail">

      <div className="card app-section-card">

        <div className="app-toolbar">

          <div>

            <h2 className="app-section-card__title" style={{ margin: 0 }}>Заявка от {new Date(lead.createdAt).toLocaleDateString('ru-RU')}</h2>

            <p className="app-portal-detail__number" style={{ margin: '4px 0 0' }}>{lead.fullName}</p>

          </div>

          <span className={`badge ${leadBadge[lead.status]}`}>{LEAD_STATUS[lead.status]}</span>

        </div>



        <div className="app-detail-grid">

          <div>

            <strong>Телефон:</strong> {lead.phone}<br />

            <strong>Город:</strong> {lead.city || '—'}<br />

            <strong>Тип объекта:</strong> {OBJECT_TYPE[lead.objectType] || '—'}<br />

            <strong>Тип системы:</strong> {SYSTEM_TYPE[lead.systemType] || '—'}<br />

            <strong>Мощность:</strong> {lead.capacityKw ? `${formatNum(lead.capacityKw)} кВт` : '—'}

          </div>

          <div>

            <strong>Источник:</strong> {lead.source || '—'}<br />

            <strong>Подана:</strong> {new Date(lead.createdAt).toLocaleString('ru-RU')}<br />

            <strong>Обновлена:</strong> {new Date(lead.updatedAt).toLocaleString('ru-RU')}<br />

            <strong>Менеджер:</strong> {lead.assignee?.fullName || 'Назначается…'}<br />

            {lead.assignee?.phone && (

              <><strong>Тел. менеджера:</strong> {lead.assignee.phone}</>

            )}

          </div>

        </div>



        {lead.notes && (

          <div className="app-portal-detail__notes">

            <strong>Данные расчёта и примечания</strong>

            <p style={{ whiteSpace: 'pre-wrap' }}>{lead.notes}</p>

          </div>

        )}



        {lead.proposalAmount > 0 && (

          <div className="app-portal-detail__block">

            <h3 className="app-portal-detail__subtitle">Коммерческое предложение</h3>

            <p><strong>Сумма:</strong> {formatMoney(lead.proposalAmount)}</p>

          </div>

        )}



        {lead.project && (

          <div className="app-portal-detail__block">

            <h3 className="app-portal-detail__subtitle">Проект по заявке</h3>

            <p>

              {lead.project.projectNumber && <span style={{ marginRight: 8, color: 'var(--text-muted)' }}>{lead.project.projectNumber}</span>}

              {lead.project.title}

              {' '}<span className={`badge ${phaseBadge[lead.project.phase]}`}>{PROJECT_PHASE[lead.project.phase]}</span>

            </p>

          </div>

        )}



        {lead.deal && !lead.project && (

          <div className="app-portal-detail__block">

            <h3 className="app-portal-detail__subtitle">Сделка</h3>

            <p>

              <strong>{lead.deal.title}</strong> — {formatMoney(lead.deal.amount)}

              {' '}<span className={`badge ${dealBadge[lead.deal.status]}`}>{DEAL_STATUS[lead.deal.status]}</span>

            </p>

          </div>

        )}

      </div>

    </div>

  );

}



export default function ClientPortal() {

  const { user } = useAuth();

  const [data, setData] = useState(null);

  const [tab, setTab] = useState('projects');

  const [selectedId, setSelectedId] = useState(null);

  const [detail, setDetail] = useState(null);

  const [loadingDetail, setLoadingDetail] = useState(false);

  const [error, setError] = useState('');



  const openItem = useCallback(async (type, id) => {

    setSelectedId(id);

    setLoadingDetail(true);

    setError('');

    setDetail(null);

    try {

      if (type === 'projects') {

        const p = await portalApi.project(id);

        setDetail({ type: 'project', data: p });

      } else if (type === 'deals') {

        const d = await portalApi.deal(id);

        setDetail({ type: 'deal', data: d });

      } else if (type === 'leads') {

        const l = await portalApi.lead(id);

        setDetail({ type: 'lead', data: l });

      } else {

        const inv = await portalApi.invoice(id);

        setDetail({ type: 'invoice', data: inv });

      }

    } catch (e) {

      setError(e.message || 'Не удалось загрузить данные');

    } finally {

      setLoadingDetail(false);

    }

  }, []);



  const pickDefault = useCallback((dashboard) => {

    if (dashboard.leads?.length) {

      setTab('leads');

      openItem('leads', dashboard.leads[0].id);

    } else if (dashboard.projects.length) {

      setTab('projects');

      openItem('projects', dashboard.projects[0].id);

    } else if (dashboard.deals.length) {

      setTab('deals');

      openItem('deals', dashboard.deals[0].id);

    } else if (dashboard.invoices.length) {

      setTab('invoices');

      openItem('invoices', dashboard.invoices[0].id);

    }

  }, [openItem]);



  useEffect(() => {

    portalApi.dashboard()

      .then((d) => {

        setData(d);

        pickDefault(d);

      })

      .catch(() => setError('Не удалось загрузить кабинет'));

  }, [pickDefault]);



  useEffect(() => {

    if (detail?.data?.id) {

      document.getElementById('portal-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    }

  }, [detail?.data?.id]);



  const switchTab = (nextTab) => {

    setTab(nextTab);

    setError('');

    const list = data?.[nextTab] || [];

    if (list.length) {

      openItem(nextTab, list[0].id);

    } else {

      setSelectedId(null);

      setDetail(null);

    }

  };



  const tabs = [

    { key: 'leads', label: 'Мои заявки', count: data?.leads?.length ?? 0 },

    { key: 'projects', label: 'Проекты', count: data?.projects.length ?? 0 },

    { key: 'deals', label: 'Сделки', count: data?.deals.length ?? 0 },

    { key: 'invoices', label: 'Счета', count: data?.invoices.length ?? 0 },

  ];



  const list = data?.[tab] || [];



  return (

    <div>

      <Reveal>

        <h1 className="app-page-title">Личный кабинет</h1>

        <p className="app-page-desc">

          {user?.fullName}{user?.company ? ` · ${user.company}` : ''}

          {user?.phone ? ` · ${user.phone}` : ''}

        </p>

      </Reveal>



      {!data ? (

        <p className="app-page-desc">Загрузка…</p>

      ) : (

        <>

          <RevealGroup className="app-stats-grid" stagger={0.06}>

            {tabs.map((t) => (

              <RevealItem key={t.key}>

                <button

                  type="button"

                  className={`card app-stat-card app-stat-card--clickable${tab === t.key ? ' app-stat-card--active' : ''}`}

                  onClick={() => switchTab(t.key)}

                  disabled={t.count === 0 && t.key !== 'leads'}

                >

                  <p className="app-stat-card__label">{t.label}</p>

                  <p className="app-stat-card__value">{t.count}</p>

                </button>

              </RevealItem>

            ))}

          </RevealGroup>



          {error && <p className="error-msg" style={{ margin: '16px 0' }}>{error}</p>}



          {list.length > 0 ? (

            <Reveal delay={0.05}>

              <div className="card app-section-card" style={{ marginTop: 24 }}>

                <h2 className="app-section-card__title">

                  {tab === 'leads' && 'Мои поданные заявки'}

                  {tab === 'projects' && 'Мои проекты'}

                  {tab === 'deals' && 'Мои сделки'}

                  {tab === 'invoices' && 'Мои счета'}

                </h2>

                <div className="app-portal-list">

                  {tab === 'leads' && list.map((l) => (

                    <button

                      key={l.id}

                      type="button"

                      className={`app-portal-card${selectedId === l.id ? ' app-portal-card--active' : ''}`}

                      onClick={() => openItem('leads', l.id)}

                    >

                      <div className="app-portal-card__head">

                        <strong>

                          {new Date(l.createdAt).toLocaleDateString('ru-RU')}

                          {l.city ? ` · ${l.city}` : ''}

                        </strong>

                        <span className={`badge ${leadBadge[l.status]}`}>{LEAD_STATUS[l.status]}</span>

                      </div>

                      <p className="app-portal-card__meta">

                        {SYSTEM_TYPE[l.systemType] || '—'}

                        {l.capacityKw ? ` · ${formatNum(l.capacityKw)} кВт` : ''}

                      </p>

                    </button>

                  ))}



                  {tab === 'projects' && list.map((p) => (

                    <button

                      key={p.id}

                      type="button"

                      className={`app-portal-card${selectedId === p.id ? ' app-portal-card--active' : ''}`}

                      onClick={() => openItem('projects', p.id)}

                    >

                      <div className="app-portal-card__head">

                        <strong>

                          {p.projectNumber && <span className="app-portal-card__num">{p.projectNumber}</span>}

                          {p.title}

                        </strong>

                        <span className={`badge ${phaseBadge[p.phase]}`}>{PROJECT_PHASE[p.phase]}</span>

                      </div>

                      <p className="app-portal-card__meta">

                        {p.capacityKw ? `${formatNum(p.capacityKw)} кВт · ` : ''}

                        {p.city || ''}{p.address ? `, ${p.address}` : ''}

                      </p>

                    </button>

                  ))}



                  {tab === 'deals' && list.map((d) => (

                    <button

                      key={d.id}

                      type="button"

                      className={`app-portal-card${selectedId === d.id ? ' app-portal-card--active' : ''}`}

                      onClick={() => openItem('deals', d.id)}

                    >

                      <div className="app-portal-card__head">

                        <strong>{d.title}</strong>

                        <span className={`badge ${dealBadge[d.status]}`}>{DEAL_STATUS[d.status]}</span>

                      </div>

                      <p className="app-portal-card__meta">

                        {formatMoney(d.amount)}

                        {d.capacityKw ? ` · ${formatNum(d.capacityKw)} кВт` : ''}

                        {d.city ? ` · ${d.city}` : ''}

                      </p>

                    </button>

                  ))}



                  {tab === 'invoices' && list.map((inv) => (

                    <button

                      key={inv.id}

                      type="button"

                      className={`app-portal-card${selectedId === inv.id ? ' app-portal-card--active' : ''}`}

                      onClick={() => openItem('invoices', inv.id)}

                    >

                      <div className="app-portal-card__head">

                        <strong>№ {inv.number}</strong>

                        <span className={`badge ${invoiceBadge[inv.status]}`}>{INVOICE_STATUS[inv.status]}</span>

                      </div>

                      <p className="app-portal-card__meta">

                        {formatMoney(inv.amount)}

                        {inv.dueDate ? ` · до ${new Date(inv.dueDate).toLocaleDateString('ru-RU')}` : ''}

                      </p>

                    </button>

                  ))}

                </div>

              </div>

            </Reveal>

          ) : (

            <Reveal delay={0.05}>

              <div className="card app-section-card" style={{ marginTop: 24 }}>

                <p className="app-page-desc" style={{ margin: 0 }}>

                  {tab === 'leads' && 'Заявок пока нет. Оставьте заявку на сайте — она появится здесь по номеру телефона из вашего профиля.'}

                  {tab === 'projects' && 'У вас пока нет проектов. Оставьте заявку на сайте — они появятся здесь по номеру телефона.'}

                  {tab === 'deals' && 'Сделок пока нет.'}

                  {tab === 'invoices' && 'Счетов пока нет.'}

                </p>

              </div>

            </Reveal>

          )}



          {loadingDetail && (

            <p className="app-page-desc" style={{ marginTop: 24 }}>Загрузка карточки…</p>

          )}



          {!loadingDetail && detail?.type === 'project' && <ProjectDetail project={detail.data} />}

          {!loadingDetail && detail?.type === 'deal' && <DealDetail deal={detail.data} />}

          {!loadingDetail && detail?.type === 'invoice' && <InvoiceDetail invoice={detail.data} />}

          {!loadingDetail && detail?.type === 'lead' && <LeadDetail lead={detail.data} />}

        </>

      )}

    </div>

  );

}

