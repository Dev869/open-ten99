import { useToast } from '../hooks/useToast';
import { cn } from '../lib/utils';
import { IconCheckSmall, IconAlertCircle, IconInfo, IconClose } from './icons';

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-6 z-[60] flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-fade-in-up text-sm font-medium',
            toast.type === 'success' && 'bg-[var(--color-green)]/10 border-[var(--color-green)]/30 text-[var(--color-green)]',
            toast.type === 'error' && 'bg-red-500/10 border-red-500/30 text-red-500',
            toast.type === 'info' && 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]',
          )}
          style={{ backdropFilter: 'blur(8px)' }}
        >
          {/* Icon */}
          {toast.type === 'success' && <IconCheckSmall size={16} />}
          {toast.type === 'error' && <IconAlertCircle size={16} />}
          {toast.type === 'info' && <IconInfo size={16} />}
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="opacity-50 hover:opacity-100 transition-opacity"
          >
            <IconClose size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
