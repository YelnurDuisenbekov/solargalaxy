import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Reveal } from '../../components/motion/ScrollReveal';
import PricingPanel from '../../components/warehouse/PricingPanel';
import './app-pages.css';

export default function PricingPage() {
  const { hasPerm } = useAuth();
  const [error, setError] = useState('');
  const canAccess = hasPerm('pricing.edit');

  if (!canAccess) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div>
      <Reveal>
        <h1 className="app-page-title">Ценообразование</h1>
        <p className="app-page-desc">Закупочные и продажные цены по номенклатуре склада</p>
      </Reveal>

      {error && <p className="error-msg" style={{ marginBottom: 16 }}>{error}</p>}

      <Reveal delay={0.05}>
        <PricingPanel onError={setError} />
      </Reveal>
    </div>
  );
}
