import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Reveal } from '../../components/motion/ScrollReveal';
import { formatKzPhone } from '../../utils/leadValidation';
import './Login.css';

function deliveryMessage(credentialsDelivery) {
  if (credentialsDelivery?.channels?.includes('whatsapp')) {
    return 'Данные для входа отправлены в WhatsApp.';
  }
  return 'Регистрация успешна. Входите по номеру телефона и паролю.';
}

export default function Login() {
  const { user, login, registerClient } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState('login');
  const [loginMode, setLoginMode] = useState('client');
  const [clientPhone, setClientPhone] = useState('+7');
  const [staffLogin, setStaffLogin] = useState('');
  const [password, setPassword] = useState('');
  const [reg, setReg] = useState({
    fullName: '', phone: '+7', password: '', company: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const state = location.state || {};
    const fromQuery = searchParams.get('register') === '1';
    const fullName = state.fullName || searchParams.get('name') || '';
    const phone = state.phone || searchParams.get('phone') || '+7';

    if (state.mode === 'register' || fromQuery) {
      setMode('register');
      setReg((prev) => ({
        ...prev,
        fullName: fullName || prev.fullName,
        phone: phone.startsWith('+7') ? phone : formatKzPhone(phone),
      }));
    }
  }, [location.state, searchParams]);

  if (user) return <Navigate to="/app" replace />;

  const submitLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const loginName = loginMode === 'client' ? clientPhone : staffLogin;
      const u = await login(loginName, password);
      navigate(u?.role === 'CLIENT' ? '/app/portal' : '/app');
    } catch (err) {
      setError(err.message);
    }
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const result = await registerClient({
        fullName: reg.fullName,
        phone: reg.phone,
        password: reg.password,
        company: reg.company || undefined,
      });
      setSuccess(deliveryMessage(result.credentialsDelivery));
      setTimeout(() => navigate('/app/portal'), 1200);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-page">
      <div className="container login-page__inner">
        <Reveal>
          <h1>{mode === 'login' ? 'Вход в систему' : 'Регистрация клиента'}</h1>
          <p className="login-page__desc">
            {mode === 'login'
              ? 'Клиенты входят по номеру телефона из заявки'
              : 'Укажите телефон из заявки — заявки и проекты появятся в кабинете'}
          </p>

          <div className="app-tabs" style={{ marginBottom: 16 }}>
            <button type="button" className={`app-tab${mode === 'login' ? ' app-tab--active' : ''}`} onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>Вход</button>
            <button type="button" className={`app-tab${mode === 'register' ? ' app-tab--active' : ''}`} onClick={() => { setMode('register'); setError(''); setSuccess(''); }}>Регистрация</button>
          </div>

          {mode === 'login' ? (
            <form className="card login-page__form" onSubmit={submitLogin}>
              <div className="app-tabs" style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  className={`app-tab${loginMode === 'client' ? ' app-tab--active' : ''}`}
                  onClick={() => { setLoginMode('client'); setError(''); }}
                >
                  Клиент
                </button>
                <button
                  type="button"
                  className={`app-tab${loginMode === 'staff' ? ' app-tab--active' : ''}`}
                  onClick={() => { setLoginMode('staff'); setError(''); }}
                >
                  Сотрудник
                </button>
              </div>

              {loginMode === 'client' ? (
                <input
                  className="input"
                  placeholder="Телефон +7 XXX XXX XXXX"
                  required
                  inputMode="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(formatKzPhone(e.target.value))}
                />
              ) : (
                <input
                  className="input"
                  placeholder="Логин"
                  required
                  value={staffLogin}
                  onChange={(e) => setStaffLogin(e.target.value)}
                />
              )}

              <input
                className="input"
                type="password"
                placeholder="Пароль"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && <p className="error-msg">{error}</p>}
              {success && <p className="login-page__success">{success}</p>}
              <button type="submit" className="btn btn--primary">Войти</button>
            </form>
          ) : (
            <form className="card login-page__form" onSubmit={submitRegister}>
              <input className="input" placeholder="ФИО" required value={reg.fullName} onChange={(e) => setReg({ ...reg, fullName: e.target.value })} />
              <input
                className="input"
                placeholder="Телефон +7 XXX XXX XXXX"
                required
                inputMode="tel"
                value={reg.phone}
                onChange={(e) => setReg({ ...reg, phone: formatKzPhone(e.target.value) })}
              />
              <input className="input" placeholder="Компания (необяз.)" value={reg.company} onChange={(e) => setReg({ ...reg, company: e.target.value })} />
              <input className="input" type="password" placeholder="Пароль (мин. 6)" required minLength={6} value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} />
              {error && <p className="error-msg">{error}</p>}
              {success && <p className="login-page__success">{success}</p>}
              <button type="submit" className="btn btn--primary">Зарегистрироваться</button>
            </form>
          )}

          {mode === 'login' && loginMode === 'staff' && (
            <p className="login-page__hint">
              admin / admin123 · menedzher1 / menedzher123 · klient / klient123
            </p>
          )}

          {mode === 'login' && loginMode === 'client' && (
            <p className="login-page__hint">
              Используйте тот же номер, что указали в заявке на сайте
            </p>
          )}
        </Reveal>
      </div>
    </div>
  );
}
