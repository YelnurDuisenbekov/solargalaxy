import { useEffect, useState } from 'react';
import { whatsappApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Reveal } from '../../components/motion/ScrollReveal';
import { formatKzPhone } from '../../utils/leadValidation';
import { invalidateWhatsAppStatus } from '../../hooks/useWhatsAppApi';
import './app-pages.css';

export default function WhatsAppPage() {
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [testPhone, setTestPhone] = useState('+7 777 475 1332');
  const [testResult, setTestResult] = useState('');

  const load = () => {
    setLoading(true);
    whatsappApi.status()
      .then((data) => { setStatus(data); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const sendTest = async (e) => {
    e.preventDefault();
    setTestResult('');
    try {
      const res = await whatsappApi.test({ phone: testPhone });
      setTestResult(`Отправлено. ID: ${res.messageId || 'ok'}`);
      invalidateWhatsAppStatus();
    } catch (err) {
      setTestResult(err.message);
    }
  };

  const isGreen = status?.provider === 'green';

  return (
    <div>
      <Reveal>
        <h1 className="app-page-title">WhatsApp API</h1>
        <p className="app-page-desc">
          Автоотправка сообщений клиентам из CRM.
          {isGreen ? ' Подключено через Green API — Facebook не нужен.' : ' Meta Cloud API или Green API.'}
        </p>
      </Reveal>

      {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="card app-section-card">
        <h2 className="app-section-card__title">Статус</h2>
        {loading && <p style={{ color: 'var(--text-muted)' }}>Проверка…</p>}
        {!loading && status && (
          <dl className="app-dl">
            <dt>Провайдер</dt>
            <dd>{status.providerLabel || status.provider || '—'}</dd>
            <dt>Подключение</dt>
            <dd>{status.configured ? (status.ready ? '✓ Работает' : '✗ Ошибка') : 'Не настроен'}</dd>
            {status.businessPhone && <><dt>Бизнес-номер</dt><dd>{status.businessPhone}</dd></>}
            {status.phone && <><dt>WhatsApp</dt><dd>{status.phone}</dd></>}
            {status.instanceId && <><dt>Инстанс</dt><dd>{status.instanceId}</dd></>}
            {status.state && <><dt>Статус</dt><dd>{status.state}</dd></>}
            {!isGreen && status.phoneId && <><dt>Phone ID</dt><dd>{status.phoneId}</dd></>}
            {!isGreen && (
              <>
                <dt>Шаблон follow-up</dt>
                <dd>{status.templates?.followup || '—'}</dd>
              </>
            )}
            {status.message && <><dt>Инфо</dt><dd>{status.message}</dd></>}
            {status.error && <><dt>Ошибка</dt><dd style={{ color: '#b91c1c' }}>{status.error}</dd></>}
          </dl>
        )}
        <button type="button" className="btn btn--outline-dark" style={{ marginTop: 12 }} onClick={load}>
          Обновить
        </button>
      </div>

      <div className="card app-section-card" style={{ marginTop: 16, borderLeft: '4px solid #25d366' }}>
        <h2 className="app-section-card__title">Green API — рекомендуется</h2>
        <p style={{ fontSize: '0.875rem', marginBottom: 12 }}>
          Не нужен Facebook Developer. Подключение через QR-код вашего номера <strong>+7 777 475 1332</strong>.
        </p>
        <ol style={{ fontSize: '0.875rem', lineHeight: 1.7, paddingLeft: '1.25rem' }}>
          <li>Зарегистрируйтесь на <a href="https://console.green-api.com" target="_blank" rel="noreferrer">console.green-api.com</a></li>
          <li>Создайте инстанс → отсканируйте QR в WhatsApp (Связанные устройства)</li>
          <li>Скопируйте <strong>idInstance</strong> и <strong>apiTokenInstance</strong></li>
          <li>В терминале: <code>npm run green:setup</code> или двойной клик <code>server/setup-green-api.bat</code></li>
        </ol>
      </div>

      <div className="card app-section-card" style={{ marginTop: 16 }}>
        <h2 className="app-section-card__title">Meta Cloud API (если Facebook разрешит)</h2>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          Часто блокирует создание приложений. Если не получается — используйте Green API выше.
        </p>
        <ol style={{ fontSize: '0.875rem', lineHeight: 1.6, paddingLeft: '1.25rem' }}>
          <li><a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">developers.facebook.com</a> → приложение Business → WhatsApp</li>
          <li><code>npm run whatsapp:setup</code> → вставить Token и Phone ID</li>
          <li>В <code>.env</code>: <code>WHATSAPP_PROVIDER=meta</code></li>
        </ol>
      </div>

      {(status?.ready || status?.configured) && (
        <div className="card app-section-card" style={{ marginTop: 16 }}>
          <h2 className="app-section-card__title">Тестовая отправка</h2>
          <form className="app-modal__form" onSubmit={sendTest} style={{ maxWidth: 360 }}>
            <div>
              <label>Телефон</label>
              <input
                className="input"
                value={testPhone}
                onChange={(e) => setTestPhone(formatKzPhone(e.target.value))}
              />
            </div>
            <button type="submit" className="btn btn--whatsapp">Отправить тест</button>
            {testResult && <p style={{ marginTop: 8, fontSize: '0.875rem' }}>{testResult}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
