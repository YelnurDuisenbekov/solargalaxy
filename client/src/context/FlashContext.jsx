import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { registerFlash, unregisterFlash } from '../lib/flashBus';

const FlashContext = createContext(null);

let flashSeq = 0;

export function FlashProvider({ children }) {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((message, type = 'success') => {
    if (!message) return;
    const id = ++flashSeq;
    setItems((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const value = useMemo(() => ({
    success: (message) => push(message, 'success'),
    error: (message) => push(message, 'error'),
    info: (message) => push(message, 'info'),
  }), [push]);

  useEffect(() => {
    registerFlash(value);
    return () => unregisterFlash();
  }, [value]);

  return (
    <FlashContext.Provider value={value}>
      {children}
      <div className="app-flash-stack" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className={`app-flash-toast app-flash-toast--${item.type}`}
            role="status"
          >
            <span>{item.message}</span>
            <button type="button" className="app-flash-toast__close" onClick={() => dismiss(item.id)} aria-label="Закрыть">
              ×
            </button>
          </div>
        ))}
      </div>
    </FlashContext.Provider>
  );
}

export function useFlash() {
  const ctx = useContext(FlashContext);
  if (!ctx) throw new Error('useFlash outside FlashProvider');
  return ctx;
}
