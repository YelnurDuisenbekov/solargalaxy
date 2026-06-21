import { useLocation } from 'react-router-dom';

export default function FloatingQuoteButton() {
  const { pathname } = useLocation();
  const href = pathname === '/' ? '#quote' : '/#quote';

  return (
    <a href={href} className="floating-quote-btn" aria-label="Получить расчёт">
      <span className="floating-quote-btn__pulse" aria-hidden />
      <span className="floating-quote-btn__label">Получить расчёт</span>
    </a>
  );
}
