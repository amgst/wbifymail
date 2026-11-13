'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import Icon from '../icons';
import { avatarColor, initials, parseAddress } from './lib';

export function Avatar({ address, size = 36 }: { address: string; size?: number }) {
  const { email } = parseAddress(address);
  return (
    <span className="avatar" aria-hidden="true" style={{ background: avatarColor(email || '?'), width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {initials(address)}
    </span>
  );
}

export type Toast = { id: number; text: string; tone?: 'error' | 'info'; action?: { label: string; run: () => void }; duration?: number };

export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} dismiss={dismiss} />
      ))}
    </div>
  );
}
function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toast.duration ?? (toast.tone === 'error' ? 12000 : 6000));
    return () => clearTimeout(timer);
  }, [toast, dismiss]);
  return (
    <div className={'toast ' + (toast.tone || 'info')} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <span>{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.action!.run();
            dismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="icon-btn small" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

export function Modal({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input,textarea,select,button:not(.modal-close)');
    (first || ref.current)?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close.current();
      }
      if (e.key === 'Tab' && ref.current) {
        const items = [...ref.current.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href],[tabindex]:not([tabindex="-1"])')].filter(el => !el.hasAttribute('disabled'));
        if (!items.length) return;
        const [a, b] = [items[0], items[items.length - 1]];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    }
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      previous?.focus?.();
    };
  }, []);
  return (
    <div className="scrim" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1}>
        <header>
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-btn modal-close" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

export type ConfirmRequest = { title: string; message: string; confirm: string; danger?: boolean; run: () => void };
export function Confirm({ request, onClose }: { request: ConfirmRequest; onClose: () => void }) {
  return (
    <Modal
      title={request.title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={'btn ' + (request.danger ? 'danger' : 'primary')}
            onClick={() => {
              onClose();
              request.run();
            }}
          >
            {request.confirm}
          </button>
        </>
      }
    >
      <p className="muted">{request.message}</p>
    </Modal>
  );
}
