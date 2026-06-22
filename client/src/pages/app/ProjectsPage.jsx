import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { erpApi, warehouseApi, usersApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Reveal } from '../../components/motion/ScrollReveal';
import AddressMapsLink from '../../components/AddressMapsLink';
import { formatMoney, formatNum } from '../../utils/format';
import { PROJECT_PHASE, OBJECT_TYPE, SYSTEM_TYPE } from '../../utils/crmLabels';
import { canLaunchAuction, getAuctionState, pastAuctionNote } from '../../utils/projectAuctionState';
import { getLeadWebsiteInfo, projectLeadSource } from '../../utils/leadWebsiteInfo';
import {
  maxDiscountForProduct,
  lineTotal,
  lineSubtotal,
  kitTotal,
  kitSubtotal,
  kitNeedsApproval,
  groupMaterials,
  effectiveUnitPrice,
  effectivePurchasePrice,
  MAX_GLOBAL_KIT_DISCOUNT,
  MATERIALS_APPROVAL_STATUS,
} from '../../utils/materialDiscount';
import './app-pages.css';

const PHASES = Object.keys(PROJECT_PHASE);
const KANBAN_PHASES = PHASES.filter((p) => p !== 'CANCELLED' && p !== 'BIDDING');

function toDateInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateInputToIso(value) {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function projectToForm(project) {
  return {
    title: project.title || '',
    capacityKw: project.capacityKw != null ? String(project.capacityKw) : '',
    city: project.city || project.lead?.city || '',
    address: project.address || '',
    notes: project.notes || '',
    startDate: toDateInputValue(project.startDate),
    endDate: toDateInputValue(project.endDate),
  };
}

function LeadWebsiteInfoPanel({ project }) {
  const lead = projectLeadSource(project);
  const items = getLeadWebsiteInfo(lead);

  return (
    <aside className="app-project-site-info">
      <h3 className="app-portal-detail__subtitle">Данные с сайта</h3>
      {!items.length ? (
        <p className="app-project-site-info__empty">Заявка с сайта не привязана или без данных калькулятора.</p>
      ) : (
        <dl className="app-project-site-info__list">
          {items.map(({ label, value, multiline }) => (
            <div key={label} className="app-project-site-info__row">
              <dt>{label}</dt>
              <dd className={multiline ? 'app-project-site-info__value--multiline' : undefined}>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {lead?.id && (
        <Link to="/app/crm" className="app-project-site-info__link">Открыть лид в CRM →</Link>
      )}
    </aside>
  );
}

function ProjectDetailView({ project, isAdmin, managers, onReassign, reassigning }) {
  const lead = projectLeadSource(project);
  const clientName = project.client?.fullName || project.client?.company || lead?.fullName || '—';
  const phone = lead?.phone || project.client?.phone;

  return (
    <div className="app-project-edit__layout app-project-edit__layout--readonly">
      <div>
        <h3 className="app-portal-detail__subtitle">Данные проекта</h3>
        <div className="app-project-view__grid">
          <p><strong>Название:</strong> {project.title || '—'}</p>
          <p><strong>Мощность:</strong> {project.capacityKw ? `${formatNum(project.capacityKw)} кВт` : '—'}</p>
          <p><strong>Город:</strong> {project.city || lead?.city || '—'}</p>
          <p><strong>Адрес:</strong> {project.address || '—'}</p>
          <p><strong>Старт:</strong> {project.startDate ? new Date(project.startDate).toLocaleDateString('ru-RU') : '—'}</p>
          <p><strong>Завершение:</strong> {project.endDate ? new Date(project.endDate).toLocaleDateString('ru-RU') : '—'}</p>
          {project.notes && (
            <p className="app-project-view__notes"><strong>Примечания:</strong> {project.notes}</p>
          )}
        </div>
        <div className="app-project-edit__meta app-detail-grid" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--border)' }}>
          <div>
            <strong>Клиент:</strong> {clientName}<br />
            {phone && <><strong>Телефон:</strong> {phone}<br /></>}
            <strong>Менеджер:</strong>{' '}
            {isAdmin && managers?.length ? (
              <select
                className="input"
                style={{ display: 'inline-block', width: 'auto', minWidth: 180, marginLeft: 8, marginTop: 4 }}
                value={project.assigneeId || ''}
                disabled={reassigning}
                onChange={(e) => { if (e.target.value) onReassign(e.target.value); }}
              >
                <option value="">— не назначен —</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.fullName}</option>
                ))}
              </select>
            ) : (project.assignee?.fullName || '—')}
          </div>
          <div>
            {project.address && (
              <AddressMapsLink city={project.city || lead?.city} address={project.address} />
            )}
          </div>
        </div>
      </div>
      <LeadWebsiteInfoPanel project={project} />
    </div>
  );
}

function ProjectDetailEditor({ project, canEdit, editing, onEditingChange, onSaved, onError, isAdmin, managers, onReassign, reassigning }) {
  const [form, setForm] = useState(() => projectToForm(project));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(projectToForm(project));
  }, [project.id, project.updatedAt]);

  const cancelEdit = () => {
    setForm(projectToForm(project));
    onEditingChange(false);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return onError('Укажите название проекта');
    setSaving(true);
    try {
      await erpApi.updateProject(project.id, {
        title: form.title.trim(),
        capacityKw: form.capacityKw ? Number(form.capacityKw) : null,
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        startDate: dateInputToIso(form.startDate),
        endDate: dateInputToIso(form.endDate),
      });
      onEditingChange(false);
      onSaved();
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit || !editing) {
    return (
      <ProjectDetailView
        project={project}
        isAdmin={isAdmin}
        managers={managers}
        onReassign={onReassign}
        reassigning={reassigning}
      />
    );
  }

  const lead = projectLeadSource(project);
  const clientName = project.client?.fullName || project.client?.company || lead?.fullName || '—';
  const phone = lead?.phone || project.client?.phone;

  return (
    <div className="app-project-edit">
      <div className="app-project-edit__layout">
        <form onSubmit={save} className="app-project-edit__form">
          <h3 className="app-portal-detail__subtitle">Редактирование</h3>
          <div className="app-project-edit__grid">
            <div className="app-field app-field--full">
              <label>Название</label>
              <input
                className="input"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="app-field">
              <label>Мощность, кВт</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.1"
                value={form.capacityKw}
                onChange={(e) => setForm({ ...form, capacityKw: e.target.value })}
              />
            </div>
            <div className="app-field">
              <label>Город</label>
              <input
                className="input"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="app-field app-field--full">
              <label>Адрес</label>
              <input
                className="input"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="app-field">
              <label>Дата старта</label>
              <input
                className="input"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>
            <div className="app-field">
              <label>Дата завершения</label>
              <input
                className="input"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
            <div className="app-field app-field--full">
              <label>Примечания</label>
              <textarea
                className="input"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="app-project-edit__actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
            <button type="button" className="btn btn--outline-dark" onClick={cancelEdit}>
              Отмена
            </button>
          </div>
        </form>

        <LeadWebsiteInfoPanel project={project} />
      </div>

      <div className="app-project-edit__meta app-detail-grid">
        <div>
          <strong>Клиент:</strong> {clientName}<br />
          {phone && <><strong>Телефон:</strong> {phone}<br /></>}
          <strong>Менеджер:</strong> {project.assignee?.fullName || '—'}
        </div>
        <div>
          {form.address && (
            <AddressMapsLink city={form.city || lead?.city} address={form.address} />
          )}
        </div>
      </div>
    </div>
  );
}

function projectsInPhase(projects, phase) {
  if (phase === 'DESIGN') {
    return projects.filter((p) => p.phase === 'DESIGN' || p.phase === 'SURVEY');
  }
  if (phase === 'BIDDING') return projects.filter((p) => p.phase === 'BIDDING');
  return projects.filter((p) => p.phase === phase);
}

function projectKanbanPhase(project) {
  if (project.phase === 'SURVEY') return 'DESIGN';
  return project.phase;
}

function isSameKanbanColumn(project, phase) {
  return projectKanbanPhase(project) === phase;
}

function ProjectKanbanControls({ project, canAuction, onLaunch, onPhaseChange }) {
  if (!canAuction) return null;

  const state = getAuctionState(project);
  const showAuctionSlot = project.phase !== 'CANCELLED' && state !== 'won';

  return (
    <div className="app-kanban__footer" onClick={(e) => e.stopPropagation()}>
      <div className="app-kanban__footer-row">
        {showAuctionSlot && (
          state === 'open' ? (
            <div className="app-kanban__auction-status">Торги открыты</div>
          ) : canLaunchAuction(project) ? (
            <button
              type="button"
              className="btn btn--dark app-auction-btn"
              title={state === 'failed' ? 'Запустить торги повторно' : 'Запустить торги'}
              onClick={() => onLaunch(project)}
            >
              на торги
            </button>
          ) : null
        )}
        <select
          className="app-kanban__phase-select"
          value={project.phase}
          onChange={(e) => onPhaseChange(project.id, e.target.value)}
        >
          {KANBAN_PHASES.map((ph) => (
            <option key={ph} value={ph}>{PROJECT_PHASE[ph]}</option>
          ))}
          <option value="CANCELLED">{PROJECT_PHASE.CANCELLED}</option>
        </select>
      </div>
      {state === 'failed' && canLaunchAuction(project) && (
        <p className="app-kanban__auction-note">{pastAuctionNote(project)}</p>
      )}
    </div>
  );
}

function ProjectAuctionPanel({ project, canManage, onAcceptBid, onCloseAuction, onDownloadAttachment }) {
  const state = getAuctionState(project);
  if (!canManage || project.phase === 'CANCELLED') return null;

  const showFailedNote = state === 'failed' && canLaunchAuction(project);
  const showOpenPanel = state === 'open';
  const showWon = state === 'won' && project.winningBid;

  if (!showFailedNote && !showOpenPanel && !showWon) return null;

  return (
    <div className="app-project-auction-panel">
      {showFailedNote && (
        <p className="app-kanban__auction-note">{pastAuctionNote(project)}</p>
      )}

      {showWon && (
        <p className="app-kanban__auction-note" style={{ color: 'var(--primary)' }}>
          Подрядчик: {project.winningBid.contractor?.fullName || project.winningBid.contractor?.company}
          {' — '}{formatMoney(project.winningBid.price)}
        </p>
      )}

      {showOpenPanel && (
        <div className="card app-project-auction-open">
          {project.auctionDeadline && (
            <p className="app-project-auction-open__meta">
              Срок ставок до {new Date(project.auctionDeadline).toLocaleDateString('ru-RU')}
            </p>
          )}
          <p className="app-project-auction-open__hint">
            Менеджер выбирает подрядчика с учётом цены и качества — не обязательно минимальная ставка.
          </p>
          {project.auctionBrief && <p style={{ marginTop: 8, fontSize: '0.875rem' }}>{project.auctionBrief}</p>}
          {project.attachments?.length > 0 && (
            <div style={{ marginTop: 8, fontSize: '0.875rem' }}>
              <strong>Файлы:</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {project.attachments.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="btn btn--ghost" style={{ padding: 0, fontSize: 'inherit' }} onClick={() => onDownloadAttachment(a.id)}>
                      {a.originalName}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {project.bids?.length > 0 ? (
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table className="table table--compact">
                <thead>
                  <tr><th>Подрядчик</th><th>Цена</th><th>Статус</th><th></th></tr>
                </thead>
                <tbody>
                  {project.bids.map((b) => (
                    <tr key={b.id}>
                      <td>{b.contractor?.fullName}</td>
                      <td>{formatMoney(b.price)}</td>
                      <td>{b.status === 'WON' ? 'Выбран' : b.status === 'LOST' ? 'Отклонена' : 'На рассмотрении'}</td>
                      <td>
                        {b.status === 'PENDING' && (
                          <button type="button" className="btn btn--primary app-table-btn" onClick={() => onAcceptBid(b.id)}>
                            Выбрать
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 8 }}>Ставок пока нет</p>
          )}
          <button type="button" className="btn btn--outline-dark app-table-btn" style={{ marginTop: 8 }} onClick={onCloseAuction}>
            Закрыть без выбора подрядчика
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  const { isCrm, isWarehouse, isDirector, isAdmin, user } = useAuth();
  const canApproveMaterials = isDirector || isAdmin;
  const [searchParams, setSearchParams] = useSearchParams();
  const issueMode = searchParams.get('issue') === '1';
  const canIssue = isWarehouse;
  const canEditMaterials = isCrm;
  const canAuction = isCrm;
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [products, setProducts] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [auctionProject, setAuctionProject] = useState(null);
  const [detailEditing, setDetailEditing] = useState(false);
  const [dragProjectId, setDragProjectId] = useState(null);
  const [dropPhase, setDropPhase] = useState(null);
  const [managers, setManagers] = useState([]);
  const [reassigning, setReassigning] = useState(false);
  const dragBlockClickRef = useRef(false);

  const load = () => erpApi.projects().then(setProjects);

  const openProject = useCallback(async (id) => {
    setSelected(id);
    try {
      const p = await erpApi.project(id);
      setDetail(p);
      setError('');
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    load();
    warehouseApi.products().then(setProducts).catch(() => {});
  }, []);

  useEffect(() => {
    if (isAdmin) usersApi.list('MANAGER').then(setManagers).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId) openProject(openId);
  }, [searchParams, openProject]);

  useEffect(() => {
    setDetailEditing(false);
  }, [detail?.id]);

  useEffect(() => {
    if (detail?.id) {
      document.getElementById('project-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [detail?.id]);

  const updatePhase = async (id, phase) => {
    try {
      await erpApi.updateProject(id, { phase });
      if (selected === id) await openProject(id);
      load();
    } catch (e) { setError(e.message); }
  };

  const handleDragStart = (e, projectId) => {
    if (!canAuction) return;
    dragBlockClickRef.current = true;
    e.dataTransfer.setData('text/project-id', projectId);
    e.dataTransfer.effectAllowed = 'move';
    setDragProjectId(projectId);
  };

  const handleDragEnd = () => {
    setDragProjectId(null);
    setDropPhase(null);
    setTimeout(() => { dragBlockClickRef.current = false; }, 0);
  };

  const handleColDragOver = (e, phase) => {
    if (!canAuction) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropPhase(phase);
  };

  const handleColDragLeave = (e, phase) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDropPhase((prev) => (prev === phase ? null : prev));
  };

  const handleColDrop = async (e, phase) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('text/project-id');
    setDragProjectId(null);
    setDropPhase(null);
    if (!projectId || !canAuction) return;
    const project = projects.find((p) => p.id === projectId);
    if (!project || isSameKanbanColumn(project, phase)) return;
    await updatePhase(projectId, phase);
  };

  const openProjectFromCard = (id) => {
    if (dragBlockClickRef.current) return;
    openProject(id);
  };

  const closeIssueMode = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('issue');
    setSearchParams(next, { replace: true });
  };

  const acceptBid = async (bidId) => {
    if (!detail?.id) return;
    try {
      await erpApi.acceptBid(detail.id, bidId);
      openProject(detail.id);
      load();
    } catch (e) { setError(e.message); }
  };

  const closeAuction = async () => {
    if (!detail?.id) return;
    try {
      await erpApi.closeAuction(detail.id);
      openProject(detail.id);
      load();
    } catch (e) { setError(e.message); }
  };

  const downloadAttachment = async (attachmentId) => {
    if (!detail?.id) return;
    try {
      const blob = await erpApi.downloadProjectAttachment(detail.id, attachmentId);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) { setError(e.message); }
  };

  const refreshProject = async () => {
    if (!selected) return;
    await openProject(selected);
    load();
  };

  const reassignProject = async (assigneeId) => {
    if (!detail) return;
    setReassigning(true);
    try {
      await erpApi.reassignProject(detail.id, assigneeId);
      await refreshProject();
    } catch (e) {
      setError(e.message);
    } finally {
      setReassigning(false);
    }
  };

  return (
    <div>
      <Reveal>
        <h1 className="app-page-title">ERP — проекты</h1>
        <p className="app-page-desc">Монтаж СЭС: проект → закупка → монтаж → пусконаладка.{canAuction ? ' Перетащите карточку на другой этап.' : ''}</p>
      </Reveal>

      <div className="app-toolbar">
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{projects.length} проектов</span>
        {canAuction && (
          <button type="button" className="btn btn--primary" onClick={() => setShowCreate(true)}>+ Новый проект</button>
        )}
      </div>

      {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}

      {canApproveMaterials && projects.some((p) => p.materialsApprovalStatus === 'PENDING_DIRECTOR') && (
        <div className="app-materials-queue-banner card">
          <strong>На согласовании комплекта:</strong>{' '}
          {projects
            .filter((p) => p.materialsApprovalStatus === 'PENDING_DIRECTOR')
            .map((p) => (
              <button
                key={p.id}
                type="button"
                className="btn btn--outline-dark app-materials-queue-banner__item"
                onClick={() => openProject(p.id)}
              >
                {p.projectNumber || p.title}
              </button>
            ))}
        </div>
      )}

      <div className="app-kanban">
        {KANBAN_PHASES.map((phase) => {
          const colProjects = projectsInPhase(projects, phase);
          return (
            <div
              key={phase}
              className={`app-kanban__col${dropPhase === phase ? ' app-kanban__col--drop-target' : ''}`}
              onDragOver={(e) => handleColDragOver(e, phase)}
              onDragLeave={(e) => handleColDragLeave(e, phase)}
              onDrop={(e) => handleColDrop(e, phase)}
            >
              <div className="app-kanban__col-title">
                {PROJECT_PHASE[phase]}
                <span className="app-kanban__count">{colProjects.length}</span>
              </div>
              {colProjects.map((p) => (
                <div
                  key={p.id}
                  className={`app-kanban__card${dragProjectId === p.id ? ' app-kanban__card--dragging' : ''}${canAuction ? ' app-kanban__card--draggable' : ''}`}
                  draggable={canAuction}
                  onDragStart={(e) => handleDragStart(e, p.id)}
                  onDragEnd={handleDragEnd}
                  style={{ cursor: canAuction ? 'grab' : 'pointer' }}
                  onClick={() => openProjectFromCard(p.id)}
                >
                  <h4>{p.projectNumber && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 6 }}>{p.projectNumber}</span>}{p.title}</h4>
                  {p.materialsApprovalStatus === 'PENDING_DIRECTOR' && (
                    <span className="app-kanban__approval-badge">Согласование комплекта</span>
                  )}
                  {p.materialsApprovalStatus === 'RETURNED' && (
                    <span className="app-kanban__approval-badge app-kanban__approval-badge--returned">Комплект возвращён</span>
                  )}
                  {p.capacityKw && <p>{formatNum(p.capacityKw)} кВт</p>}
                  {p.city && <div className="app-kanban__card-meta">{p.city}{p.address ? `, ${p.address}` : ''}</div>}
                  {p.client && <div className="app-kanban__card-meta">{p.client.fullName || p.client.company}</div>}
                  {p._count?.bids > 0 && getAuctionState(p) === 'open' && (
                    <div className="app-kanban__card-meta">Ставок: {p._count.bids}</div>
                  )}
                  <ProjectKanbanControls
                    project={p}
                    canAuction={canAuction}
                    onLaunch={setAuctionProject}
                    onPhaseChange={updatePhase}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {projects.some((p) => p.phase === 'CANCELLED') && (
        <div className="card app-section-card" style={{ marginTop: 16 }}>
          <h3 className="app-section-card__title">Отменённые</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {projects.filter((p) => p.phase === 'CANCELLED').map((p) => (
              <button key={p.id} type="button" className="btn btn--outline-dark" onClick={() => openProject(p.id)}>
                {p.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && detail && (
        <div className="app-detail-panel" id="project-detail">
          <div className="card app-section-card">
            <div className="app-toolbar app-project-detail-head">
              <div className="app-project-detail-head__main">
                {detail.projectNumber && (
                  <p className="app-project-detail-head__num">{detail.projectNumber}</p>
                )}
                <h2 className="app-section-card__title app-project-detail-head__title">{detail.title}</h2>
              </div>
              <div className="app-toolbar__actions" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {canEditMaterials && !detailEditing && (
                  <button type="button" className="btn btn--primary" onClick={() => setDetailEditing(true)}>
                    Редактировать
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--outline-dark"
                  onClick={() => { setSelected(null); setDetail(null); setDetailEditing(false); }}
                >
                  Закрыть
                </button>
              </div>
            </div>

            {canAuction && (
              <div className="app-phase-pipeline">
                {PHASES.filter((ph) => ph !== 'CANCELLED' && ph !== 'BIDDING').map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    className={`app-phase-step${detail.phase === ph ? ' app-phase-step--active' : ''}${PHASES.indexOf(ph) < PHASES.indexOf(detail.phase) ? ' app-phase-step--done' : ''}`}
                    onClick={() => updatePhase(detail.id, ph)}
                  >
                    {PROJECT_PHASE[ph]}
                  </button>
                ))}
              </div>
            )}

            {canAuction && (
              <ProjectAuctionPanel
                project={detail}
                canManage={canAuction}
                onAcceptBid={acceptBid}
                onCloseAuction={closeAuction}
                onDownloadAttachment={downloadAttachment}
              />
            )}

            <ProjectDetailEditor
              project={detail}
              canEdit={canEditMaterials}
              editing={detailEditing}
              onEditingChange={setDetailEditing}
              onSaved={refreshProject}
              onError={setError}
              isAdmin={isAdmin}
              managers={managers}
              onReassign={reassignProject}
              reassigning={reassigning}
            />
          </div>

          <ProjectMaterialsPanel
            project={detail}
            products={products}
            canEdit={canEditMaterials}
            canIssue={canIssue}
            isDirector={canApproveMaterials}
            issueMode={issueMode}
            onCloseIssueMode={closeIssueMode}
            onRefresh={() => openProject(detail.id)}
            onError={setError}
            user={user}
          />
        </div>
      )}

      {showCreate && <CreateProjectForm onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
      {auctionProject && (
        <AuctionPublishModal
          projectId={auctionProject.id}
          onClose={() => setAuctionProject(null)}
          onPublished={() => {
            setAuctionProject(null);
            load();
            if (selected === auctionProject.id) openProject(auctionProject.id);
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function MaterialsApprovalBanner({ project, isDirector, onApprove, onReturn, onError }) {
  const status = project.materialsApprovalStatus;
  const [returnNote, setReturnNote] = useState(project.materialsApprovalNote || '');
  const [busy, setBusy] = useState(false);

  if (!status || status === 'NONE') return null;

  const handleApprove = async () => {
    setBusy(true);
    try {
      await onApprove();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleReturn = async () => {
    if (!returnNote.trim()) return onError('Укажите комментарий для менеджера');
    setBusy(true);
    try {
      await onReturn(returnNote.trim());
      setReturnNote('');
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`app-materials-approval app-materials-approval--${status.toLowerCase()}`}>
      <div>
        <strong>{MATERIALS_APPROVAL_STATUS[status] || status}</strong>
        {status === 'PENDING_DIRECTOR' && !isDirector && (
          <p>Проект направлен директору на согласование — скидка превышает допустимую.</p>
        )}
        {status === 'PENDING_DIRECTOR' && isDirector && (
          <p>Проверьте комплект, при необходимости измените позиции и согласуйте или верните менеджеру.</p>
        )}
        {status === 'RETURNED' && project.materialsApprovalNote && (
          <p><strong>Комментарий директора:</strong> {project.materialsApprovalNote}</p>
        )}
        {status === 'APPROVED' && project.materialsApprovedAt && (
          <p>Согласовано {new Date(project.materialsApprovedAt).toLocaleString('ru-RU')}</p>
        )}
      </div>
      {isDirector && status === 'PENDING_DIRECTOR' && (
        <div className="app-materials-approval__actions">
          <button type="button" className="btn btn--primary" disabled={busy} onClick={handleApprove}>
            Согласовать
          </button>
          <textarea
            className="input"
            rows={2}
            placeholder="Комментарий менеджеру при возврате…"
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
          />
          <button type="button" className="btn btn--outline-dark" disabled={busy} onClick={handleReturn}>
            Вернуть менеджеру
          </button>
        </div>
      )}
    </div>
  );
}

function MaterialsDiscountConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="app-modal-backdrop" onClick={onCancel}>
      <div className="app-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="app-section-card__title">Скидка превышает норму</h3>
        <p style={{ margin: '12px 0 0', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>{message}</p>
        <div className="app-modal__actions">
          <button type="button" className="btn btn--outline-dark" onClick={onCancel}>Нет, отменить</button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>Да, направить директору</button>
        </div>
      </div>
    </div>
  );
}

function buildMaterialsDraft(project) {
  return {
    kitGlobalDiscountPct: String(project.kitGlobalDiscountPct ?? 0),
    discountMode: (project.kitGlobalDiscountPct ?? 0) > 0 ? 'global' : 'line',
    rows: (project.materials || []).map((m) => ({
      id: m.id,
      productId: m.productId,
      product: m.product,
      quantityPlanned: String(m.quantityPlanned),
      unitPrice: String(m.effectiveUnitPrice ?? m.unitPrice ?? m.product?.price ?? 0),
      purchasePrice: String(m.effectivePurchasePrice ?? m.purchasePrice ?? m.product?.purchasePrice ?? 0),
      discountPct: String(m.discountPct ?? 0),
      quantityIssued: m.quantityIssued ?? 0,
      isNew: false,
    })),
    deletedIds: [],
    newCounter: 0,
  };
}

function draftRowsAsMaterials(rows, products) {
  return rows.map((r) => {
    const product = products.find((p) => p.id === r.productId) || r.product;
    return {
      product,
      productId: r.productId,
      quantityPlanned: Number(r.quantityPlanned) || 0,
      unitPrice: Number(r.unitPrice) || 0,
      purchasePrice: Number(r.purchasePrice) || 0,
      discountPct: Number(r.discountPct) || 0,
    };
  });
}

function WarehouseIssuePanel({ project, onIssued, onCancel, onError }) {
  const issuable = (project.materials || []).filter(
    (m) => (m.quantityPlanned ?? 0) > (m.quantityIssued ?? 0),
  );
  const [lines, setLines] = useState(() => issuable.map((m) => ({
    productId: m.productId,
    selected: true,
    quantity: m.quantityPlanned - m.quantityIssued,
    maxQty: m.quantityPlanned - m.quantityIssued,
    name: m.product?.name || '—',
    sku: m.product?.sku || '—',
    unit: m.product?.unit || 'шт',
    stock: m.product?.stock?.quantity ?? 0,
  })));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const updateLine = (productId, patch) => {
    setLines((prev) => prev.map((line) => (line.productId === productId ? { ...line, ...patch } : line)));
  };

  const submit = async () => {
    const items = lines
      .filter((line) => line.selected && Number(line.quantity) > 0)
      .map((line) => ({ productId: line.productId, quantity: Number(line.quantity) }));

    if (!items.length) {
      onError('Выберите хотя бы одну позицию для выдачи');
      return;
    }

    for (const line of lines.filter((l) => l.selected)) {
      const qty = Number(line.quantity);
      if (!qty || qty < 1) {
        onError(`Укажите количество для «${line.name}»`);
        return;
      }
      if (qty > line.maxQty) {
        onError(`«${line.name}»: не больше ${line.maxQty} шт. по плану`);
        return;
      }
      if (qty > line.stock) {
        onError(`«${line.name}»: на складе только ${line.stock} шт.`);
        return;
      }
    }

    setSaving(true);
    try {
      const act = await erpApi.createTransferAct(project.id, { items, note: note.trim() || undefined });
      onIssued(act);
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!issuable.length) {
    return (
      <div className="app-materials-issue-panel">
        <p style={{ color: 'var(--text-muted)' }}>По комплекту проекта всё уже выдано со склада.</p>
        <button type="button" className="btn btn--outline-dark" onClick={onCancel}>Закрыть</button>
      </div>
    );
  }

  return (
    <div className="app-materials-issue-panel app-materials-approval app-materials-approval--pending_director">
      <div>
        <strong>Выдача материалов — акт приём-передачи</strong>
        <p>Отметьте позиции и количество. После выдачи менеджер проекта должен принять акт.</p>
      </div>
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>Товар</th>
              <th>SKU</th>
              <th>На складе</th>
              <th>К выдаче</th>
              <th>Макс.</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.productId}>
                <td>
                  <input
                    type="checkbox"
                    checked={line.selected}
                    onChange={(e) => updateLine(line.productId, { selected: e.target.checked })}
                  />
                </td>
                <td>{line.name}</td>
                <td>{line.sku}</td>
                <td>{formatNum(line.stock)} {line.unit}</td>
                <td>
                  <input
                    className="input input--sm"
                    type="number"
                    min="1"
                    max={Math.min(line.maxQty, line.stock)}
                    style={{ width: 88 }}
                    disabled={!line.selected}
                    value={line.quantity}
                    onChange={(e) => updateLine(line.productId, { quantity: e.target.value })}
                  />
                </td>
                <td>{formatNum(line.maxQty)} {line.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="app-field" style={{ marginTop: 12 }}>
        <span className="app-field__label">Комментарий к акту</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Необязательно" />
      </label>
      <div className="app-materials-approval__actions">
        <button type="button" className="btn btn--outline-dark" disabled={saving} onClick={onCancel}>Отмена</button>
        <button type="button" className="btn btn--primary" disabled={saving} onClick={submit}>
          {saving ? 'Оформление…' : 'Выдать и создать акт'}
        </button>
      </div>
    </div>
  );
}

function TransferActBanner({ act, canAccept, onAccept, onError }) {
  const [busy, setBusy] = useState(false);

  const handleAccept = async () => {
    setBusy(true);
    try {
      await onAccept(act.id);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`app-materials-approval app-materials-approval--${act.status === 'PENDING_MANAGER' ? 'pending_director' : 'approved'}`}>
      <div>
        <strong>Акт {act.actNumber}</strong>
        <p>
          {act.status === 'PENDING_MANAGER'
            ? `Ожидает приёмки менеджером · передал ${act.issuedBy?.fullName || 'завсклад'} · ${new Date(act.issuedAt).toLocaleString('ru-RU')}`
            : `Принят ${act.acceptedBy?.fullName || 'менеджером'} · ${act.acceptedAt ? new Date(act.acceptedAt).toLocaleString('ru-RU') : ''}`}
        </p>
        <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {act.items?.map((item) => (
            <li key={item.id}>
              {item.product?.name}: {formatNum(item.quantity)} {item.product?.unit || 'шт.'}
            </li>
          ))}
        </ul>
      </div>
      {canAccept && act.status === 'PENDING_MANAGER' && (
        <div className="app-materials-approval__actions">
          <button type="button" className="btn btn--primary" disabled={busy} onClick={handleAccept}>
            Принять акт
          </button>
        </div>
      )}
      {act.status === 'ACCEPTED' && (
        <div className="app-materials-approval__actions">
          <Link to="/app/warehouse?tab=accepted" className="btn btn--outline-dark">
            На складе →
          </Link>
        </div>
      )}
    </div>
  );
}

function ProjectMaterialsPanel({
  project, products, canEdit, canIssue, isDirector, issueMode, onCloseIssueMode, onRefresh, onError, user,
}) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(null);
  const [addProductId, setAddProductId] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmSave, setConfirmSave] = useState(null);
  const [approvalMsg, setApprovalMsg] = useState('');
  const [issueMsg, setIssueMsg] = useState('');

  const isAssignee = user?.id === project.assigneeId;
  const canAcceptActs = isAssignee;
  const projectActs = (project.transferActs || []).slice().sort(
    (a, b) => new Date(b.issuedAt) - new Date(a.issuedAt),
  );
  const pendingActs = projectActs.filter((a) => a.status === 'PENDING_MANAGER');
  const hasWriteOffPending = (project.materials || []).some(
    (m) => (m.quantityAccepted ?? 0) > (m.quantityWrittenOff ?? 0),
  );
  const canWriteOff = isAssignee
    && ['COMPLETED', 'COMMISSIONING'].includes(project.phase)
    && hasWriteOffPending;

  const canEditRows = canEdit && (isDirector || project.materialsApprovalStatus !== 'PENDING_DIRECTOR');
  const globalDisc = Number(project.kitGlobalDiscountPct ?? 0);
  const useGlobal = globalDisc > 0;
  const displayMaterials = project.materials || [];
  const grouped = groupMaterials(displayMaterials);
  const kitTotalValue = project.kitTotal ?? kitTotal(displayMaterials, globalDisc);
  const kitSubtotalValue = project.kitSubtotal ?? kitSubtotal(displayMaterials);

  const startEdit = () => {
    setDraft(buildMaterialsDraft(project));
    setEditMode(true);
    setAddProductId('');
    setApprovalMsg('');
  };

  const cancelEdit = () => {
    setEditMode(false);
    setDraft(null);
    setAddProductId('');
    setConfirmSave(null);
  };

  const updateDraftRow = (rowId, patch) => {
    setDraft((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => {
        if (r.id !== rowId) return r;
        const next = { ...r, ...patch };
        if (patch.productId) {
          const product = products.find((p) => p.id === patch.productId);
          if (product) {
            next.product = product;
            if (patch.productId !== r.productId) {
              next.unitPrice = String(product.price ?? 0);
              next.purchasePrice = String(product.purchasePrice ?? 0);
            }
          }
        }
        return next;
      }),
    }));
  };

  const removeDraftRow = (row) => {
    if (row.quantityIssued > 0) return;
    setDraft((prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => r.id !== row.id),
      deletedIds: row.isNew ? prev.deletedIds : [...prev.deletedIds, row.id],
    }));
  };

  const addDraftRow = () => {
    if (!addProductId || !draft) return;
    const product = products.find((p) => p.id === addProductId);
    if (!product) return;
    if (draft.rows.some((r) => r.productId === addProductId)) {
      onError('Этот товар уже в комплекте');
      return;
    }
    setDraft((prev) => ({
      ...prev,
      newCounter: prev.newCounter + 1,
      rows: [...prev.rows, {
        id: `new-${prev.newCounter + 1}`,
        productId: addProductId,
        product,
        quantityPlanned: '1',
        unitPrice: String(product.price ?? 0),
        purchasePrice: String(product.purchasePrice ?? 0),
        discountPct: '0',
        quantityIssued: 0,
        isNew: true,
      }],
    }));
    setAddProductId('');
  };

  const draftGlobalDisc = draft?.discountMode === 'global' ? Number(draft.kitGlobalDiscountPct) || 0 : 0;
  const draftMaterials = draft ? draftRowsAsMaterials(draft.rows, products) : [];
  const draftGrouped = draft ? groupMaterials(draft.rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    product: products.find((p) => p.id === r.productId) || r.product,
    quantityPlanned: Number(r.quantityPlanned) || 0,
    unitPrice: Number(r.unitPrice) || 0,
    purchasePrice: Number(r.purchasePrice) || 0,
    discountPct: Number(r.discountPct) || 0,
    quantityIssued: r.quantityIssued,
    isNew: r.isNew,
  }))) : [];
  const draftKitSubtotal = draft ? kitSubtotal(draftMaterials) : 0;
  const draftKitTotal = draft ? kitTotal(draftMaterials, draftGlobalDisc) : 0;

  const usedProductIds = new Set((draft?.rows || displayMaterials).map((m) => m.productId));
  const availableProducts = products.filter((p) => !usedProductIds.has(p.id));

  const buildSavePayload = () => {
    const globalPct = draft.discountMode === 'global' ? Number(draft.kitGlobalDiscountPct) || 0 : 0;
    return {
      kitGlobalDiscountPct: globalPct,
      materials: draft.rows.map((r) => ({
        id: r.isNew ? undefined : r.id,
        productId: r.productId,
        quantityPlanned: Number(r.quantityPlanned),
        unitPrice: Number(r.unitPrice),
        purchasePrice: Number(r.purchasePrice),
        discountPct: globalPct > 0 ? 0 : Number(r.discountPct),
      })),
      deletedIds: draft.deletedIds,
    };
  };

  const getOverDiscountMessage = () => {
    if (draftGlobalDisc > MAX_GLOBAL_KIT_DISCOUNT) {
      return `Общая скидка ${draftGlobalDisc}% превышает допустимую (${MAX_GLOBAL_KIT_DISCOUNT}%). Направить проект директору на согласование?`;
    }
    const badLines = draftMaterials.filter((m) => (m.discountPct ?? 0) > maxDiscountForProduct(m.product));
    if (badLines.length) {
      return 'Скидка по одной или нескольким позициям превышает допустимую. Направить проект директору на согласование?';
    }
    return '';
  };

  const performSave = async () => {
    setSaving(true);
    try {
      const result = await erpApi.saveMaterialsBulk(project.id, buildSavePayload());
      if (result?.approval?.message) setApprovalMsg(result.approval.message);
      else setApprovalMsg('');
      setEditMode(false);
      setDraft(null);
      setConfirmSave(null);
      onRefresh();
    } catch (e) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!draft?.rows.length) return onError('Добавьте хотя бы одну позицию в комплект');
    for (const r of draft.rows) {
      const qty = Number(r.quantityPlanned);
      if (!qty || qty < 1) return onError('Укажите количество больше 0');
      if (qty < r.quantityIssued) return onError(`План не может быть меньше выданного (${r.quantityIssued} шт.)`);
    }
    const needsApproval = kitNeedsApproval(draftMaterials, draftGlobalDisc);
    if (needsApproval && !isDirector) {
      setConfirmSave(getOverDiscountMessage());
      return;
    }
    performSave();
  };

  const approveMaterials = async () => {
    await erpApi.approveMaterials(project.id);
    setApprovalMsg('');
    onRefresh();
  };

  const returnMaterials = async (note) => {
    await erpApi.returnMaterials(project.id, note);
    setApprovalMsg('');
    onRefresh();
  };

  const acceptTransferAct = async (actId) => {
    await erpApi.acceptTransferAct(actId);
    setIssueMsg('Акт принят. Материалы учтены на вашем остатке — см. Склад → Принятые акты.');
    onRefresh();
  };

  const writeOffMaterials = async () => {
    try {
      const result = await erpApi.writeOffMaterials(project.id);
      setIssueMsg(result.message || 'Запрос на списание направлен директору на согласование.');
      onRefresh();
    } catch (err) {
      onError(err.message);
    }
  };

  const handleIssueComplete = (act) => {
    setIssueMsg(`Создан акт ${act.actNumber}. Менеджер проекта должен принять материалы.`);
    onCloseIssueMode?.();
    onRefresh();
  };

  const renderRow = (m, rowMeta, isEdit) => {
    const rowId = rowMeta?.id ?? m.id;
    const draftRow = isEdit ? draft.rows.find((r) => r.id === rowId) : null;
    if (isEdit && !draftRow) return null;
    const productRef = isEdit && draftRow
      ? products.find((p) => p.id === draftRow.productId) || draftRow.product
      : m.product;
    const qtyIssued = isEdit ? (draftRow?.quantityIssued ?? 0) : (m.quantityIssued ?? 0);
    const qtyAccepted = isEdit ? (draftRow?.quantityAccepted ?? 0) : (m.quantityAccepted ?? 0);
    const qtyWrittenOff = isEdit ? (draftRow?.quantityWrittenOff ?? 0) : (m.quantityWrittenOff ?? 0);
    const qtyPlanned = isEdit ? Number(draftRow?.quantityPlanned) : (m.quantityPlanned ?? 0);
    const unitPrice = isEdit ? Number(draftRow?.unitPrice) : effectiveUnitPrice(m);
    const purchasePrice = isEdit ? Number(draftRow?.purchasePrice) : effectivePurchasePrice(m);
    const lineDisc = isEdit ? Number(draftRow?.discountPct) : (m.discountPct ?? 0);
    const globalActive = isEdit ? draft.discountMode === 'global' : useGlobal;
    const maxDisc = maxDiscountForProduct(productRef);
    const rowMaterial = {
      ...m,
      product: productRef,
      quantityPlanned: qtyPlanned,
      unitPrice,
      purchasePrice,
      discountPct: globalActive ? 0 : lineDisc,
    };
    const rowTotalVal = globalActive
      ? lineSubtotal(rowMaterial)
      : (m.lineTotal ?? lineTotal(rowMaterial));
    const overDiscount = !globalActive && lineDisc > maxDisc;

    return (
      <tr key={rowId} className={overDiscount ? 'app-materials-row--warn' : undefined}>
        <td>
          {isEdit && qtyIssued === 0 ? (
            <select
              className="input input--sm"
              value={draftRow.productId}
              onChange={(e) => updateDraftRow(rowId, { productId: e.target.value })}
            >
              {[productRef, ...availableProducts].filter(Boolean).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          ) : productRef?.name}
        </td>
        <td>{productRef?.sku}</td>
        <td>
          {isEdit ? (
            <input
              className="input input--sm"
              type="number"
              min="0"
              step="1"
              style={{ width: 88 }}
              value={draftRow.purchasePrice}
              onChange={(e) => updateDraftRow(rowId, { purchasePrice: e.target.value })}
            />
          ) : formatMoney(purchasePrice)}
        </td>
        <td>
          {isEdit ? (
            <input
              className="input input--sm"
              type="number"
              min="0"
              step="1"
              style={{ width: 88 }}
              value={draftRow.unitPrice}
              onChange={(e) => updateDraftRow(rowId, { unitPrice: e.target.value })}
            />
          ) : formatMoney(unitPrice)}
        </td>
        <td>{globalActive ? '—' : `${formatNum(maxDisc)}%`}</td>
        <td>
          {isEdit && !globalActive ? (
            <input
              className={`input input--sm${overDiscount ? ' app-field--error' : ''}`}
              type="number"
              min="0"
              max="100"
              step="0.1"
              style={{ width: 72 }}
              value={draftRow.discountPct}
              onChange={(e) => updateDraftRow(rowId, { discountPct: e.target.value })}
            />
          ) : globalActive ? '—' : `${formatNum(lineDisc)}%`}
        </td>
        <td><strong>{formatMoney(rowTotalVal)}</strong></td>
        <td style={{ color: (productRef?.stock?.quantity ?? 0) < qtyPlanned ? '#b91c1c' : undefined }}>
          {formatNum(productRef?.stock?.quantity ?? 0)}
        </td>
        <td>
          {isEdit ? (
            <input
              className="input input--sm"
              type="number"
              min={qtyIssued || 1}
              style={{ width: 72 }}
              value={draftRow.quantityPlanned}
              onChange={(e) => updateDraftRow(rowId, { quantityPlanned: e.target.value })}
            />
          ) : formatNum(qtyPlanned)}
        </td>
        <td><strong>{formatNum(qtyIssued)}</strong></td>
        {!isEdit && (
          <>
            <td>{formatNum(qtyAccepted)}</td>
            <td>{formatNum(qtyWrittenOff)}</td>
          </>
        )}
        {isEdit && (
          <td>
            <button
              type="button"
              className="btn btn--outline-dark app-table-btn"
              disabled={qtyIssued > 0}
              title={qtyIssued > 0 ? 'Уже выдано со склада' : 'Удалить'}
              onClick={() => removeDraftRow(draftRow)}
            >
              ✕
            </button>
          </td>
        )}
      </tr>
    );
  };

  const renderGroupBody = (groups, isEdit) => groups.flatMap((g) => [
    <tr key={`group-${g.key}`} className="app-materials-group-row">
      <td colSpan={isEdit ? 11 : 12}><strong>{g.label}</strong></td>
    </tr>,
    ...g.items.map((m) => renderRow(m, { id: m.id }, isEdit)),
  ]);

  const colSpanEmpty = editMode ? 11 : 12;

  return (
    <div className="card app-section-card">
      <div className="app-toolbar app-materials-toolbar">
        <h3 className="app-section-card__title" style={{ margin: 0 }}>Комплект материалов</h3>
        <div className="app-materials-toolbar__meta">
          {!editMode && kitSubtotalValue > 0 && useGlobal && (
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Подитог: {formatMoney(kitSubtotalValue)} · Общая скидка: {formatNum(globalDisc)}%
            </span>
          )}
          {!editMode && kitTotalValue > 0 && (
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              Итого: {formatMoney(kitTotalValue)}
            </span>
          )}
          {editMode && (
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              Итого: {formatMoney(draftKitTotal)}
            </span>
          )}
          {canEditRows && !editMode && (
            <button type="button" className="btn btn--primary" onClick={startEdit}>Редактировать</button>
          )}
          {editMode && (
            <>
              <button type="button" className="btn btn--outline-dark" disabled={saving} onClick={cancelEdit}>Отменить</button>
              <button type="button" className="btn btn--primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </>
          )}
        </div>
      </div>

      <MaterialsApprovalBanner
        project={project}
        isDirector={isDirector}
        onApprove={approveMaterials}
        onReturn={returnMaterials}
        onError={onError}
      />

      {approvalMsg && <p className="app-materials-approval-msg">{approvalMsg}</p>}
      {issueMsg && <p className="app-materials-approval-msg">{issueMsg}</p>}

      {projectActs.map((act) => (
        <TransferActBanner
          key={act.id}
          act={act}
          canAccept={canAcceptActs}
          onAccept={acceptTransferAct}
          onError={onError}
        />
      ))}

      {canWriteOff && (
        <div className="app-materials-approval app-materials-approval--approved" style={{ marginBottom: 16 }}>
          <div>
            <strong>Списание материалов</strong>
            <p>Проект на финальном этапе. Запросите списание принятых материалов — потребуется согласование директора и бухгалтера.</p>
          </div>
          <div className="app-materials-approval__actions">
            <button type="button" className="btn btn--primary" onClick={writeOffMaterials}>
              Запросить списание
            </button>
          </div>
        </div>
      )}

      {issueMode && canIssue && !editMode && (
        <WarehouseIssuePanel
          project={project}
          onIssued={handleIssueComplete}
          onCancel={onCloseIssueMode}
          onError={onError}
        />
      )}

      {editMode && draft && (
        <div className="app-materials-discount-mode">
          <label className="app-materials-discount-mode__option">
            <input
              type="radio"
              name="discountMode"
              checked={draft.discountMode === 'line'}
              onChange={() => setDraft((prev) => ({ ...prev, discountMode: 'line', kitGlobalDiscountPct: '0' }))}
            />
            Скидка по позициям
          </label>
          <label className="app-materials-discount-mode__option">
            <input
              type="radio"
              name="discountMode"
              checked={draft.discountMode === 'global'}
              onChange={() => setDraft((prev) => ({ ...prev, discountMode: 'global' }))}
            />
            Общая скидка на комплект
          </label>
          {draft.discountMode === 'global' && (
            <div className="app-materials-global-discount">
              <span>Общая скидка, %</span>
              <input
                className={`input input--sm${draftGlobalDisc > MAX_GLOBAL_KIT_DISCOUNT ? ' app-field--error' : ''}`}
                type="number"
                min="0"
                max="100"
                step="0.1"
                style={{ width: 88 }}
                value={draft.kitGlobalDiscountPct}
                onChange={(e) => setDraft((prev) => ({ ...prev, kitGlobalDiscountPct: e.target.value }))}
              />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                макс. {MAX_GLOBAL_KIT_DISCOUNT}% без согласования
              </span>
            </div>
          )}
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Товар</th>
              <th>SKU</th>
              <th>Закуп. цена</th>
              <th>Цена продажи</th>
              <th>Макс. скидка</th>
              <th>Скидка %</th>
              <th>Сумма</th>
              <th>Остаток</th>
              <th>План</th>
              <th>Выдано</th>
              {!editMode && <th>Принято</th>}
              {!editMode && <th>Списано</th>}
              {editMode && <th></th>}
            </tr>
          </thead>
          <tbody>
            {editMode && draftGrouped.length > 0 && renderGroupBody(draftGrouped, true)}
            {!editMode && grouped.length > 0 && renderGroupBody(grouped, false)}
            {!(editMode ? draft?.rows.length : displayMaterials.length) && (
              <tr>
                <td colSpan={colSpanEmpty} style={{ color: 'var(--text-muted)' }}>
                  Стандартный комплект не загружен — добавьте позиции в режиме редактирования
                </td>
              </tr>
            )}
          </tbody>
          {(editMode ? draftKitSubtotal : kitSubtotalValue) > 0 && (
            <tfoot>
              <tr className="app-materials-total-row">
                  <td colSpan={6} style={{ textAlign: 'right' }}><strong>Подитог</strong></td>
                  <td colSpan={editMode ? 5 : 6}><strong>{formatMoney(editMode ? draftKitSubtotal : kitSubtotalValue)}</strong></td>
              </tr>
              {(editMode ? draftGlobalDisc : globalDisc) > 0 && (
                <tr className="app-materials-total-row">
                  <td colSpan={6} style={{ textAlign: 'right' }}>
                    <strong>Общая скидка {(editMode ? draftGlobalDisc : globalDisc)}%</strong>
                  </td>
                  <td colSpan={editMode ? 5 : 6}>
                    <strong>{formatMoney(editMode ? draftKitTotal : kitTotalValue)}</strong>
                  </td>
                </tr>
              )}
              {!((editMode ? draftGlobalDisc : globalDisc) > 0) && (
                <tr className="app-materials-total-row">
                  <td colSpan={6} style={{ textAlign: 'right' }}><strong>Итого</strong></td>
                  <td colSpan={editMode ? 5 : 6}><strong>{formatMoney(editMode ? draftKitTotal : kitTotalValue)}</strong></td>
                </tr>
              )}
            </tfoot>
          )}
        </table>
      </div>

      {editMode && (
        <div className="app-form-grid app-materials-add-row" style={{ marginTop: 16 }}>
          <select
            className="input"
            value={addProductId}
            onChange={(e) => setAddProductId(e.target.value)}
          >
            <option value="">+ Добавить позицию</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
            ))}
          </select>
          <button type="button" className="btn btn--primary" disabled={!addProductId} onClick={addDraftRow}>
            Добавить
          </button>
        </div>
      )}

      {canIssue && !editMode && !issueMode && (
        <p style={{ marginTop: 12, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Выдачу оформляйте через вкладку «Склад» → «Расход» → выбор проекта.
        </p>
      )}
      {!canIssue && canEdit && !editMode && (
        <p style={{ marginTop: 12, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Выдачу материалов выполняет завсклад. План комплекта можно редактировать здесь.
        </p>
      )}

      {confirmSave && (
        <MaterialsDiscountConfirmModal
          message={confirmSave}
          onCancel={() => setConfirmSave(null)}
          onConfirm={performSave}
        />
      )}
    </div>
  );
}

function AuctionPublishModal({ projectId, onClose, onPublished, onError }) {
  const [brief, setBrief] = useState(null);
  const [text, setText] = useState('');
  const [days, setDays] = useState(7);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    erpApi.auctionBrief(projectId)
      .then((data) => {
        setBrief(data);
        setText(data.auctionBrief || '');
      })
      .catch((e) => onError(e.message))
      .finally(() => setLoading(false));
  }, [projectId, onError]);

  const readFiles = async (fileList) => {
    const out = [];
    for (const file of fileList) {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      out.push({ originalName: file.name, mimeType: file.type, data });
    }
    return out;
  };

  const publish = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const files = await readFiles(pendingFiles);
      await erpApi.openAuction(projectId, { brief: text, days: Number(days), files });
      onPublished();
    } catch (err) { onError(err.message); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="app-modal-backdrop">
        <div className="app-modal app-modal--wide"><p>Загрузка…</p></div>
      </div>
    );
  }

  const lead = brief?.lead;
  const clientName = brief?.client?.fullName || lead?.fullName || '—';
  const phone = brief?.client?.phone || lead?.phone || '—';

  return (
    <div className="app-modal-backdrop" onClick={onClose}>
      <div className="app-modal app-modal--wide" onClick={(e) => e.stopPropagation()}>
        <h2>Торги — {brief?.title}</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          Данные для подрядчиков без сумм. Прикрепите замеры, фото объекта, чертежи.
        </p>

        <div className="app-detail-grid" style={{ marginBottom: 16, fontSize: '0.875rem' }}>
          <div>
            <strong>Клиент:</strong> {clientName}<br />
            <strong>Телефон:</strong> {phone}<br />
            <strong>Менеджер:</strong> {brief?.assignee?.fullName || '—'}<br />
            <strong>Мощность:</strong> {brief?.capacityKw ? `${formatNum(brief.capacityKw)} кВт` : lead?.capacityKw ? `${formatNum(lead.capacityKw)} кВт` : '—'}
          </div>
          <div>
            <strong>Город:</strong> {brief?.city || '—'}<br />
            <strong>Адрес:</strong> {brief?.address || '—'}<br />
            {lead?.systemType && <><strong>Система:</strong> {SYSTEM_TYPE[lead.systemType]}<br /></>}
            {lead?.objectType && <><strong>Объект:</strong> {OBJECT_TYPE[lead.objectType]}<br /></>}
            {brief?.startDate && <><strong>Старт:</strong> {new Date(brief.startDate).toLocaleDateString('ru-RU')}</>}
          </div>
        </div>

        {(brief?.notes || lead?.notes) && (
          <p style={{ fontSize: '0.875rem', marginBottom: 12 }}><strong>Заметки:</strong> {brief.notes || lead.notes}</p>
        )}

        {brief?.materials?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <strong style={{ fontSize: '0.875rem' }}>Комплект (без цен):</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.875rem' }}>
              {brief.materials.map((m) => (
                <li key={m.id}>{m.name} — {formatNum(m.quantityPlanned)} {m.unit || 'шт'}</li>
              ))}
            </ul>
          </div>
        )}

        <form className="app-modal__form" onSubmit={publish}>
          <div>
            <label>Описание для подрядчиков</label>
            <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Объём работ, особенности объекта, сроки…" />
          </div>
          <div>
            <label>Срок подачи ставок, дней</label>
            <input className="input" type="number" min="1" max="30" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <div>
            <label>Файлы (фото, замеры, чертежи)</label>
            <input className="input" type="file" multiple accept="image/*,.pdf,.dwg,.dxf,.doc,.docx,.xls,.xlsx" onChange={(e) => setPendingFiles(Array.from(e.target.files || []))} />
            {pendingFiles.length > 0 && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Выбрано: {pendingFiles.map((f) => f.name).join(', ')}
              </p>
            )}
            {brief?.attachments?.length > 0 && (
              <p style={{ fontSize: '0.8125rem', marginTop: 4 }}>
                Уже прикреплено: {brief.attachments.map((a) => a.originalName).join(', ')}
              </p>
            )}
          </div>
          <div className="app-modal__actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Публикация…' : 'Опубликовать торги'}</button>
            <button type="button" className="btn btn--outline-dark" onClick={onClose}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateProjectForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', capacityKw: '', city: '', address: '', notes: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      await erpApi.createProject({
        title: form.title,
        capacityKw: form.capacityKw ? Number(form.capacityKw) : undefined,
        city: form.city || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
        startDate: new Date().toISOString(),
      });
      onSaved();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="app-modal-backdrop" onClick={onClose}>
      <div className="app-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Новый проект</h2>
        <form className="app-modal__form" onSubmit={submit}>
          <div><label>Название</label><input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label>Мощность, кВт</label><input className="input" type="number" value={form.capacityKw} onChange={(e) => setForm({ ...form, capacityKw: e.target.value })} /></div>
          <div><label>Город</label><input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><label>Адрес</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          {error && <p className="error-msg">{error}</p>}
          <div className="app-modal__actions">
            <button type="submit" className="btn btn--primary">Создать</button>
            <button type="button" className="btn btn--outline-dark" onClick={onClose}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
}
