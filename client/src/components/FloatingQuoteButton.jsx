import { useLocation, useNavigate } from 'react-router-dom';
import { scrollToQuoteForm } from '../utils/scrollToQuoteForm';

export default function FloatingQuoteButton() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const handleClick = (e) => {
    e.preventDefault();
    if (pathname === '/') {
      scrollToQuoteForm();
      return;
    }
    navigate({ pathname: '/', hash: 'quote-form' });
  };

  return (
    <a
      href="/#quote-form"
      className="floating-quote-btn"
      aria-label="Получить расчёт"
      onClick={handleClick}
    >
      <span className="floating-quote-btn__pulse" aria-hidden />
      <span className="floating-quote-btn__label">Получить расчёт</span>
    </a>
  );
}
