import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { operationsApi } from '../../api';
import { Reveal } from '../../components/motion/ScrollReveal';
import AddressMapsLink from '../../components/AddressMapsLink';
import AuctionResultsGrid from '../../components/auction/AuctionResultsGrid';
import { formatMoney, formatNum } from '../../utils/format';
import { SYSTEM_TYPE, OBJECT_TYPE, projectPhaseLabel } from '../../utils/crmLabels';
import './app-pages.css';

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function AuctionDetail({ project, bidForm, setBidForm, onSubmitBid, onOpenAttachment }) {
  const lead = project.lead;
  const capacity = project.capacityKw || lead?.capacityKw;

  return (
    <div className="app-auctions-detail card app-section-card" id="contractor-auction-detail">
      <div className="app-toolbar">
        <div>
          {project.projectNumber && (
            <p className="app-portal-detail__number">{project.projectNumber}</p>
          )}
          <h2 className="app-section-card__title" style={{ margin: 0 }}>{project.title}</h2>
        </div>
        {project.auctionDeadline && (
          <span className="badge badge--progress">
            До {new Date(project.auctionDeadline).toLocaleDateString('ru-RU')}
          </span>
        )}
      </div>

      <div className="app-detail-grid">
        <div>
          <strong>Город:</strong> {project.city || lead?.city || '—'}<br />
          <strong>Адрес:</strong> {project.address || '—'}<br />
          {project.address && (
            <>
              <AddressMapsLink city={project.city || lead?.city} address={project.address} />
              <br />
            </>
          )}
          <strong>Мощность:</strong> {capacity ? `${formatNum(capacity)} кВт` : '—'}<br />
          {lead?.systemType && <><strong>Система:</strong> {SYSTEM_TYPE[lead.systemType]}<br /></>}
          {lead?.objectType && <><strong>Объект:</strong> {OBJECT_TYPE[lead.objectType]}<br /></>}
          {project.startDate && (
            <><strong>Старт проекта:</strong> {new Date(project.startDate).toLocaleDateString('ru-RU')}<br /></>
          )}
        </div>
        <div>
          <strong>Менеджер:</strong> {project.assignee?.fullName || '—'}<br />
          {project.assignee?.phone && <><strong>Тел. менеджера:</strong> {project.assignee.phone}<br /></>}
          <strong>Этап:</strong> {projectPhaseLabel(project.phase)}<br />
          <strong>Участников:</strong> {project.bidCount ?? 0}<br />
          {project.myBid && (
            <><strong>Ваша ставка:</strong> {formatMoney(project.myBid.price)} ({project.myBid.status === 'PENDING' ? 'на рассмотрении' : project.myBid.status === 'WON' ? 'выиграла' : 'проиграла'})</>
          )}
        </div>
      </div>

      {project.auctionBrief && (
        <div className="app-portal-detail__notes">
          <strong>Описание для подрядчиков</strong>
          <p style={{ whiteSpace: 'pre-wrap' }}>{project.auctionBrief}</p>
        </div>
      )}

      {project.notes && (
        <div className="app-portal-detail__notes">
          <strong>Примечания к проекту</strong>
          <p style={{ whiteSpace: 'pre-wrap' }}>{project.notes}</p>
        </div>
      )}

      {lead?.notes && (
        <div className="app-portal-detail__notes">
          <strong>Данные заявки</strong>
          <p style={{ whiteSpace: 'pre-wrap' }}>{lead.notes}</p>
        </div>
      )}

      {project.materials?.length > 0 && (
        <div className="app-portal-detail__block">
          <h3 className="app-portal-detail__subtitle">Комплектация (ориентир)</h3>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr><th>Наименование</th><th>Артикул</th><th>Кол-во</th></tr>
              </thead>
              <tbody>
                {project.materials.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name || '—'}</td>
                    <td>{m.sku || '—'}</td>
                    <td>{m.quantityPlanned}{m.unit ? ` ${m.unit}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="app-portal-detail__block">
        <h3 className="app-portal-detail__subtitle">Документы и файлы</h3>
        {project.attachments?.length > 0 ? (
          <ul className="app-attachment-list">
            {project.attachments.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="app-attachment-list__btn"
                  onClick={() => onOpenAttachment(project.id, a.id)}
                >
                  <span className="app-attachment-list__name">{a.originalName}</span>
                  {a.size ? <span className="app-attachment-list__meta">{formatFileSize(a.size)}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Файлы не прикреплены</p>
        )}
      </div>

      <div className="app-portal-detail__block">
        <h3 className="app-portal-detail__subtitle">Ваша ставка на монтаж</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            type="number"
            min={1}
            placeholder="Цена, ₸"
            style={{ flex: 1, minWidth: 160, maxWidth: 280 }}
            value={bidForm[project.id] ?? (project.myBid?.price ? String(project.myBid.price) : '')}
            onChange={(e) => setBidForm({ ...bidForm, [project.id]: e.target.value })}
          />
          <button type="button" className="btn btn--primary" onClick={() => onSubmitBid(project.id)}>
            {project.myBid ? 'Обновить ставку' : 'Подать ставку'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContractorPage({ tab = 'auctions' }) {
  const { isContractor } = useAuth();
  const [auctions, setAuctions] = useState([]);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidForm, setBidForm] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadAuctions = useCallback(() => {
    operationsApi.auctions()
      .then((list) => {
        setAuctions(list);
        setSelected((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      })
      .catch((e) => setError(e.message));
  }, []);

  const loadResults = useCallback(() => {
    operationsApi.auctionHistory()
      .then(setResults)
      .catch((e) => setError(e.message));
  }, []);

  const loadBids = () => operationsApi.myBids().then(setBids).catch((e) => setError(e.message));

  useEffect(() => {
    if (tab === 'auctions') loadAuctions();
    else if (tab === 'results') loadResults();
    else if (isContractor) loadBids();
  }, [tab, isContractor, loadAuctions, loadResults]);

  const detail = auctions.find((p) => p.id === selected);

  const submitBid = async (projectId) => {
    setError('');
    setSuccess('');
    const price = Number(bidForm[projectId]);
    if (!price || price <= 0) return setError('Укажите цену');
    try {
      await operationsApi.submitBid({ projectId, price });
      setSuccess('Ставка принята');
      loadAuctions();
      loadBids();
    } catch (e) { setError(e.message); }
  };

  const openAttachment = async (projectId, attachmentId) => {
    try {
      const blob = await operationsApi.downloadAuctionAttachment(projectId, attachmentId);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) { setError(e.message); }
  };

  const tabBar = (
    <div className="app-tabs" style={{ marginTop: 16 }}>
      <Link to="/app/auctions" className={`app-tab${tab === 'auctions' ? ' app-tab--active' : ''}`}>Торги</Link>
      <Link to="/app/auction-results" className={`app-tab${tab === 'results' ? ' app-tab--active' : ''}`}>Итоги</Link>
      {isContractor && (
        <Link to="/app/my-bids" className={`app-tab${tab === 'bids' ? ' app-tab--active' : ''}`}>Мои ставки</Link>
      )}
    </div>
  );

  if (tab === 'results') {
    return (
      <div>
        <Reveal>
          <h1 className="app-page-title">Итоги торгов</h1>
          <p className="app-page-desc">
            История завершённых торгов: кто выиграл и по какой цене.
          </p>
          {tabBar}
        </Reveal>
        {error && <p className="error-msg">{error}</p>}
        <div style={{ marginTop: 24 }}>
          <AuctionResultsGrid items={results} />
        </div>
      </div>
    );
  }

  if (tab === 'bids') {
    if (!isContractor) {
      return (
        <div>
          <Reveal>
            <h1 className="app-page-title">Мои ставки</h1>
            {tabBar}
            <p className="app-page-desc" style={{ marginTop: 16 }}>Раздел доступен подрядчикам.</p>
          </Reveal>
        </div>
      );
    }
    return (
      <div>
        <Reveal>
          <h1 className="app-page-title">Мои ставки</h1>
          {tabBar}
        </Reveal>
        {error && <p className="error-msg">{error}</p>}
        <div className="app-activity-list" style={{ marginTop: 24 }}>
          {bids.map((b) => (
            <div key={b.id} className="card app-activity-item">
              <div className="app-activity-item__body">
                <div className="app-activity-item__title">{b.project?.title}</div>
                <p>Ставка: <strong>{formatMoney(b.price)}</strong></p>
                <div className="app-activity-item__meta">
                  Статус: {b.status === 'WON' ? 'Выиграли' : b.status === 'LOST' ? 'Проиграли' : 'На рассмотрении'}
                  {' · '}{b.project?.city}
                </div>
              </div>
            </div>
          ))}
          {!bids.length && <p style={{ color: 'var(--text-muted)' }}>Ставок пока нет</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Reveal>
        <h1 className="app-page-title">Торги</h1>
        <p className="app-page-desc">
          Выберите проект слева — справа откроется полная карточка с документами. Подрядчика выбирает менеджер.
        </p>
        {tabBar}
      </Reveal>

      {error && <p className="error-msg">{error}</p>}
      {success && <p style={{ color: 'var(--primary)', marginBottom: 16 }}>{success}</p>}

      {!auctions.length ? (
        <div className="card app-section-card" style={{ marginTop: 24 }}>
          <p className="app-page-desc" style={{ margin: 0 }}>Открытых торгов нет.</p>
        </div>
      ) : (
        <div className="app-auctions-layout">
          <div className="app-auctions-list">
            {auctions.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`app-portal-card${selected === p.id ? ' app-portal-card--active' : ''}`}
                onClick={() => setSelected(p.id)}
              >
                <div className="app-portal-card__head">
                  <strong>
                    {p.projectNumber && <span className="app-portal-card__num">{p.projectNumber}</span>}
                    {p.title}
                  </strong>
                </div>
                <p className="app-portal-card__meta">
                  {p.city || p.lead?.city || '—'}
                  {(p.capacityKw || p.lead?.capacityKw) && ` · ${formatNum(p.capacityKw || p.lead?.capacityKw)} кВт`}
                </p>
                <p className="app-portal-card__meta">
                  Документов: {p.attachments?.length ?? 0}
                  {p.myBid ? ` · Ваша ставка: ${formatMoney(p.myBid.price)}` : ''}
                </p>
                {p.auctionDeadline && (
                  <p className="app-portal-card__meta">
                    До {new Date(p.auctionDeadline).toLocaleDateString('ru-RU')}
                  </p>
                )}
              </button>
            ))}
          </div>

          {detail && (
            <AuctionDetail
              project={detail}
              bidForm={bidForm}
              setBidForm={setBidForm}
              onSubmitBid={submitBid}
              onOpenAttachment={openAttachment}
            />
          )}
        </div>
      )}
    </div>
  );
}
