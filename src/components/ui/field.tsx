import { cloneElement, forwardRef, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

const control =
  'w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-muted/80 ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-ink-2/40 ' +
  'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20 disabled:opacity-60 disabled:bg-surface-2';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(control, 'h-11', className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...p },
  ref,
) {
  return <textarea ref={ref} className={cn(control, 'min-h-24 py-2.5 leading-relaxed', className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...p },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'h-11 appearance-none ps-3 pe-9', className)} {...p}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
    </div>
  );
});

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  children: ReactElement;
  /** Extra content aligned with the label (e.g. a character counter) */
  aside?: ReactNode;
}

/** Label + control + hint/error, wired with ids for screen readers. */
export function Field({ label, hint, error, optional, className, children, aside }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children;
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {optional && <span className="ms-1.5 font-normal text-muted">(רשות)</span>}
        </label>
        {aside}
      </div>
      {control}
      {hint && !error && <p id={hintId} className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={errId} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** A labelled group (fieldset) for chip / segmented selections. */
export function FieldGroup({
  legend,
  hint,
  error,
  children,
  className,
  optional,
}: {
  legend: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}) {
  return (
    <fieldset className={cn('space-y-2', className)}>
      <legend className="mb-2 text-sm font-medium text-ink">
        {legend}
        {optional && <span className="ms-1.5 font-normal text-muted">(רשות)</span>}
      </legend>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs font-medium text-danger" role="alert">{error}</p>}
    </fieldset>
  );
}
