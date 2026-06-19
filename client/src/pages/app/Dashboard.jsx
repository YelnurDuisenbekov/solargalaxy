import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
      <div>
        <h1 style={{ color: 'var(--primary)', marginBottom: 16 }}>Добро пожаловать, {user?.fullName}</h1>
        <p style={{ marginBottom: 24 }}>Вы вошли как клиент. Перейдите в личный кабинет.</p>
        <Link to="/app/portal" className="btn btn--primary">Мой кабинет</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ color: 'var(--primary)', marginBottom: 24 }}>Обзор</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        <div className="card"><p style={{ opacity: 0.6, fontSize: '0.8125rem' }}>Сделок</p><p style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)' }}>{stats?.deals != null ? formatNum(stats.deals) : '—'}</p></div>
        <div className="card"><p style={{ opacity: 0.6, fontSize: '0.8125rem' }}>В работе</p><p style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-dark)' }}>{stats?.active != null ? formatNum(stats.active) : '—'}</p></div>
        <div className="card"><p style={{ opacity: 0.6, fontSize: '0.8125rem' }}>SKU на складе</p><p style={{ fontSize: '1.75rem', fontWeight: 700 }}>{stats?.totalSkus != null ? formatNum(stats.totalSkus) : '—'}</p></div>
        <div className="card"><p style={{ opacity: 0.6, fontSize: '0.8125rem' }}>Низкий остаток</p><p style={{ fontSize: '1.75rem', fontWeight: 700, color: stats?.lowStockCount ? '#b91c1c' : 'var(--success)' }}>{stats?.lowStockCount != null ? formatNum(stats.lowStockCount) : '—'}</p></div>
      </div>
    </div>
  );
}
