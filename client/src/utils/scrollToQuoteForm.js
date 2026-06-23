/** Прокрутка к блоку «Контакты для связи» на главной. */
export function scrollToQuoteForm() {
  const el = document.getElementById('quote-form');
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => {
    const field = el.querySelector('input:not([type="hidden"]), select, textarea');
    field?.focus({ preventScroll: true });
  }, 450);
  return true;
}
