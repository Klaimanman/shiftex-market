import type { ReactNode } from 'react';
import { Check, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Toggleable chip (multi-select). */
export function Chip({
  selected,
  onToggle,
  children,
  disabled,
  locked,
  title,
}: {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
  disabled?: boolean;
  locked?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled || locked}
      title={title}
      onClick={onToggle}
      className={cn(
        'inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors duration-150',
        selected
          ? 'border-accent bg-accent-soft text-ink'
          : 'border-line-strong bg-surface text-ink-2 hover:border-ink-2/40 hover:text-ink',
        (disabled || locked) && 'opacity-55',
      )}
    >
      {selected && <Check className="size-3.5 text-accent" aria-hidden="true" />}
      {locked && <Lock className="size-3.5" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Single-choice segmented control (radiogroup). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; hint?: ReactNode }[];
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  // WAI-ARIA radio group: one tab stop; arrow keys move & select (RTL-aware).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowLeft: 1, ArrowDown: 1, ArrowRight: -1, ArrowUp: -1 };
    if (!(e.key in keys) && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const n = options.length;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + keys[e.key] + n) % n;
    onChange(options[next].value);
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className={cn('grid gap-1 rounded-lg border border-line bg-sunken p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-col items-center justify-center rounded-md px-2 font-medium transition-[background-color,color,box-shadow] duration-150',
              size === 'sm' ? 'h-9 text-sm' : 'min-h-11 py-1.5 text-sm',
              active ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-line' : 'text-muted hover:text-ink',
            )}
          >
            <span>{o.label}</span>
            {o.hint && <span className="tabular mt-0.5 text-2xs font-normal text-muted">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex min-h-11 cursor-pointer items-center justify-between gap-4', disabled && 'cursor-not-allowed opacity-60')}>
      <span className="min-w-0">
        <span className="block text-base text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors duration-150',
          checked ? 'border-accent bg-accent' : 'border-line-strong bg-sunken',
        )}
      >
        <span
          className={cn(
            'inline-block size-4.5 rounded-full bg-surface shadow transition-transform duration-150',
            checked ? '-translate-x-[18px]' : '-translate-x-[2px]',
          )}
          style={{ width: 18, height: 18 }}
        />
      </button>
    </label>
  );
}

export function Tag({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'warn' | 'danger' | 'outline' | 'solid';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-sunken text-ink-2',
    accent: 'bg-accent-soft text-accent',
    warn: 'bg-warn-soft text-warn',
    danger: 'bg-danger-soft text-danger',
    outline: 'border border-line-strong text-ink-2',
    solid: 'bg-ink text-bg',
  };
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-sm px-2 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Avatar({ name, src, size = 36, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-sunken text-ink-2 ring-1 ring-line', className)}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" className="size-full object-cover" referrerPolicy="no-referrer" loading="lazy" /> : <span className="font-medium">{initials}</span>}
    </span>
  );
}

/** Wrap LTR fragments (phones, emails, English) inside RTL text. */
export function Ltr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={className}>
      {children}
    </bdi>
  );
}
