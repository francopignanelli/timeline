import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /**
   * `md` (default) suits short forms (create/add dialogs). `lg` is for
   * content-heavy views — the Milestone and Stage editors carry a growing
   * list of blocks and need the extra width to keep them comfortable.
   */
  size?: 'md' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<DialogProps['size']>, string> = {
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

/** Native <dialog>-based modal: focus trap, Esc and backdrop click for free. */
export function Dialog({ open, onClose, title, children, size = 'md' }: DialogProps) {
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
        // `e.target === ref.current` alone isn't "clicked the backdrop" — a
        // native <dialog>'s scrollbar isn't a separate element, so clicking
        // or dragging it *also* reports the dialog itself as the target,
        // which used to close the modal out from under anyone using the
        // scrollbar. The backdrop is genuinely outside the dialog's own box;
        // the scrollbar sits inside it. Comparing the click coordinates to
        // the dialog's rect tells them apart.
        if (e.target !== ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const insideDialogBox =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        if (!insideDialogBox) onClose();
      }}
      aria-label={title}
      // Desktop: centered card that scrolls internally rather than growing past
      // the viewport (milestone editors can carry several blocks). Mobile:
      // full-screen sheet, per UI_SPEC.md.
      className={`m-auto max-h-[85vh] w-full overflow-y-auto rounded-xl border border-border bg-surface-elevated p-6 text-text backdrop:bg-dark/40 backdrop:backdrop-blur-sm max-sm:h-full max-sm:max-h-full max-sm:max-w-full max-sm:rounded-none max-sm:border-0 ${SIZE_CLASSES[size]}`}
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
