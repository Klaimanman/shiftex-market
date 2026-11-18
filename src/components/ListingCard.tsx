import { Link } from 'react-router-dom';
import { ArrowLeftRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Listing } from '@/domain/types';
import type { Reference } from '@/data/reference';
import { formatDayMonth, formatShort, instantToISODate, instantToLocalTime, relativeTimeHe } from '@/domain/dates';
import { Avatar } from './ui/controls';
import { LockedHint, OptionTag, PERIOD_BG, StatusTag, TypeTag, wantedSummary } from './listing-bits';

export function ListingCard({
  listing: l,
  reference: r,
  qualified,
  showDate = false,
  isMine = false,
  compact = false,
  badge,
  order,
}: {
  listing: Listing;
  reference: Reference;
  qualified: Set<string>;
  showDate?: boolean;
  isMine?: boolean;
  compact?: boolean;
  badge?: React.ReactNode;
  /** FIFO position in its list (1 = published first) */
  order?: number;
}) {
  const period = l.period_id ? r.periodById.get(l.period_id) : undefined;
  const locked = !isMine && l.type !== 'seek' && !!l.position_id && !qualified.has(l.position_id);
  const times = l.type !== 'seek' ? r.shiftTimes(l) : null;

  return (
    <Link
      to={`/listing/${l.id}`}
      className={cn(
        'group relative block rounded-lg border border-line bg-surface ps-4 pe-3 transition-[border-color,background-color] duration-150',
        'hover:border-line-strong focus-visible:border-accent',
        compact ? 'py-2.5' : 'py-3.5',
        locked && 'bg-surface-2',
      )}
    >
      <span
        className={cn('absolute inset-y-3 start-0 w-[3px] rounded-e-full', period ? PERIOD_BG[period.code] : 'bg-line-strong')}
        aria-hidden="true"
      />
      <div className="flex items-start gap-3">
        {order !== undefined && (
          <span
            className="tabular grid size-8 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2 text-sm font-semibold text-ink"
            title={`מקום ${order} בתור`}
          >
            <span className="sr-only">מקום בתור: </span>
            {order}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <TypeTag type={l.type} />
            <StatusTag status={l.status} />
            {l.has_option && <OptionTag />}
            {isMine && <span className="text-xs font-medium text-accent">שלך</span>}
            {badge}
          </div>

          {l.type === 'seek' ? (
            <p className="mt-2 text-base font-medium leading-snug text-ink">
              {wantedSummary(l, r, { dates: false })}
            </p>
          ) : (
            <p className="mt-2 text-base font-medium leading-snug text-ink">
              {r.shiftTitle(l)}
              <span className="text-muted"> · </span>
              {r.positionName(l.position_id)}
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {showDate && l.shift_date && <span className="tabular">{formatShort(l.shift_date)}</span>}
            {l.type === 'seek' && <span className="tabular">{l.want_dates.length <= 4 ? l.want_dates.map(formatShort).join(', ') : `${l.want_dates.length} תאריכים`}</span>}
            {times && (
              <bdi dir="ltr" className="tabular font-mono text-xs">
                {times}
              </bdi>
            )}
            {l.type === 'exchange' && (
              <span className="inline-flex items-center gap-1">
                <ArrowLeftRight className="size-3.5" aria-hidden="true" />
                תמורת {wantedSummary(l, r)}
              </span>
            )}
          </div>

          {!compact && l.note && <p className="mt-2 line-clamp-2 text-sm text-ink-2">{l.note}</p>}

          {!compact && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm text-ink-2">
                <Avatar name={l.owner?.full_name ?? ''} src={l.owner?.avatar_url} size={22} />
                <span className="truncate">{l.owner?.full_name ?? 'עמית'}</span>
                <span className="text-muted">
                  · פורסם <bdi dir="ltr" className="tabular">{formatDayMonth(instantToISODate(l.created_at))} {instantToLocalTime(l.created_at)}</bdi>
                  <span className="sr-only"> ({relativeTimeHe(l.created_at)})</span>
                </span>
              </span>
              {locked && <LockedHint />}
            </div>
          )}
        </div>
        <ChevronLeft className="mt-1 size-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      </div>
    </Link>
  );
}
