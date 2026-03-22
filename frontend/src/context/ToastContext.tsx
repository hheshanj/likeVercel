import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

let _counter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++_counter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />,
    error:   <XCircle    size={16} className="text-red-500 flex-shrink-0" />,
    info:    <Info       size={16} className="text-blue-500 flex-shrink-0" />,
  };

  const styles: Record<ToastType, string> = {
    success: 'border-emerald-500/20 bg-emerald-500/5',
    error:   'border-red-500/20 bg-red-500/5',
    info:    'border-blue-500/20 bg-blue-500/5',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Stack */}
      <div className="fixed bottom-6 right-6 z-[300] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center space-x-3 px-4 py-3 rounded-2xl border bg-bg-primary shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300 max-w-sm ${styles[toast.type]}`}
          >
            {icons[toast.type]}
            <span className="text-xs font-bold text-text-primary flex-1 leading-relaxed">{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              className="p-1 text-text-muted hover:text-text-primary rounded-lg transition-colors flex-shrink-0"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
