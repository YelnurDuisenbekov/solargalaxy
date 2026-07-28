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

  const goToQuote = (e) => {
    e.preventDefault();
    if (pathname === '/') {
      scrollToQuoteForm();
      return;
    }
    navigate({ pathname: '/', hash: 'quote-form' });
  };

  const openCallback = (e) => {
    e.preventDefault();
    setModalOpen(true);
  };

  if (nearForm) {
    return (
      <>
        <div className="floating-quote-stack" aria-label="Действия у калькулятора">
          <button
            type="button"
            className="floating-quote-btn floating-quote-btn--calc"
            onClick={goToQuote}
          >
            <span className="floating-quote-btn__pulse" aria-hidden />
            <span className="floating-quote-btn__label">Получить расчёт</span>
          </button>
          <span className="floating-quote-stack__or">или</span>
          <button
            type="button"
            className="floating-quote-btn floating-quote-btn--near-form"
            onClick={openCallback}
          >
            <span className="floating-quote-btn__pulse" aria-hidden />
            <span className="floating-quote-btn__label">Заказать обратный звонок</span>
          </button>
        </div>
        <CallbackRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className="floating-quote-btn floating-quote-btn--large"
        aria-label="Получить расчёт"
        onClick={goToQuote}
      >
        <span className="floating-quote-btn__pulse" aria-hidden />
        <span className="floating-quote-btn__label">Получить расчёт</span>
      </button>
      <CallbackRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
