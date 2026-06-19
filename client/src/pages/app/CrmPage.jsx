import { useEffect, useState } from 'react';
import { crmApi } from '../../api';
import { formatMoney } from '../../utils/format';

const statusLabel = { NEW: 'Новая', IN_PROGRESS: 'В работе', WON: 'Выиграна', LOST: 'Проиграна' };
const badgeClass = { NEW: 'badge--new', IN_PROGRESS: 'badge--progress', WON: 'badge--won', LOST: 'badge--lost' };

export default function CrmPage() {
  const [leads, setLeads] = useState([]);
  const [deals, setDeals] = useState([]);

  const load = () => {
    crmApi.leads().then(setLeads);
    crmApi.deals().then(setDeals);
  };

  useEffect(load, []);

  const changeStatus = async (id, status) => {
    await crmApi.updateDealStatus(id, status);
    load();
  };

  return (
    <div>
      <h1 style={{ color: 'var(--primary)', marginBottom: 24 }}>CRM</h1>
      <div className="card" style={{ marginBottom: 24, overflowX: 'auto' }}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: 16 }}>Сделки</h2>
        <table className="table">
          <thead><tr><th>Название</th><th>Клиент</th><th>Сумма</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id}>
                <td>{d.title}</td>
                <td>{d.client?.fullName || '—'}</td>
                <td>{formatMoney(d.amount)}</td>
                <td><span className={`badge ${badgeClass[d.status]}`}>{statusLabel[d.status]}</span></td>
                <td>
                  <select value={d.status} onChange={(e) => changeStatus(d.id, e.target.value)} style={{ fontSize: '0.8125rem' }}>
                    {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: 16 }}>Лиды</h2>
        <table className="table">
          <thead><tr><th>Имя</th><th>Телефон</th><th>Источник</th><th>Дата</th></tr></thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}><td>{l.name}</td><td>{l.phone}</td><td>{l.source || '—'}</td><td>{new Date(l.createdAt).toLocaleDateString('ru-RU')}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
