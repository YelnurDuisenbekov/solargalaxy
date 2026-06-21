export default function FormField({ label, error, hint, children }) {
  return (
    <div className={`app-field${error ? ' app-field--error' : ''}`}>
      {label && <label>{label}</label>}
      {children}
      {hint && !error && <p className="app-field__hint">{hint}</p>}
      {error && <p className="app-field__error">{error}</p>}
    </div>
  );
}
