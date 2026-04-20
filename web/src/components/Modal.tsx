import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';
import { IconClose } from './icons';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /**
   * When true (default), clicking the backdrop closes the modal.
   */
  dismissOnBackdrop?: boolean;
  /**
   * When true (default), pressing Escape closes the modal.
   */
  dismissOnEscape?: boolean;
  /**
   * Optional id for aria-labelledby wiring.
   */
  labelId?: string;
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-lg',
  lg: 'md:max-w-2xl',
};

/**
 * Shared sleek modal primitive.
 *
 * - Portals into `document.body` so it escapes any parent stacking context.
 * - Full-screen blurred backdrop on every breakpoint (mobile + desktop).
 * - Locks background scroll while open and restores focus on close.
 * - Animates in with a fade + scale/slide-up consistent with the app's language.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  dismissOnBackdrop = true,
  dismissOnEscape = true,
  labelId,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open || !dismissOnEscape) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissOnEscape, onClose]);

  // Focus management — focus the dialog on open, restore on close
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement;
    const node = contentRef.current;
    if (node) {
      const focusable = node.querySelector<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (focusable ?? node).focus({ preventScroll: true });
    }
    return () => {
      const el = previouslyFocusedRef.current;
      if (el instanceof HTMLElement) el.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-stretch md:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md animate-fade-in"
        onClick={dismissOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Surface */}
      <div
        ref={contentRef}
        tabIndex={-1}
        className={cn(
          'relative z-10 flex flex-col bg-[var(--bg-card)] outline-none',
          'w-full h-full md:h-auto md:max-h-[88vh]',
          'md:w-full md:rounded-2xl md:border md:border-[var(--border)]',
          'md:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)]',
          'animate-fade-in-up md:animate-scale-in',
          SIZE_CLASS[size],
        )}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 h-14 px-5 flex-shrink-0 border-b border-[var(--border)]">
          <div className="min-w-0 flex-1">
            <h2
              id={labelId}
              className="text-sm font-extrabold text-[var(--text-primary)] uppercase tracking-wider truncate"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="flex gap-3 px-5 py-4 border-t border-[var(--border)] flex-shrink-0 bg-[var(--bg-card)]"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
