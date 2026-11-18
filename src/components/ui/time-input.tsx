import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

const selectCls =
  'h-11 w-full appearance-none rounded-md border border-line-strong bg-surface ps-3 pe-8 text-base tabular text-ink ' +
  'hover:border-ink-2/40 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 ' +
  'aria-[invalid=true]:border-danger';

/**
 * 24-hour time picker ("HH:MM"), independent of the browser/OS locale
 * (native <input type="time"> shows AM/PM on English-locale devices).
 * Value '' = not set. Hours on the left, minutes on the right, always LTR.
 */
export function TimeInput({
  value,
  onChange,
  id,
  allowEmpty = true,
  className,
  ...aria
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  allowEmpty?: boolean;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}) {
  const [h, m] = value ? value.slice(0, 5).split(':') : ['', ''];
  // Keep any non-5-minute value the database already holds selectable.
  const minutes = m && !MINUTES.includes(m) ? [...MINUTES, m].sort() : MINUTES;

  const update = (nh: string, nm: string) => {
    if (!nh && !nm) return onChange('');
    onChange(`${nh || '00'}:${nm || '00'}`);
  };

  return (
    <div dir="ltr" className={cn('flex items-center gap-1.5', className)} role="group">
      <div className="relative flex-1">
        <select id={id} aria-label="שעה" className={selectCls} value={h} onChange={(e) => update(e.target.value, e.target.value ? m || '00' : '')} {...aria}>
          {allowEmpty && <option value="">--</option>}
          {HOURS.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      </div>
      <span className="font-semibold text-muted" aria-hidden="true">:</span>
      <div className="relative flex-1">
        <select aria-label="דקות" className={selectCls} value={m} onChange={(e) => update(h || (e.target.value ? '00' : ''), e.target.value)} {...aria}>
          {allowEmpty && <option value="">--</option>}
          {minutes.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      </div>
    </div>
  );
}
