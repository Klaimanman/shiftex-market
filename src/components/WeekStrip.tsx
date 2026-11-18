import { cn } from '@/lib/cn';
import { dayNumber, dayOfWeek, MONTHS_HE, WEEKDAYS_HE, WEEKDAYS_SHORT_HE, type ISODate } from '@/domain/dates';
import type { ShiftPeriod } from '@/domain/types';
import { PERIOD_BG } from './listing-bits';

interface Counts { total: number; byPeriod: Record<string, number> }

/** Seven-day selector. Today is outlined, the selected day is filled. */
export function WeekStrip({
  days,
  today,
  selected,
  onSelect,
  counts,
  periods,
}: {
  days: ISODate[];
  today: ISODate;
  selected: ISODate;
  onSelect: (d: ISODate) => void;
  counts: Record<ISODate, Counts> | undefined;
  periods: ShiftPeriod[];
}) {
  return (
    <div role="group" aria-label="ימי השבוע" className="grid grid-cols-7 gap-1 sm:gap-1.5">
      {days.map((d) => {
        const isSel = d === selected;
        const isToday = d === today;
        const isPast = d < today;
        const c = counts?.[d];
        const month = Number(d.slice(5, 7));
        return (
          <button
            key={d}
            type="button"
            aria-pressed={isSel}
            aria-current={isToday ? 'date' : undefined}
            aria-label={`יום ${WEEKDAYS_HE[dayOfWeek(d)]} ${dayNumber(d)} ב${MONTHS_HE[month - 1]}${isToday ? ', היום' : ''}${c ? `, ${c.total} מודעות` : ''}`}
            onClick={() => onSelect(d)}
            className={cn(
              'relative flex flex-col items-center rounded-lg border px-0.5 pb-2 pt-1.5 transition-[background-color,border-color,color] duration-150',
              isSel
                ? 'border-ink bg-ink text-bg'
                : isToday
                  ? 'border-accent bg-surface text-ink'
                  : 'border-line bg-surface text-ink hover:border-line-strong',
              isPast && !isSel && 'bg-surface-2 text-muted',
            )}
          >
            <span className={cn('text-2xs font-medium', isSel ? 'text-bg/75' : 'text-muted')}>{WEEKDAYS_SHORT_HE[dayOfWeek(d)]}</span>
            <span className="tabular mt-0.5 text-md font-semibold leading-none sm:text-lg">{dayNumber(d)}</span>
            <span className="mt-2 flex h-1.5 items-center gap-[3px]" aria-hidden="true">
              {periods.map((p) => (
                <span
                  key={p.id}
                  className={cn('size-1.5 rounded-full', (c?.byPeriod[p.id] ?? 0) > 0 ? PERIOD_BG[p.code] : isSel ? 'bg-bg/25' : 'bg-line')}
                />
              ))}
            </span>
            {isToday && !isSel && <span className="absolute -top-px left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-b bg-accent" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
