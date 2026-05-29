import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts(p => p.filter(t => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const toast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++_id;
    setToasts(p => [...p, { id, message, type }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const success = useCallback((msg, dur) => toast(msg, 'success', dur), [toast]);
  const error   = useCallback((msg, dur) => toast(msg, 'error',   dur), [toast]);
  const warning = useCallback((msg, dur) => toast(msg, 'warning', dur), [toast]);
  const info    = useCallback((msg, dur) => toast(msg, 'info',    dur), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Toast Container ──────────────────────────────────────────────
const TYPE_STYLES = {
  success: { bar: 'bg-[#00D4AA]', icon: '✅', text: 'text-[#00D4AA]', border: 'border-[#00D4AA]/30' },
  error:   { bar: 'bg-[#FF5C5C]', icon: '❌', text: 'text-[#FF5C5C]', border: 'border-[#FF5C5C]/30' },
  warning: { bar: 'bg-[#FFB547]', icon: '⚠️', text: 'text-[#FFB547]', border: 'border-[#FFB547]/30' },
  info:    { bar: 'bg-[#6C63FF]', icon: '💡', text: 'text-[#6C63FF]', border: 'border-[#6C63FF]/30' },
};

function ToastContainer({ toasts, dismiss }) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => {
        const s = TYPE_STYLES[t.type] || TYPE_STYLES.info;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl
              bg-[var(--bg-surface)] border ${s.border} shadow-2xl
              animate-[slideIn_0.25s_ease-out]`}
            style={{ animation: 'slideIn 0.25s ease-out' }}
          >
            <span className="text-base flex-shrink-0 mt-0.5">{s.icon}</span>
            <p className="flex-1 text-sm text-[var(--text)] leading-relaxed">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none flex-shrink-0"
            >×</button>
            <div className={`absolute bottom-0 left-0 h-0.5 ${s.bar} rounded-b-xl animate-[shrink_3.5s_linear_forwards]`} />
          </div>
        );
      })}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};
