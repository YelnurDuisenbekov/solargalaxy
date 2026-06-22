import { useEffect, useState } from 'react';
import { usersApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Reveal } from '../../components/motion/ScrollReveal';
import { USER_ROLE, PERMISSION_LABELS } from '../../utils/crmLabels';

const ACCOUNT_TYPES = [
  { value: 'MANAGER', label: 'Менеджер' },
  { value: 'DIRECTOR', label: 'Директор' },
  { value: 'WAREHOUSE', label: 'Завсклад (sklad)' },
  { value: 'SUPPLY', label: 'Снабжение (logistika)' },
  { value: 'ACCOUNTANT', label: 'Бухгалтерия (buh)' },
  { value: 'CONTRACTOR', label: 'Подрядчик' },
  { value: 'CLIENT', label: 'Клиент' },
  { value: 'ADMIN', label: 'Администратор' },
];

export default function UsersPage() {
  const { hasPerm, isAdmin, canManageUsers } = useAuth();
  const [users, setUsers] = useState([]);
  const [permList, setPermList] = useState([]);
  const [form, setForm] = useState({ login: '', password: '', fullName: '', phone: '', company: '', role: 'MANAGER' });
  const [editUser, setEditUser] = useState(null);
  const [permUser, setPermUser] = useState(null);
  const [selectedPerms, setSelectedPerms] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => usersApi.list().then(setUsers);

  useEffect(() => {
    if (!canManageUsers) return;
    load();
    if (hasPerm('users.permissions')) {
      usersApi.permissionList().then(setPermList).catch(() => {});
    }
  }, [hasPerm, canManageUsers]);

  if (!canManageUsers) {
    return (
      <Reveal>
        <h1 className="app-page-title">Пользователи</h1>
        <p className="app-page-desc">У вас нет прав на управление пользователями. Обратитесь к администратору.</p>
      </Reveal>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const created = await usersApi.create(form);
      setForm({ login: '', password: '', fullName: '', phone: '', company: '', role: 'MANAGER' });
      if (form.role === 'CLIENT' && created.credentialsDelivery?.channels?.includes('whatsapp')) {
        setSuccess('Клиент создан. Логин и пароль отправлены в WhatsApp.');
      } else if (form.role === 'CLIENT' && form.phone) {
        setSuccess('Клиент создан. WhatsApp не отправлен — передайте логин и пароль вручную.');
      }
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      await usersApi.update(editUser.id, {
        fullName: editUser.fullName,
        phone: editUser.phone,
        company: editUser.company,
        role: editUser.role,
        password: editUser.password || undefined,
      });
      setEditUser(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const savePermissions = async () => {
    try {
      await usersApi.setPermissions(permUser.id, selectedPerms);
      setPermUser(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeUser = async (id) => {
    if (!window.confirm('Удалить пользователя?')) return;
    try {
      await usersApi.delete(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <Reveal>
        <h1 className="app-page-title">Пользователи и права</h1>
        <p className="app-page-desc">Создание аккаунтов, редактирование, разрешения. Логин — латиница: sklad, buh, menedzher1…</p>
      </Reveal>

      {hasPerm('users.create') && (
        <Reveal delay={0.05}>
          <div className="card app-section-card">
            <h2 className="app-section-card__title">Создать аккаунт</h2>
            <form className="app-form-grid" onSubmit={submit}>
              <input className="input" placeholder="Логин (sklad, buh…)" required pattern="[a-zA-Z0-9_-]+" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value.toLowerCase() })} />
              <input className="input" placeholder="Пароль" required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <input className="input" placeholder="ФИО / Название" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              <input className="input" placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="input" placeholder="Компания" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ACCOUNT_TYPES.filter((t) => t.value !== 'ADMIN' || isAdmin).map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <button type="submit" className="btn btn--primary app-form-grid__submit">Создать</button>
            </form>
          </div>
        </Reveal>
      )}

      {error && <p className="error-msg">{error}</p>}
      {success && <p className="login-page__success" style={{ marginBottom: 16 }}>{success}</p>}

      <Reveal delay={0.1}>
        <div className="card app-section-card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Логин</th><th>Имя</th><th>Роль</th><th>Телефон</th><th>Статус</th><th></th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.login}</strong></td>
                    <td>{u.fullName}{u.company ? ` (${u.company})` : ''}</td>
                    <td>{USER_ROLE[u.role] || u.role}</td>
                    <td>{u.phone || '—'}</td>
                    <td>{u.isActive ? 'Активен' : 'Отключён'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {hasPerm('users.edit') && u.role !== 'ADMIN' && (
                          <button type="button" className="btn btn--dark app-table-btn" onClick={() => setEditUser({ ...u, password: '' })}>Изм.</button>
                        )}
                        {hasPerm('users.permissions') && u.role !== 'ADMIN' && (
                          <button type="button" className="btn btn--dark app-table-btn" onClick={() => {
                            setPermUser(u);
                            setSelectedPerms(u.permissions?.filter((p) => p !== 'admin.full') || []);
                          }}>Права</button>
                        )}
                        {hasPerm('users.edit') && u.role !== 'ADMIN' && (
                          <button type="button" className="btn btn--dark app-table-btn" onClick={() => usersApi.toggle(u.id).then(load)}>
                            {u.isActive ? 'Откл.' : 'Вкл.'}
                          </button>
                        )}
                        {hasPerm('users.delete') && u.role !== 'ADMIN' && (
                          <button type="button" className="btn btn--dark app-table-btn" onClick={() => removeUser(u.id)}>Удал.</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      {editUser && (
        <div className="app-modal-backdrop" onClick={() => setEditUser(null)}>
          <div className="app-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Редактировать — {editUser.login}</h2>
            <form className="app-modal__form" onSubmit={saveEdit}>
              <div><label>ФИО</label><input className="input" required value={editUser.fullName} onChange={(e) => setEditUser({ ...editUser, fullName: e.target.value })} /></div>
              <div><label>Телефон</label><input className="input" value={editUser.phone || ''} onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })} /></div>
              <div><label>Роль</label>
                <select className="input" value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}>
                  {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label>Новый пароль</label><input className="input" type="password" value={editUser.password} onChange={(e) => setEditUser({ ...editUser, password: e.target.value })} /></div>
              <div className="app-modal__actions">
                <button type="submit" className="btn btn--primary">Сохранить</button>
                <button type="button" className="btn btn--outline-dark" onClick={() => setEditUser(null)}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {permUser && (
        <div className="app-modal-backdrop" onClick={() => setPermUser(null)}>
          <div className="app-modal app-modal--wide" onClick={(e) => e.stopPropagation()}>
            <h2>Разрешения — {permUser.login}</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              Дополнительные права поверх роли «{USER_ROLE[permUser.role]}»
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {(permList.length ? permList : Object.entries(PERMISSION_LABELS).map(([key, label]) => ({ key, label }))).map((p) => (
                <label key={p.key} style={{ display: 'flex', gap: 8, fontSize: '0.8125rem', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedPerms.includes(p.key)}
                    onChange={(e) => {
                      setSelectedPerms(e.target.checked
                        ? [...selectedPerms, p.key]
                        : selectedPerms.filter((k) => k !== p.key));
                    }}
                  />
                  {p.label}
                </label>
              ))}
            </div>
            <div className="app-modal__actions" style={{ marginTop: 16 }}>
              <button type="button" className="btn btn--primary" onClick={savePermissions}>Сохранить</button>
              <button type="button" className="btn btn--outline-dark" onClick={() => setPermUser(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
