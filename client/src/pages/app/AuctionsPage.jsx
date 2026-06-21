import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { erpApi, operationsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Reveal } from '../../components/motion/ScrollReveal';
import AddressMapsLink from '../../components/AddressMapsLink';
import AuctionResultsGrid from '../../components/auction/AuctionResultsGrid';
import { formatMoney, formatNum } from '../../utils/format';
import { PROJECT_PHASE, SYSTEM_TYPE, OBJECT_TYPE } from '../../utils/crmLabels';
import './app-pages.css';

export default function AuctionsPage({ mode = 'open' }) {
  const { isCrm } = useAuth();
  const canManage = isCrm;
  const isResults = mode === 'results';
  const [auctions, setAuctions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(() => {
    const request = isResults ? erpApi.auctionResults() : erpApi.auctions('open');
    request.then((list) => {
      setAuctions(list);
      if (!isResults) {
        setSelected((prev) => {
          if (prev && list.some((p) => p.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      }
    }).catch((e) => setError(e.message));
  }, [isResults]);

  useEffect(() => { load(); }, [load]);

  const detail = auctions.find((p) => p.id === selected);

  const acceptLowest = async (projectId) => {
    setError('');
    setSuccess('');
    try {
      await erpApi.acceptLowestBid(projectId);
      setSuccess('Подрядчик выбран — минимальная ставка принята');
      load();
    } catch (e) { setError(e.message); }
  };

  const openAttachment = async (projectId, attachmentId) => {
    try {
      const blob = await operationsApi.downloadProjectAttachment(projectId, attachmentId);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (e) { setError(e.message); }
  };

  const pendingBids = detail?.bids?.filter((b) => b.status === 'PENDING') ?? [];
  const lowestPending = pendingBids[0];

  return (
    <div>
      <Reveal>
        <h1 className="app-page-title">ERP — торги</h1>
        <p className="app-page-desc">
          {isResults
            ? 'История завершённых торгов: проект, победитель и итоговая цена.'
            : 'Открытые торги по проектам. Подрядчики подают ставки на монтаж — выбирается минимальная.'}
        </p>
      </Reveal>

      <div className="app-tabs">
        <Link to="/app/auctions" className={`app-tab${!isResults ? ' app-tab--active' : ''}`}>
          Открытые
        </Link>
        <Link to="/app/auction-results" className={`app-tab${isResults ? ' app-tab--active' : ''}`}>
          Итоги
        </Link>
      </div>

      {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}
      {success && <p style={{ color: 'var(--primary)', marginBottom: 16 }}>{success}</p>}

      {isResults ? (
        <AuctionResultsGrid items={auctions} showProjectLink />
      ) : !auctions.length ? (
        <div className="card app-section-card">
          <p className="app-page-desc" style={{ margin: 0 }}>
            Открытых торгов нет. Запустите торги из карточки проекта.
          </p>
        </div>
      ) : (
        <div className="app-auctions-layout">
          <div className="app-auctions-list">
            {auctions.map((p) => {
              return (
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
                    {(() => {
                      const expired = p.auctionDeadline && new Date(p.auctionDeadline) < new Date();
                      return (
                        <span className={`badge ${expired ? 'badge--lost' : 'badge--won'}`}>
                          {expired ? 'Срок истёк' : 'Открыты'}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="app-portal-card__meta">
                    {p.city || p.lead?.city || '—'}
                    {p.capacityKw || p.lead?.capacityKw ? ` · ${formatNum(p.capacityKw || p.lead?.capacityKw)} кВт` : ''}
                    {' · '}Ставок: {p._count?.bids ?? p.bids?.length ?? 0}
                    {(() => {
                      const lowest = p.bids?.find((b) => b.status === 'PENDING')?.price;
                      return lowest != null ? ` · от ${formatMoney(lowest)}` : '';
                    })()}
                  </p>
                  {p.auctionDeadline && (
                    <p className="app-portal-card__meta">До {new Date(p.auctionDeadline).toLocaleDateString('ru-RU')}</p>
                  )}
                </button>
              );
            })}
          </div>

          {detail && (
            <div className="app-auctions-detail card app-section-card" id="auction-detail">
              <div className="app-toolbar">
                <div>
                  {detail.projectNumber && (
                    <p className="app-portal-detail__number">{detail.projectNumber}</p>
                  )}
                  <h2 className="app-section-card__title" style={{ margin: 0 }}>{detail.title}</h2>
                </div>
                <Link to={`/app/projects?open=${detail.id}`} className="btn btn--outline-dark">Открыть проект</Link>
              </div>

              <div className="app-detail-grid">
                <div>
                  <strong>Город:</strong> {detail.city || detail.lead?.city || '—'}<br />
                  <strong>Адрес:</strong> {detail.address || '—'}<br />
                  {detail.address && (
                    <>
                      <AddressMapsLink city={detail.city || detail.lead?.city} address={detail.address} />
                      <br />
                    </>
                  )}
                  <strong>Мощность:</strong> {detail.capacityKw || detail.lead?.capacityKw ? `${formatNum(detail.capacityKw || detail.lead?.capacityKw)} кВт` : '—'}<br />
                  {detail.lead?.systemType && <><strong>Система:</strong> {SYSTEM_TYPE[detail.lead.systemType]}<br /></>}
                  {detail.lead?.objectType && <><strong>Объект:</strong> {OBJECT_TYPE[detail.lead.objectType]}<br /></>}
                </div>
                <div>
                  <strong>Менеджер:</strong> {detail.assignee?.fullName || '—'}<br />
                  <strong>Этап проекта:</strong> {PROJECT_PHASE[detail.phase] || detail.phase}<br />
                  {detail.auctionDeadline && (
                    <><strong>Срок ставок:</strong> {new Date(detail.auctionDeadline).toLocaleDateString('ru-RU')}<br /></>
                  )}
                  {detail.winningBid && (
                    <><strong>Победитель:</strong> {detail.winningBid.contractor?.fullName} — {formatMoney(detail.winningBid.price)}</>
                  )}
                </div>
              </div>

              {detail.auctionBrief && (
                <div className="app-portal-detail__notes">
                  <strong>Описание для подрядчиков</strong>
                  <p>{detail.auctionBrief}</p>
                </div>
              )}

              {detail.attachments?.length > 0 && (
                <div className="app-portal-detail__block">
                  <h3 className="app-portal-detail__subtitle">Файлы</h3>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.875rem' }}>
                    {detail.attachments.map((a) => (
                      <li key={a.id}>
                        <button type="button" className="btn btn--ghost" style={{ padding: 0, fontSize: 'inherit' }} onClick={() => openAttachment(detail.id, a.id)}>
                          {a.originalName}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="app-portal-detail__block">
                <h3 className="app-portal-detail__subtitle">Ставки подрядчиков</h3>
                {detail.bids?.length > 0 ? (
                  <div className="table-wrap">
                    <table className="table table--compact">
                      <thead>
                        <tr><th>Подрядчик</th><th>Цена</th><th>Статус</th><th>Дата</th></tr>
                      </thead>
                      <tbody>
                        {detail.bids.map((b) => (
                          <tr key={b.id}>
                            <td>{b.contractor?.fullName || b.contractor?.company || '—'}</td>
                            <td>{formatMoney(b.price)}</td>
                            <td>{b.status === 'WON' ? 'Выиграла' : b.status === 'LOST' ? 'Проиграла' : 'На рассмотрении'}</td>
                            <td>{new Date(b.createdAt).toLocaleDateString('ru-RU')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Ставок пока нет</p>
                )}

                {canManage && detail.auctionOpen && pendingBids.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <button type="button" className="btn btn--primary" onClick={() => acceptLowest(detail.id)}>
                      Выбрать минимальную ({formatMoney(lowestPending.price)} — {lowestPending.contractor?.fullName})
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
