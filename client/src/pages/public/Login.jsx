import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Reveal } from '../../components/motion/ScrollReveal';
import './Login.css';

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
    <div className="login-page">
      <div className="container login-page__inner">
        <Reveal>
          <h1>Вход в систему</h1>
          <p className="login-page__desc">CRM, склад и личный кабинет</p>
          <form className="card login-page__form" onSubmit={submit}>
            <input className="input" type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="input" type="password" placeholder="Пароль" required value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn btn--primary">Войти</button>
          </form>
          <p className="login-page__hint">Демо: admin@solargalaxy.kz / admin123</p>
        </Reveal>
      </div>
    </div>
  );
}
