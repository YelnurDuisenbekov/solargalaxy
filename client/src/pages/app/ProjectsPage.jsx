import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { erpApi, warehouseApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Reveal } from '../../components/motion/ScrollReveal';
import AddressMapsLink from '../../components/AddressMapsLink';
import { formatMoney, formatNum } from '../../utils/format';
import { PROJECT_PHASE, OBJECT_TYPE, SYSTEM_TYPE } from '../../utils/crmLabels';
import './app-pages.css';

const PHASES = Object.keys(PROJECT_PHASE);
const KANBAN_PHASES = PHASES.filter((p) => p !== 'CANCELLED' && p !== 'BIDDING');

function projectsInPhase(projects, phase) {
  if (phase === 'DESIGN') {
    return projects.filter((p) => p.phase === 'DESIGN' || p.phase === 'SURVEY');
  }
  if (phase === 'BIDDING') return projects.filter((p) => p.phase === 'BIDDING');
  return projects.filter((p) => p.phase === phase);
}

function isAuctionLaunched(project) {
  if (!project) return false;
  return !!(project.auctionLaunched || project.auctionOpen || project.auctionDeadline
    || project.winningBidId || (project._count?.bids ?? project.bids?.length ?? 0) > 0);
}

function AuctionButton({ project, onLaunch, className = 'btn btn--dark app-table-btn app-auction-btn' }) {
  const launched = isAuctionLaunched(project);
  return (
    <button
      type="button"
      className={className}
      disabled={launched}
      title={launched ? 'Торги по проекту уже запускались' : 'Запустить торги'}
      onClick={() => onLaunch(project)}
    >
      на торги
    </button>
  );
}

export default function ProjectsPage() {
  const { isCrm, isWarehouse } = useAuth();
  const [searchParams] = useSearchParams();
  const canIssue = isWarehouse;
  const canEditMaterials = isCrm;
  const canAuction = isCrm;
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [products, setProducts] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [issueForm, setIssueForm] = useState({ productId: '', quantity: 1 });
  const [error, setError] = useState('');
  const [auctionProject, setAuctionProject] = useState(null);

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
    const openId = searchParams.get('open');
    if (openId) openProject(openId);
  }, [searchParams, openProject]);

  useEffect(() => {
    if (detail?.id) {
      document.getElementById('project-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [detail?.id]);

  const updatePhase = async (id, phase) => {
    try {
      await erpApi.updateProject(id, { phase });
      openProject(id);
      load();
    } catch (e) { setError(e.message); }
  };

  const issueMaterial = async (e) => {
    e.preventDefault();
    try {
      await erpApi.issueMaterial(selected, { ...issueForm, quantity: Number(issueForm.quantity) });
      setIssueForm({ productId: '', quantity: 1 });
      openProject(selected);
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <Reveal>
        <h1 className="app-page-title">ERP — проекты</h1>
        <p className="app-page-desc">Монтаж СЭС: проект → закупка → монтаж → пусконаладка</p>
      </Reveal>

      <div className="app-toolbar">
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{projects.length} проектов</span>
        {canAuction && (
          <button type="button" className="btn btn--primary" onClick={() => setShowCreate(true)}>+ Новый проект</button>
        )}
      </div>

      {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="app-kanban">
        {KANBAN_PHASES.map((phase) => {
          const colProjects = projectsInPhase(projects, phase);
          return (
            <div key={phase} className="app-kanban__col">
              <div className="app-kanban__col-title">
                {PROJECT_PHASE[phase]}
                <span className="app-kanban__count">{colProjects.length}</span>
              </div>
              {colProjects.map((p) => (
                <div
                  key={p.id}
                  className="app-kanban__card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => openProject(p.id)}
                >
                  <h4>{p.projectNumber && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 6 }}>{p.projectNumber}</span>}{p.title}</h4>
                  {p.capacityKw && <p>{formatNum(p.capacityKw)} кВт</p>}
                  {p.city && <div className="app-kanban__card-meta">{p.city}{p.address ? `, ${p.address}` : ''}</div>}
                  {p.client && <div className="app-kanban__card-meta">{p.client.fullName || p.client.company}</div>}
                  {p.auctionOpen && <div className="app-kanban__card-meta" style={{ color: 'var(--primary)' }}>Торги открыты</div>}
                  {p._count?.bids > 0 && <div className="app-kanban__card-meta">Ставок: {p._count.bids}</div>}
                  {canAuction && p.phase !== 'CANCELLED' && (
                    <div className="app-kanban__actions" onClick={(e) => e.stopPropagation()}>
                      <AuctionButton project={p} onLaunch={setAuctionProject} />
                    </div>
                  )}
                  {canAuction && (
                    <div className="app-kanban__actions" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={p.phase}
                        onChange={(e) => updatePhase(p.id, e.target.value)}
                      >
                        {KANBAN_PHASES.map((ph) => (
                          <option key={ph} value={ph}>{PROJECT_PHASE[ph]}</option>
                        ))}
                        <option value="CANCELLED">{PROJECT_PHASE.CANCELLED}</option>
                      </select>
                    </div>
                  )}
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
            <div className="app-toolbar">
              <div>
                {detail.projectNumber && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 4px' }}>{detail.projectNumber}</p>
                )}
                <h2 className="app-section-card__title" style={{ margin: 0 }}>{detail.title}</h2>
              </div>
              <button type="button" className="btn btn--outline-dark" onClick={() => { setSelected(null); setDetail(null); }}>Закрыть</button>
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

            {canAuction && detail.phase !== 'CANCELLED' && (
              <div style={{ marginTop: 12 }}>
                <AuctionButton project={detail} onLaunch={setAuctionProject} />
              </div>
            )}

            {isAuctionLaunched(detail) && !detail.auctionOpen && canAuction && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 8 }}>
                Торги по проекту уже проводились и повторно не запускаются.
              </p>
            )}

            {detail.auctionOpen && canAuction && (
              <div className="card" style={{ marginTop: 12, padding: 12, background: 'var(--bg-alt)' }}>
                <strong>Торги открыты</strong>
                {detail.auctionDeadline && <span> — до {new Date(detail.auctionDeadline).toLocaleDateString('ru-RU')}</span>}
                {detail.auctionBrief && <p style={{ marginTop: 8, fontSize: '0.875rem' }}>{detail.auctionBrief}</p>}
                {detail.attachments?.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: '0.875rem' }}>
                    <strong>Файлы:</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {detail.attachments.map((a) => (
                        <li key={a.id}>
                          <button type="button" className="btn btn--ghost" style={{ padding: 0, fontSize: 'inherit' }} onClick={async () => {
                            try {
                              const blob = await erpApi.downloadProjectAttachment(detail.id, a.id);
                              const url = URL.createObjectURL(blob);
                              window.open(url, '_blank');
                            } catch (e) { setError(e.message); }
                          }}>{a.originalName}</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {detail.bids?.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: 8 }}>
                    <table className="table table--compact">
                      <thead><tr><th>Подрядчик</th><th>Цена</th><th>Статус</th></tr></thead>
                      <tbody>
                        {detail.bids.map((b) => (
                          <tr key={b.id}>
                            <td>{b.contractor?.fullName}</td>
                            <td>{formatMoney(b.price)}</td>
                            <td>{b.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button type="button" className="btn btn--dark" style={{ marginTop: 8 }} onClick={async () => {
                  try {
                    await erpApi.acceptLowestBid(detail.id);
                    openProject(detail.id);
                    load();
                  } catch (e) { setError(e.message); }
                }}>Выбрать минимальную ставку</button>
              </div>
            )}

            <div className="app-detail-grid">
              <div>
                <strong>Клиент:</strong> {detail.client?.fullName || detail.lead?.fullName || '—'}<br />
                {detail.lead?.phone && <><strong>Телефон:</strong> {detail.lead.phone}<br /></>}
                {detail.clientPhone && <><strong>Тел. проекта:</strong> +7 {detail.clientPhone.slice(1, 4)} {detail.clientPhone.slice(4, 7)} {detail.clientPhone.slice(7)}<br /></>}
                <strong>Менеджер:</strong> {detail.assignee?.fullName || '—'}<br />
                <strong>Мощность:</strong> {detail.capacityKw ? `${formatNum(detail.capacityKw)} кВт` : '—'}
              </div>
              <div>
                <strong>Адрес:</strong> {detail.city || detail.lead?.city || '—'}{detail.address ? `, ${detail.address}` : ''}<br />
                {detail.address && (
                  <AddressMapsLink city={detail.city || detail.lead?.city} address={detail.address} />
                )}
                <br />
                <strong>Старт:</strong> {detail.startDate ? new Date(detail.startDate).toLocaleDateString('ru-RU') : '—'}
                {detail.lead && (
                  <><br /><Link to="/app/crm" style={{ fontSize: '0.875rem' }}>Лид: {detail.lead.fullName}</Link></>
                )}
              </div>
            </div>
          </div>

          <ProjectMaterialsPanel
            project={detail}
            products={products}
            canEdit={canEditMaterials}
            canIssue={canIssue}
            issueForm={issueForm}
            setIssueForm={setIssueForm}
            onIssue={issueMaterial}
            onRefresh={() => openProject(detail.id)}
            onError={setError}
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

function ProjectMaterialsPanel({
  project, products, canEdit, canIssue, issueForm, setIssueForm, onIssue, onRefresh, onError,
}) {
  const [addForm, setAddForm] = useState({ productId: '', quantityPlanned: 1 });
  const [editing, setEditing] = useState({});

  const usedProductIds = new Set((project.materials || []).map((m) => m.productId));
  const availableProducts = products.filter((p) => !usedProductIds.has(p.id));

  const saveQty = async (material) => {
    const raw = editing[material.id] ?? material.quantityPlanned;
    const quantityPlanned = Number(raw);
    if (!quantityPlanned || quantityPlanned < 1) {
      onError('Укажите количество больше 0');
      return;
    }
    try {
      await erpApi.updateMaterial(project.id, material.id, { quantityPlanned });
      setEditing((prev) => { const n = { ...prev }; delete n[material.id]; return n; });
      onRefresh();
    } catch (e) { onError(e.message); }
  };

  const removeMaterial = async (material) => {
    if (!window.confirm(`Удалить «${material.product.name}» из комплекта?`)) return;
    try {
      await erpApi.deleteMaterial(project.id, material.id);
      onRefresh();
    } catch (e) { onError(e.message); }
  };

  const addMaterial = async (e) => {
    e.preventDefault();
    try {
      await erpApi.addMaterial(project.id, {
        productId: addForm.productId,
        quantityPlanned: Number(addForm.quantityPlanned),
      });
      setAddForm({ productId: '', quantityPlanned: 1 });
      onRefresh();
    } catch (err) { onError(err.message); }
  };

  const totalPlanned = (project.materials || []).reduce(
    (s, m) => s + m.quantityPlanned * (m.product?.price || 0),
    0,
  );

  return (
    <div className="card app-section-card">
      <div className="app-toolbar">
        <h3 className="app-section-card__title" style={{ margin: 0 }}>Комплект материалов</h3>
        {totalPlanned > 0 && (
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Оценка: {formatMoney(totalPlanned)}
          </span>
        )}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Товар</th>
              <th>SKU</th>
              <th>Цена</th>
              <th>Остаток</th>
              <th>План</th>
              <th>Выдано</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {project.materials?.map((m) => (
              <tr key={m.id}>
                <td>{m.product.name}</td>
                <td>{m.product.sku}</td>
                <td>{formatMoney(m.product.price)}</td>
                <td style={{ color: (m.product.stock?.quantity ?? 0) < m.quantityPlanned ? '#b91c1c' : undefined }}>
                  {formatNum(m.product.stock?.quantity ?? 0)}
                </td>
                <td>
                  {canEdit ? (
                    <input
                      className="input input--sm"
                      type="number"
                      min={m.quantityIssued || 1}
                      style={{ width: 72 }}
                      value={editing[m.id] ?? m.quantityPlanned}
                      onChange={(e) => setEditing({ ...editing, [m.id]: e.target.value })}
                      onBlur={() => saveQty(m)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveQty(m); }}
                    />
                  ) : formatNum(m.quantityPlanned)}
                </td>
                <td><strong>{formatNum(m.quantityIssued)}</strong></td>
                {canEdit && (
                  <td>
                    <button
                      type="button"
                      className="btn btn--outline-dark app-table-btn"
                      disabled={m.quantityIssued > 0}
                      title={m.quantityIssued > 0 ? 'Уже выдано со склада' : 'Удалить'}
                      onClick={() => removeMaterial(m)}
                    >
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!project.materials?.length && (
              <tr>
                <td colSpan={canEdit ? 7 : 6} style={{ color: 'var(--text-muted)' }}>
                  Стандартный комплект не загружен — добавьте позиции ниже
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <form className="app-form-grid" style={{ marginTop: 16 }} onSubmit={addMaterial}>
          <select
            className="input"
            required
            value={addForm.productId}
            onChange={(e) => setAddForm({ ...addForm, productId: e.target.value })}
          >
            <option value="">+ Добавить позицию</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
            ))}
          </select>
          <input
            className="input"
            type="number"
            min="1"
            value={addForm.quantityPlanned}
            onChange={(e) => setAddForm({ ...addForm, quantityPlanned: e.target.value })}
          />
          <button type="submit" className="btn btn--primary">Добавить</button>
        </form>
      )}

      {canIssue && (
        <form className="app-form-grid" style={{ marginTop: 16 }} onSubmit={onIssue}>
          <select className="input" required value={issueForm.productId} onChange={(e) => setIssueForm({ ...issueForm, productId: e.target.value })}>
            <option value="">Выдача со склада</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (остаток: {p.stock?.quantity ?? 0})</option>)}
          </select>
          <input className="input" type="number" min="1" value={issueForm.quantity} onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })} />
          <button type="submit" className="btn btn--primary">Выдать на объект</button>
        </form>
      )}
      {!canIssue && canEdit && (
        <p style={{ marginTop: 12, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Выдачу материалов выполняет завсклад. План комплекта можно редактировать здесь.
        </p>
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
