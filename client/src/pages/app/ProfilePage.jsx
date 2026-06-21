import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usersApi } from '../../api';
import { Reveal } from '../../components/motion/ScrollReveal';
import { USER_ROLE } from '../../utils/crmLabels';
import './app-pages.css';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ fullName: user?.fullName || '', phone: user?.phone || '', password: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      const body = { fullName: form.fullName, phone: form.phone || null };
      if (form.password) body.password = form.password;
      await usersApi.updateMe(body);
      await refreshUser();
      setForm((f) => ({ ...f, password: '' }));
      setMsg('Данные сохранены');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <Reveal>
        <h1 className="app-page-title">Мой профиль</h1>
        <p className="app-page-desc">Измените имя и номер телефона</p>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="card app-section-card" style={{ maxWidth: 480 }}>
          <p style={{ marginBottom: 16, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {user?.role === 'CLIENT' ? (
              <>Вход по телефону: <strong>{user?.phone || '—'}</strong></>
            ) : (
              <>Логин: <strong>{user?.login}</strong></>
            )}
            {' · '}{USER_ROLE[user?.role]}
          </p>
          <form className="app-modal__form" onSubmit={submit}>
            <div>
              <label>ФИО / Название</label>
              <input className="input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div>
              <label>Телефон</label>
              <input className="input" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label>Новый пароль (необязательно)</label>
              <input className="input" type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            {error && <p className="error-msg">{error}</p>}
            {msg && <p style={{ color: 'var(--primary)' }}>{msg}</p>}
            <button type="submit" className="btn btn--primary">Сохранить</button>
          </form>
        </div>
      </Reveal>
    </div>
  );
}
