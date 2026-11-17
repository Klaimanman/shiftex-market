import { cn } from '@/lib/cn';

/** The ShiftEX mark: two offset bars forming an exchange, inside a ticker tag. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="7" className="fill-accent" />
      <path d="M8 12.5h12.5l-3-3" fill="none" stroke="var(--accent-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 19.5H11.5l3 3" fill="none" stroke="var(--accent-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Wordmark — always LTR. */
export function Logo({ className, withMarket = true, size = 'md' }: { className?: string; withMarket?: boolean; size?: 'md' | 'lg' }) {
  return (
    <span dir="ltr" className={cn('inline-flex items-center gap-2.5', className)} aria-label="ShiftEX Market">
      <LogoMark size={size === 'lg' ? 36 : 28} />
      <span className="flex items-baseline gap-1.5" aria-hidden="true">
        <span className={cn('font-semibold tracking-tight text-ink', size === 'lg' ? 'text-xl' : 'text-md')}>
          Shift<span className="text-accent">EX</span>
        </span>
        {withMarket && (
          <span className={cn('font-mono uppercase tracking-[0.14em] text-muted', size === 'lg' ? 'text-xs' : 'text-2xs')}>Market</span>
        )}
      </span>
    </span>
  );
}
