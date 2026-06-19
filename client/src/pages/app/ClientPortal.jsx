import { useAuth } from '../../context/AuthContext';

export default function ClientPortal() {
  const { user } = useAuth();

  return (
    <div>
      <h1 style={{ color: 'var(--primary)', marginBottom: 16 }}>Личный кабинет клиента</h1>
      <div className="card">
        <p><strong>{user?.fullName}</strong></p>
        <p style={{ opacity: 0.7, marginTop: 8 }}>{user?.email}</p>
        {user?.company && <p style={{ marginTop: 8 }}>Компания: {user.company}</p>}
        <p style={{ marginTop: 24, opacity: 0.6, fontSize: '0.9375rem' }}>
          Здесь будут ваши заказы, документы и статус проектов. Раздел расширяется по мере развития платформы.
        </p>
      </div>
    </div>
  );
}
