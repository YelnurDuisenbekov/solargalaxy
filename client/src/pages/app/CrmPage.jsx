import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { crmApi, erpApi, usersApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Reveal } from '../../components/motion/ScrollReveal';
import { formatNum, formatDateTime, formatDuration, formatMoney } from '../../utils/format';
import {
  LEAD_STATUS, ACTIVITY_TYPE, leadBadge, SYSTEM_TYPE,
} from '../../utils/crmLabels';
import {
  resolveCity, validateLeadForm,
} from '../../utils/leadValidation';
import LeadWhatsAppLink from '../../components/LeadWhatsAppLink';
import AddressMapsLink from '../../components/AddressMapsLink';
import LeadFormFields, { emptyLeadForm } from '../../components/lead/LeadFormFields';
import FormField from '../../components/form/FormField';
import { googleMapsSearchUrl } from '../../utils/maps';
import { LeadProposalModal } from './ProposalPage';
import { getLeadUrgency, URGENCY_LABELS } from '../../utils/leadUrgency';
import './app-pages.css';

const TABS = [
  { id: 'leads', label: 'Лиды' },
  { id: 'activities', label: 'Задачи' },
];
const LEAD_SUB_TABS = [
  { id: 'active', label: 'В работе' },
  { id: 'converted', label: 'Проект создан' },
  { id: 'lost', label: 'Потерян' },
];

const leadProject = (l) => l.project || l.deal?.project;
const projectOpenUrl = (l) => {
  const p = leadProject(l);
  return p ? `/app/projects?open=${p.id}` : '/app/projects';
};

const emptyLead = { ...emptyLeadForm, source: 'CRM' };

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

function Modal({ title, onClose, children }) {
  return (
    <div className="app-modal-backdrop" onClick={onClose}>
      <div className="app-modal app-modal--wide" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function CrmPage() {
  const { user, isAdmin, canClaimLeads } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('leads');
  const [leadSubTab, setLeadSubTab] = useState('active');
  const [leads, setLeads] = useState([]);
  const [activities, setActivities] = useState([]);
  const [managers, setManagers] = useState([]);
  const [reassigningId, setReassigningId] = useState(null);
  const [modal, setModal] = useState(null);
  const [proposalLead, setProposalLead] = useState(null);
  const [surveyLead, setSurveyLead] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    crmApi.leads().then(setLeads);
    crmApi.activities().then(setActivities);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (isAdmin) usersApi.list('MANAGER').then(setManagers).catch(() => {});
  }, [isAdmin]);

  const handleError = (e) => setError(e.message);
  const claimLead = async (id) => {
    try { await crmApi.claimLead(id); load(); } catch (e) { handleError(e); }
  };
  const reassignLead = async (leadId, assigneeId) => {
    if (!assigneeId) return;
    setReassigningId(leadId);
    try {
      await crmApi.reassignLead(leadId, assigneeId);
      load();
    } catch (e) { handleError(e); }
    finally { setReassigningId(null); }
  };
  const updateLeadStatus = async (lead, status) => {
    if (status === 'SURVEY') {
      setSurveyLead(lead);
      return;
    }
    if (status === 'CONVERTED') {
      const existing = leadProject(lead);
      if (existing) {
        setLeadSubTab('converted');
        navigate(projectOpenUrl(lead));
        return;
      }
      if (lead.deal) {
        setLeadSubTab('converted');
        return;
      }
      if (!lead.address?.trim()) {
        setError('Сначала переведите лид в «Замер» и укажите адрес объекта');
        return;
      }
      try {
        const project = await crmApi.convertLead(lead.id, {});
        load();
        setLeadSubTab('converted');
        navigate(`/app/projects?open=${project.id}`);
      } catch (e) { handleError(e); }
      return;
    }
    try {
      await crmApi.updateLead(lead.id, { status });
      load();
      if (status !== 'LOST' && (lead.status === 'CONVERTED' || lead.status === 'LOST')) setLeadSubTab('active');
    } catch (e) { handleError(e); }
  };
  const markLeadContact = async (lead) => {
    try { await crmApi.markLeadContact(lead.id); load(); } catch (e) { handleError(e); }
  };
  const createLegacyProject = async (dealId) => {
    try {
      const project = await erpApi.createFromDeal(dealId);
      load();
      navigate(`/app/projects?open=${project.id}`);
    } catch (e) { handleError(e); }
  };
  const toggleActivity = async (a) => {
    try { await crmApi.updateActivity(a.id, { completed: !a.completed }); load(); } catch (e) { handleError(e); }
  };

  const activeLeads = leads.filter((l) => !['CONVERTED', 'LOST'].includes(l.status));
  const convertedLeads = leads.filter((l) => l.status === 'CONVERTED');
  const lostLeads = leads.filter((l) => l.status === 'LOST');
  const leadSubCounts = { active: activeLeads.length, converted: convertedLeads.length, lost: lostLeads.length };
  const visibleLeads = leadSubTab === 'converted' ? convertedLeads : leadSubTab === 'lost' ? lostLeads : activeLeads;

  const renderLeadRow = (l) => {
    const urgency = getLeadUrgency(l);
    return (
    <tr
      key={l.id}
      className={urgency ? 'app-lead-row--urgent' : undefined}
      title={urgency ? URGENCY_LABELS[urgency.reason] : undefined}
    >
      <td><strong>{l.fullName}</strong></td>
      <td>{l.phone}</td>
      <td>{l.city || '—'}</td>
      <td>{SYSTEM_TYPE[l.systemType] || '—'}</td>
      <td>{l.capacityKw ? formatNum(l.capacityKw) : '—'}</td>
      <td>
        {l.proposalAmount > 0 ? (
          <button type="button" className="btn btn--ghost app-table-btn" style={{ padding: '2px 8px', fontSize: '0.8125rem' }} onClick={() => setProposalLead(l)}>
            {formatMoney(l.proposalAmount)}
          </button>
        ) : l.capacityKw ? (
          <button type="button" className="btn btn--ghost app-table-btn" onClick={() => setProposalLead(l)}>КП</button>
        ) : '—'}
      </td>
      <td>{l.source || '—'}</td>
      <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{formatDateTime(l.createdAt)}</td>
      <td style={{ fontSize: '0.8125rem' }}>
        {l.contactedAt ? formatDuration(l.createdAt, l.contactedAt) : '—'}
      </td>
      <td><span className={`badge ${leadBadge[l.status]}`}>{LEAD_STATUS[l.status]}</span></td>
      <td>
        {isAdmin && managers.length ? (
          <select
            className="input app-lead-actions__status"
            value={l.assigneeId || ''}
            disabled={reassigningId === l.id}
            onChange={(e) => reassignLead(l.id, e.target.value)}
          >
            <option value="">— не назначен —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.fullName}</option>
            ))}
          </select>
        ) : (l.assignee?.fullName || '—')}
      </td>
      <td>
        <div className="app-lead-actions">
          {leadSubTab === 'active' && (
            <>
              <div className="app-lead-actions__row">
                <LeadWhatsAppLink lead={l} user={user} onContact={markLeadContact} />
                {l.capacityKw && (
                  <button type="button" className="btn btn--ghost app-lead-actions__kp" onClick={() => setProposalLead(l)}>КП</button>
                )}
              </div>
              {!l.assignee && canClaimLeads && (
                <button type="button" className="btn btn--dark app-lead-actions__claim" onClick={() => claimLead(l.id)}>Забрать</button>
              )}
            </>
          )}
          {leadProject(l) && (
            <Link to={projectOpenUrl(l)} className="btn btn--dark app-table-btn" style={{ width: '100%' }}>Открыть проект</Link>
          )}
          {leadSubTab === 'converted' && l.deal && !leadProject(l) && (
            <button type="button" className="btn btn--primary app-table-btn" style={{ width: '100%' }} onClick={() => createLegacyProject(l.deal.id)}>→ Проект</button>
          )}
          {l.status !== 'CONVERTED' && (
            <select
              className="app-lead-actions__status"
              value={l.status}
              onChange={(e) => updateLeadStatus(l, e.target.value)}
            >
              {Object.entries(LEAD_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          )}
        </div>
      </td>
    </tr>
    );
  };

  return (
    <div>
      <Reveal>
        <h1 className="app-page-title">CRM — продажи</h1>
        <p className="app-page-desc">Лиды и задачи менеджеров</p>
      </Reveal>

      <div className="app-tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`app-tab${tab === t.id ? ' app-tab--active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}

      {tab === 'leads' && (
        <>
          <div className="app-subtabs">
            {LEAD_SUB_TABS.map((st) => (
              <button
                key={st.id}
                type="button"
                className={`app-subtab${leadSubTab === st.id ? ' app-subtab--active' : ''}`}
                onClick={() => setLeadSubTab(st.id)}
              >
                {st.label}
                <span className="app-subtab__count">{leadSubCounts[st.id]}</span>
              </button>
            ))}
          </div>
          <div className="app-toolbar">
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {visibleLeads.length} {leadSubTab === 'active' ? 'активных' : leadSubTab === 'converted' ? 'закрытых' : 'потерянных'}
            </span>
            <button type="button" className="btn btn--primary" onClick={() => setModal('lead')}>+ Новый лид</button>
          </div>
          <div className="card app-section-card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ФИО</th><th>Телефон</th><th>Город</th><th>Система</th><th>кВт</th><th>КП</th><th>Источник</th>
                    <th>Получен</th><th>До контакта</th><th>Статус</th><th>Менеджер</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.map(renderLeadRow)}
                  {!visibleLeads.length && (
                    <tr>
                      <td colSpan={11} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
                        {leadSubTab === 'active' && 'Нет активных лидов'}
                        {leadSubTab === 'converted' && 'Нет лидов со статусом «Проект создан»'}
                        {leadSubTab === 'lost' && 'Нет потерянных лидов'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'activities' && (
        <>
          <div className="app-toolbar">
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{activities.filter((a) => !a.completed).length} открытых</span>
            <button type="button" className="btn btn--primary" onClick={() => setModal('activity')}>+ Задача</button>
          </div>
          <div className="app-activity-list">
            {activities.map((a) => (
              <div key={a.id} className={`card app-activity-item${a.completed ? ' app-activity-item--done' : ''}`}>
                <input type="checkbox" checked={a.completed} onChange={() => toggleActivity(a)} />
                <div className="app-activity-item__body">
                  <div className="app-activity-item__title">{ACTIVITY_TYPE[a.type]} — {a.title}</div>
                  {a.description && <p style={{ fontSize: '0.8125rem', marginTop: 4 }}>{a.description}</p>}
                  <div className="app-activity-item__meta">
                    {a.author?.fullName && `${a.author.fullName} · `}
                    {a.dueDate ? `до ${new Date(a.dueDate).toLocaleDateString('ru-RU')}` : 'без срока'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {modal === 'lead' && (
        <LeadForm
          user={user}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); setLeadSubTab('active'); load(); }}
        />
      )}
      {modal === 'activity' && <ActivityForm onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {proposalLead && (
        <LeadProposalModal
          lead={proposalLead}
          onClose={() => setProposalLead(null)}
          onSaved={load}
        />
      )}
      {surveyLead && (
        <SurveyLeadModal
          lead={surveyLead}
          onClose={() => setSurveyLead(null)}
          onSaved={() => { setSurveyLead(null); load(); }}
          onError={handleError}
        />
      )}
    </div>
  );
}

function SurveyLeadModal({ lead, onClose, onSaved, onError }) {
  const toLocalInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [address, setAddress] = useState(lead.address || '');
  const [surveyAt, setSurveyAt] = useState(toLocalInput(lead.surveyAt));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (address.trim().length < 3) {
      setError('Укажите адрес объекта (улица, дом)');
      return;
    }
    if (!surveyAt) {
      setError('Укажите дату и время выезда на замер');
      return;
    }
    setSaving(true);
    try {
      await crmApi.updateLead(lead.id, {
        status: 'SURVEY',
        address: address.trim(),
        surveyAt: new Date(surveyAt).toISOString(),
      });
      onSaved();
    } catch (err) {
      const msg = err.message || 'Не удалось сохранить';
      setError(msg);
      onError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-modal-backdrop" onClick={onClose}>
      <div className="app-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Замер — выезд на объект</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          {lead.fullName}{lead.city ? ` · ${lead.city}` : ''}
          {lead.capacityKw ? ` · ${formatNum(lead.capacityKw)} кВт` : ''}
        </p>

        <form className="app-modal__form" onSubmit={submit}>
          <FormField label="Адрес объекта *" error={error && address.trim().length < 3 ? error : ''}>
            <input
              className="input"
              placeholder="ул. Абая 10, частный дом"
              required
              minLength={3}
              value={address}
              onChange={(e) => { setAddress(e.target.value); setError(''); }}
              autoFocus
            />
            {lead.city && (
              <p className="app-field__hint">Город из лида: {lead.city}. Укажите улицу и номер дома.</p>
            )}
          </FormField>

          {googleMapsSearchUrl(lead.city, address) && (
            <AddressMapsLink city={lead.city} address={address} />
          )}

          <FormField label="Дата и время выезда *" error={error && address.trim().length >= 3 && !surveyAt ? error : ''}>
            <input
              className="input"
              type="datetime-local"
              required
              value={surveyAt}
              onChange={(e) => { setSurveyAt(e.target.value); setError(''); }}
            />
          </FormField>

          {error && address.trim().length >= 3 && surveyAt && <p className="error-msg">{error}</p>}

          <div className="app-modal__actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить замер'}
            </button>
            <button type="button" className="btn btn--outline-dark" onClick={onClose}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LeadForm({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ ...emptyLead });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const { valid, fields } = validateLeadForm(form);
    setFieldErrors(fields);
    if (!valid) {
      setError('Исправьте ошибки в форме');
      return;
    }
    try {
      await crmApi.createLead({
        fullName: form.fullName.trim(),
        phone: form.phone,
        city: resolveCity(form.citySelect, form.cityCustom),
        objectType: form.objectType,
        systemType: form.systemType,
        capacityKw: form.capacityKw ? Number(form.capacityKw) : null,
        source: form.source,
        notes: form.notes || null,
        assigneeId: user?.id || null,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
      if (err.fields) setFieldErrors(err.fields);
    }
  };

  return (
    <Modal title="Новый лид" onClose={onClose}>
      <form className="app-modal__form" onSubmit={submit}>
        <LeadFormFields form={form} setForm={setForm} fieldErrors={fieldErrors} showSource managerName={user?.fullName} />
        <FormErrors error={error} fieldErrors={fieldErrors} />
        <div className="app-modal__actions">
          <button type="submit" className="btn btn--primary">Сохранить</button>
          <button type="button" className="btn btn--outline-dark" onClick={onClose}>Отмена</button>
        </div>
      </form>
    </Modal>
  );
}

function ActivityForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ type: 'TASK', title: '', description: '', dueDate: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      await crmApi.createActivity({
        ...form,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      });
      onSaved();
    } catch (err) { setError(err.message); }
  };

  return (
    <Modal title="Новая задача" onClose={onClose}>
      <form className="app-modal__form" onSubmit={submit}>
        <div><label>Тип</label>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {Object.entries(ACTIVITY_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div><label>Заголовок</label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><label>Описание</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div><label>Срок</label><input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
        {error && <p className="error-msg">{error}</p>}
        <div className="app-modal__actions">
          <button type="submit" className="btn btn--primary">Добавить</button>
          <button type="button" className="btn btn--outline-dark" onClick={onClose}>Отмена</button>
        </div>
      </form>
    </Modal>
  );
}
