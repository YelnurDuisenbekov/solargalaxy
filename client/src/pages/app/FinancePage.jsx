import { useEffect, useState } from 'react';
import { financeApi, erpApi, usersApi } from '../../api';
import { Reveal, RevealGroup, RevealItem } from '../../components/motion/ScrollReveal';
import { formatMoney } from '../../utils/format';
import { INVOICE_STATUS, invoiceBadge } from '../../utils/crmLabels';
import './app-pages.css';

export default function FinancePage() {
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    financeApi.invoices().then(setInvoices).catch((e) => setError(e.message));
    financeApi.summary().then(setSummary).catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    erpApi.projects().then(setProjects).catch(() => {});
    usersApi.list('CLIENT').then(setClients).catch(() => {});
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await financeApi.updateInvoice(id, { status });
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <Reveal>
        <h1 className="app-page-title">ERP — финансы</h1>
        <p className="app-page-desc">Счета, авансы и оплаты по проектам</p>
      </Reveal>

      {summary && (
        <div style={{ marginBottom: 24 }}>
          <RevealGroup className="app-stats-grid" stagger={0.06}>
            <RevealItem><div className="card app-stat-card"><p className="app-stat-card__label">Всего счетов</p><p className="app-stat-card__value">{summary.totalInvoices}</p></div></RevealItem>
            <RevealItem><div className="card app-stat-card"><p className="app-stat-card__label">Оплачено</p><p className="app-stat-card__value" style={{ color: 'var(--green)' }}>{formatMoney(summary.paid)}</p></div></RevealItem>
            <RevealItem><div className="card app-stat-card"><p className="app-stat-card__label">К оплате</p><p className="app-stat-card__value" style={{ color: 'var(--blue)' }}>{formatMoney(summary.pending)}</p></div></RevealItem>
          </RevealGroup>
        </div>
      )}

      <div className="app-toolbar">
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{invoices.length} счетов</span>
        <button type="button" className="btn btn--primary" onClick={() => setShowCreate(true)}>+ Новый счёт</button>
      </div>

      {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="card app-section-card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>№</th><th>Клиент</th><th>Проект</th><th>Сумма</th><th>Статус</th><th>Срок</th><th></th></tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td><strong>{inv.number}</strong></td>
                  <td>{inv.client?.fullName || inv.client?.company || '—'}</td>
                  <td>{inv.project?.title || '—'}</td>
                  <td>{formatMoney(inv.amount)}</td>
                  <td><span className={`badge ${invoiceBadge[inv.status]}`}>{INVOICE_STATUS[inv.status]}</span></td>
                  <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('ru-RU') : '—'}</td>
                  <td>
                    <select className="app-table-select" value={inv.status} onChange={(e) => updateStatus(inv.id, e.target.value)}>
                      {Object.entries(INVOICE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <InvoiceForm projects={projects} clients={clients} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
}

function InvoiceForm({ projects, clients, onClose, onSaved }) {
  const [form, setForm] = useState({ number: '', amount: '', clientId: '', projectId: '', dueDate: '', notes: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      await financeApi.createInvoice({
        number: form.number,
        amount: Number(form.amount),
        clientId: form.clientId || null,
        projectId: form.projectId || null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        notes: form.notes || undefined,
        status: 'DRAFT',
      });
      onSaved();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="app-modal-backdrop" onClick={onClose}>
      <div className="app-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Новый счёт</h2>
        <form className="app-modal__form" onSubmit={submit}>
          <div><label>Номер</label><input className="input" required placeholder="SG-2025-002" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></div>
          <div><label>Сумма, ₸</label><input className="input" type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div><label>Клиент</label>
            <select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">—</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
            </select>
          </div>
          <div><label>Проект</label>
            <select className="input" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">—</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div><label>Срок оплаты</label><input className="input" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
          <div><label>Примечание</label><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
