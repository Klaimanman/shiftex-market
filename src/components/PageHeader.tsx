import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: string | true;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <header className={cn('mb-5 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {back && (
          <button
            type="button"
            onClick={() => (back === true ? (window.history.length > 1 ? navigate(-1) : navigate('/')) : navigate(back))}
            className="-ms-2 mb-2 inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm text-muted hover:bg-sunken hover:text-ink"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
            חזרה
          </button>
        )}
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mt-8 first:mt-0', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-lg border border-line bg-surface', className)}>{children}</div>;
}
