import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Native <dialog>-based modal: focus trap, Esc and backdrop click for free. */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
      aria-label={title}
      className="m-auto w-full max-w-lg rounded-xl border border-border bg-surface-elevated p-6 text-text backdrop:bg-dark/40"
    >
      {open && (
        <>
          <h2 className="font-serif text-2xl">{title}</h2>
          <div className="mt-5">{children}</div>
        </>
      )}
    </dialog>
  );
}
