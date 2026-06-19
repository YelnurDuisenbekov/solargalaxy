import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Reveal, RevealGroup, RevealItem } from '../../components/motion/ScrollReveal';
import { crmApi, warehouseApi } from '../../api';
import { formatNum } from '../../utils/format';

export default function Dashboard() {
  const { user, isStaff } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!isStaff) return;
    Promise.all([crmApi.deals(), warehouseApi.summary()])
      .then(([deals, wh]) => setStats({
        deals: deals.length,
        active: deals.filter((d) => d.status === 'IN_PROGRESS').length,
        ...wh,
      }))
      .catch(() => {});
  }, [isStaff]);

  if (!isStaff) {
    return (
      <Reveal>
        <h1 className="app-page-title">Добро пожаловать, {user?.fullName}</h1>
        <p className="app-page-desc">Вы вошли как клиент. Перейдите в личный кабинет.</p>
        <Link to="/app/portal" className="btn btn--primary">Мой кабинет</Link>
      </Reveal>
    );
  }

  const cards = [
    { label: 'Сделок', value: stats?.deals, color: 'var(--primary)' },
    { label: 'В работе', value: stats?.active, color: 'var(--accent-dark)' },
    { label: 'SKU на складе', value: stats?.totalSkus, color: 'var(--text)' },
    { label: 'Низкий остаток', value: stats?.lowStockCount, color: stats?.lowStockCount ? '#b91c1c' : 'var(--success)' },
  ];

  return (
    <div>
      <Reveal>
        <h1 className="app-page-title">Обзор</h1>
      </Reveal>
      <RevealGroup className="app-stats-grid" stagger={0.08}>
        {cards.map((c) => (
          <RevealItem key={c.label}>
            <div className="card app-stat-card">
              <p className="app-stat-card__label">{c.label}</p>
              <p className="app-stat-card__value" style={{ color: c.color }}>
                {c.value != null ? formatNum(c.value) : '—'}
              </p>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
    </div>
  );
}
