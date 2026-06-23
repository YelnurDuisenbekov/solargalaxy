/** Прокрутка к блоку «Параметры для расчёта» на главной. */
export function scrollToQuoteForm() {
  const el = document.getElementById('quote-form');
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => {
    document.getElementById('calc-tariff')?.focus({ preventScroll: true });
  }, 450);
  return true;
}
