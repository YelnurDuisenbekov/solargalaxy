import { Link } from 'react-router-dom';
import { formatMoney, formatNum } from '../../utils/format';

const BID_STATUS = {
  WON: 'Выиграла',
  LOST: 'Проиграла',
  PENDING: 'На рассмотрении',
};

function winnerLabel(item) {
  if (item.winner) return null;
  if (!item.bidCount) return 'Ставок не было';
  return 'Победитель не выбран';
}

export default function AuctionResultsGrid({ items, showProjectLink = false }) {
  if (!items.length) {
    return (
      <div className="card app-section-card">
        <p className="app-page-desc" style={{ margin: 0 }}>Завершённых торгов пока нет.</p>
      </div>
    );
  }

  return (
    <div className="app-auction-results-grid">
      {items.map((item) => {
        const noWinner = winnerLabel(item);
        const closedDate = item.closedAt || item.auctionDeadline;

        return (
          <article key={item.id} className="card app-auction-result-card">
            <header className="app-auction-result-card__head">
              {item.projectNumber && (
                <span className="app-portal-card__num">{item.projectNumber}</span>
              )}
              <h3 className="app-auction-result-card__title">{item.title}</h3>
            </header>

            <p className="app-auction-result-card__meta">
              {item.city || '—'}
              {item.capacityKw ? ` · ${formatNum(item.capacityKw)} кВт` : ''}
              {' · '}Ставок: {item.bidCount}
            </p>

            {item.winner ? (
              <div className="app-auction-result-card__winner">
                <span className="app-auction-result-card__winner-label">Победитель</span>
                <strong className="app-auction-result-card__winner-name">{item.winner.name}</strong>
                <span className="app-auction-result-card__price">{formatMoney(item.winner.price)}</span>
              </div>
            ) : (
              <p className="app-auction-result-card__no-winner">{noWinner}</p>
            )}

            {item.myBid && (
              <p className="app-auction-result-card__my-bid">
                Ваша ставка: {formatMoney(item.myBid.price)}
                {' · '}{BID_STATUS[item.myBid.status] || item.myBid.status}
              </p>
            )}

            {closedDate && (
              <p className="app-auction-result-card__date">
                {new Date(closedDate).toLocaleDateString('ru-RU')}
              </p>
            )}

            {showProjectLink && (
              <Link to={`/app/projects?open=${item.id}`} className="app-auction-result-card__link">
                Открыть проект →
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}
