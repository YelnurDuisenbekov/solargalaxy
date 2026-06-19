import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (user) return <Navigate to="/app" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/app');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container" style={{ padding: '48px 20px', maxWidth: 420 }}>
      <h1 style={{ color: 'var(--primary)', marginBottom: 8 }}>Вход в систему</h1>
      <p style={{ marginBottom: 24, opacity: 0.7, fontSize: '0.9375rem' }}>CRM, склад и личный кабинет</p>
      <form className="card" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input className="input" type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Пароль" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="error-msg">{error}</p>}
        <button type="submit" className="btn btn--primary">Войти</button>
      </form>
      <p style={{ marginTop: 16, fontSize: '0.8125rem', opacity: 0.6 }}>
        Демо: admin@solargalaxy.kz / admin123
      </p>
    </div>
  );
}
