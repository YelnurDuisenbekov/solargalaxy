import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CallbackRequestModal } from './lead/PublicLeadForm';
import { scrollToQuoteForm } from '../utils/scrollToQuoteForm';

export default function FloatingQuoteButton() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [nearForm, setNearForm] = useState(false);

  useEffect(() => {
    if (pathname !== '/') {
      setNearForm(false);
      return undefined;
    }

    let observer;
    const attach = () => {
      const el = document.getElementById('quote');
      if (!el) return;
      observer?.disconnect();
      observer = new IntersectionObserver(
        ([entry]) => setNearForm(entry.isIntersecting),
        { threshold: 0.2, rootMargin: '-60px 0px' },
      );
      observer.observe(el);
    };

    attach();
    const retry = window.setTimeout(attach, 400);
    return () => {
      window.clearTimeout(retry);
      observer?.disconnect();
    };
  }, [pathname]);

  const label = nearForm ? 'Заказать обратный звонок' : 'Получить расчет';

  const handleClick = (e) => {
    e.preventDefault();
    if (nearForm) {
      setModalOpen(true);
      return;
    }
    if (pathname === '/') {
      scrollToQuoteForm();
      return;
    }
    navigate({ pathname: '/', hash: 'quote-form' });
  };

  return (
    <>
      <button
        type="button"
        className={`floating-quote-btn${nearForm ? ' floating-quote-btn--near-form' : ''}`}
        aria-label={label}
        onClick={handleClick}
      >
        <span className="floating-quote-btn__pulse" aria-hidden />
        <span className="floating-quote-btn__label">{label}</span>
      </button>
      <CallbackRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
