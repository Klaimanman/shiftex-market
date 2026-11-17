import { addDays, dayNumber, MONTHS_HE, startOfWeek, WEEKDAYS_SHORT_HE, type ISODate } from '@/domain/dates';
import { cn } from '@/lib/cn';

/** Compact multi-date picker covering the next `weeks` weeks (Sunday-start grid). */
export function MultiDatePicker({
  today,
  value,
  onChange,
  weeks = 4,
  max = 14,
  labelledBy,
}: {
  today: ISODate;
  value: ISODate[];
  onChange: (v: ISODate[]) => void;
  weeks?: number;
  max?: number;
  labelledBy?: string;
}) {
  const start = startOfWeek(today);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
  const toggle = (d: ISODate) => {
    if (value.includes(d)) onChange(value.filter((x) => x !== d));
    else if (value.length < max) onChange([...value, d].sort());
  };

  return (
    <div role="group" aria-labelledby={labelledBy} className="rounded-lg border border-line bg-surface p-2">
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-2xs font-medium text-muted" aria-hidden="true">
        {WEEKDAYS_SHORT_HE.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const past = d < today;
          const on = value.includes(d);
          const firstOfMonth = dayNumber(d) === 1;
          return (
            <button
              key={d}
              type="button"
              disabled={past}
              aria-pressed={on}
              aria-label={`${dayNumber(d)} ב${MONTHS_HE[Number(d.slice(5, 7)) - 1]}`}
              onClick={() => toggle(d)}
              className={cn(
                'relative flex h-10 flex-col items-center justify-center rounded-md text-sm transition-colors',
                past && 'text-muted/50',
                !past && !on && 'text-ink hover:bg-sunken',
                on && 'bg-accent font-semibold text-accent-ink',
                d === today && !on && 'ring-1 ring-accent ring-inset',
              )}
            >
              <span className="tabular">{dayNumber(d)}</span>
              {firstOfMonth && <span className={cn('text-[9px] leading-none', on ? 'text-accent-ink/80' : 'text-muted')}>{MONTHS_HE[Number(d.slice(5, 7)) - 1].slice(0, 3)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
