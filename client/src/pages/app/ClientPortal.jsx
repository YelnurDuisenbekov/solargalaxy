import { useAuth } from '../../context/AuthContext';
import { Reveal } from '../../components/motion/ScrollReveal';

export default function ClientPortal() {
  const { user } = useAuth();

  return (
    <Reveal>
      <h1 className="app-page-title">Личный кабинет клиента</h1>
      <div className="card app-section-card">
        <p><strong>{user?.fullName}</strong></p>
        <p className="app-page-desc">{user?.email}</p>
        {user?.company && <p style={{ marginTop: 8 }}>Компания: {user.company}</p>}
        <p className="app-page-desc" style={{ marginTop: 24 }}>
          Здесь будут ваши заказы, документы и статус проектов. Раздел расширяется по мере развития платформы.
        </p>
      </div>
    </Reveal>
  );
}
