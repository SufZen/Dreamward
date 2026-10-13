import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** accessible name */
  label: string;
  children: ReactNode;
  className?: string;
  /** "center" for confirmations and forms, "top" for the command palette */
  placement?: 'center' | 'top';
}

/**
 * Modal built on the native <dialog>: focus is trapped and returned, Esc
 * closes it, and the page behind is inert. Clicking the backdrop closes it.
 * It rises in on the spring and the backdrop fades.
 */
export function Dialog({ open, onClose, label, children, className, placement = 'center' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={cn('dw-dialog', placement === 'top' && 'dw-dialog--top', className)}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose(); // the backdrop is the dialog's own box
      }}
    >
      {open && children}
    </dialog>
  );
}
