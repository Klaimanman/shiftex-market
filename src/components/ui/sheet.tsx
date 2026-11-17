import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './button';

/**
 * Accessible modal: bottom sheet on phones, centered panel on larger screens.
 * Radix handles focus trapping, Escape, scroll lock and aria wiring.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade-in" />
        <Dialog.Content
          dir="rtl"
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[14px] border border-line bg-surface shadow-pop animate-sheet-up',
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85dvh] sm:w-[calc(100%-32px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:animate-pop-in',
            size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden="true" />
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 pb-4 pt-3 sm:pt-5">
            <div className="min-w-0">
              <Dialog.Title className="text-md font-semibold text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{typeof title === 'string' ? title : 'חלון'}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="-me-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink" aria-label="סגירה">
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="border-t border-line px-5 py-3 pb-safe">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Confirmation dialog for irreversible or significant actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  tone = 'primary',
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => Promise<unknown> | void;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title={title}
      description={body}
      footer={
        <div className="flex flex-row-reverse gap-2 sm:justify-start">
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={busy}
            className="flex-1 sm:flex-none"
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } catch {
                /* caller shows the error */
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => onOpenChange(false)} disabled={busy}>
            ביטול
          </Button>
        </div>
      }
    >
      {children ?? <div className="text-sm text-muted">אפשר לבטל ולחזור בכל שלב לפני האישור.</div>}
    </Sheet>
  );
}
