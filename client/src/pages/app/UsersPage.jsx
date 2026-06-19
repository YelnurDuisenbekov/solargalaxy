import { useEffect, useState } from 'react';
import { usersApi } from '../../api';

const roleLabel = { ADMIN: 'Админ', EMPLOYEE: 'Сотрудник', CLIENT: 'Клиент' };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: '', password: '', fullName: '', phone: '', company: '', role: 'EMPLOYEE' });
  const [error, setError] = useState('');

  const load = () => usersApi.list().then(setUsers);

  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await usersApi.create(form);
      setForm({ email: '', password: '', fullName: '', phone: '', company: '', role: 'EMPLOYEE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1 style={{ color: 'var(--primary)', marginBottom: 24 }}>Пользователи</h1>
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1.125rem', marginBottom: 16 }}>Добавить сотрудника или клиента</h2>
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          <input className="input" placeholder="Email" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Пароль" required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className="input" placeholder="ФИО / Компания" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input className="input" placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Компания (клиент)" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="EMPLOYEE">Сотрудник</option>
            <option value="CLIENT">Клиент</option>
            <option value="ADMIN">Админ</option>
          </select>
          <button type="submit" className="btn btn--primary">Создать</button>
        </form>
        {error && <p className="error-msg">{error}</p>}
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Телефон</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.fullName}</td><td>{u.email}</td><td>{roleLabel[u.role]}</td><td>{u.phone || '—'}</td>
                <td>{u.isActive ? 'Активен' : 'Отключён'}</td>
                <td><button type="button" className="btn btn--dark" style={{ padding: '6px 12px', fontSize: '0.8125rem' }} onClick={() => usersApi.toggle(u.id).then(load)}>{u.isActive ? 'Откл.' : 'Вкл.'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
