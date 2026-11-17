import type { ReactNode } from 'react';
import { AlertTriangle, Info, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/errors';

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className ?? 'size-5')} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="טוען">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-lg border border-line bg-surface p-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-3 h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
  compact,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'px-4 py-6' : 'px-6 py-12')}>
      {icon && <div className="mb-3 text-muted" aria-hidden="true">{icon}</div>}
      <p className="text-md font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'לא הצלחנו לטעון את הנתונים' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
      <AlertTriangle className="mb-3 size-6 text-danger" aria-hidden="true" />
      <p className="text-md font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-4 text-sm font-medium hover:bg-surface-2"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          ניסיון נוסף
        </button>
      )}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'accent';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'bg-surface-2 border-line text-ink-2',
    warn: 'bg-warn-soft border-warn/25 text-ink',
    danger: 'bg-danger-soft border-danger/25 text-ink',
    accent: 'bg-accent-soft border-accent/25 text-ink',
  };
  const Icon = tone === 'info' || tone === 'accent' ? Info : AlertTriangle;
  const iconColor = { info: 'text-muted', warn: 'text-warn', danger: 'text-danger', accent: 'text-accent' }[tone];
  return (
    <div className={cn('flex gap-3 rounded-md border p-3 text-sm', tones[tone], className)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconColor)} aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function FullPageSpinner({ label = 'טוען…' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center" role="status">
      <div className="flex flex-col items-center gap-3 text-muted">
        <Spinner className="size-6 text-accent" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}
