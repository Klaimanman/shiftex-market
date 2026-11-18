import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bookmark, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { WeekStrip } from '@/components/WeekStrip';
import { ListingCard } from '@/components/ListingCard';
import { FilterSheet } from '@/components/FilterSheet';
import { SaveSearchSheet } from '@/components/SaveSearchSheet';
import { PeriodDot } from '@/components/listing-bits';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState, ErrorState, ListSkeleton, Skeleton } from '@/components/ui/feedback';
import { useMe } from '@/data/session';
import { useReference } from '@/data/reference';
import { useWeekListings } from '@/data/listings';
import { addDays, formatLong, formatWeekRange, isISODate, startOfWeek, todayIL, weekDays, type ISODate } from '@/domain/dates';
import { activeFilterCount, groupDay, passesFilters, weekCounts } from '@/domain/marketplace';
import { filtersFromParams, writeFilters } from '@/lib/filters';
import { TYPE_LABEL } from '@/domain/labels';
import type { MarketFilters } from '@/domain/types';
import { cn } from '@/lib/cn';

export function MarketplacePage() {
  const me = useMe();
  const [sp, setSp] = useSearchParams();
  const today = todayIL();
  const weekParam = sp.get('week');
  const weekStart: ISODate = weekParam && isISODate(weekParam) ? startOfWeek(weekParam) : startOfWeek(today);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const dayParam = sp.get('day');
  const selected: ISODate = dayParam && days.includes(dayParam) ? dayParam : days.includes(today) ? today : days[0];
  const filters = useMemo(() => filtersFromParams(sp), [sp]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const { ref: r, isLoading: refLoading, error: refError, refetch: refRefetch } = useReference();
  const q = useWeekListings(weekStart);

  const visible = useMemo(() => (q.data ?? []).filter((l) => passesFilters(l, filters, me.qualified)), [q.data, filters, me.qualified]);
  const counts = useMemo(() => (r ? weekCounts(visible, days, r.periods) : undefined), [visible, days, r]);
  const nFilters = activeFilterCount(filters);

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) (v === null ? next.delete(k) : next.set(k, v));
    setSp(next, { replace: true });
  };
  const shiftWeek = (n: number) => {
    const ws = addDays(weekStart, 7 * n);
    go({ week: ws === startOfWeek(today) ? null : ws, day: null });
  };
  const applyFilters = (f: MarketFilters) => setSp(writeFilters(sp, f), { replace: true });
  const isCurrentWeek = weekStart === startOfWeek(today);

  if (refError) return <ErrorState error={refError} onRetry={refRefetch} />;

  return (
    <>
      <PageHeader
        title="לוח שבועי"
        subtitle={<span className="tabular">{formatWeekRange(weekStart)}</span>}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="icon" onClick={() => shiftWeek(-1)} aria-label="השבוע הקודם">
              <ChevronRight className="size-5" aria-hidden="true" />
            </Button>
            {!isCurrentWeek && (
              <Button variant="secondary" size="md" onClick={() => go({ week: null, day: null })} className="px-3">
                היום
              </Button>
            )}
            <Button variant="secondary" size="icon" onClick={() => shiftWeek(1)} aria-label="השבוע הבא">
              <ChevronLeft className="size-5" aria-hidden="true" />
            </Button>
          </div>
        }
      />

      {!r || refLoading ? (
        <Skeleton className="h-[72px] w-full" />
      ) : (
        <WeekStrip days={days} today={today} selected={selected} onSelect={(d) => go({ day: d })} counts={counts} periods={r.periods} />
      )}

      {/* Filter bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant={nFilters ? 'primary' : 'secondary'}
          size="sm"
          icon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
          onClick={() => setFilterOpen(true)}
          aria-label={nFilters ? `סינון, ${nFilters} פעילים` : 'סינון'}
        >
          סינון{nFilters ? <span className="tabular">({nFilters})</span> : null}
        </Button>
        {r && <ActiveFilterChips filters={filters} onChange={applyFilters} periodLabel={r.periodLabel} positionName={r.positionName} />}
        {nFilters > 0 && (
          <>
            <button type="button" onClick={() => applyFilters({ types: [], periods: [], positions: [], option: null, qualifiedOnly: false })} className="h-9 rounded-md px-2 text-sm text-muted hover:text-ink">
              איפוס
            </button>
            <Button variant="quiet" size="sm" icon={<Bookmark className="size-4" aria-hidden="true" />} onClick={() => setSaveOpen(true)} className="ms-auto">
              שמירת החיפוש
            </Button>
          </>
        )}
      </div>

      {/* Selected day */}
      <section className="mt-6" aria-live="polite">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-md font-semibold">
            {formatLong(selected)}
            {selected === today && <span className="ms-2 text-sm font-normal text-accent">היום</span>}
          </h2>
          {counts && <span className="tabular text-sm text-muted">{counts[selected]?.total ?? 0} מודעות</span>}
        </div>

        {q.isLoading || !r ? (
          <ListSkeleton rows={3} />
        ) : q.error ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (
          renderDay({ date: selected, today, listings: visible, hasFilters: nFilters > 0, onClear: () => applyFilters({ types: [], periods: [], positions: [], option: null, qualifiedOnly: false }) })
        )}
      </section>

      {r && (
        <>
          <FilterSheet open={filterOpen} onOpenChange={setFilterOpen} value={filters} onApply={applyFilters} reference={r} qualified={me.qualified} />
          <SaveSearchSheet open={saveOpen} onOpenChange={setSaveOpen} filters={filters} />
        </>
      )}
    </>
  );

  function renderDay({ date, today, listings, hasFilters, onClear }:{ date: ISODate; today: ISODate; listings: typeof visible; hasFilters: boolean; onClear: () => void }) {
    const g = groupDay(listings, date, r!.periods);
    if (g.total === 0) {
      return (
        <div className="rounded-lg border border-dashed border-line-strong">
          <EmptyState
            title={date < today ? 'היום הזה כבר עבר' : hasFilters ? 'אין מודעות שמתאימות לסינון' : 'אין מודעות ליום הזה'}
            body={date < today ? 'מודעות נסגרות אוטומטית כשהמשמרת מתחילה.' : hasFilters ? 'אפשר להרחיב את הסינון או לבדוק ימים אחרים.' : 'אפשר לפרסם מודעה או לשמור חיפוש ולקבל התראה כשמשהו יעלה.'}
            action={
              date < today ? undefined : hasFilters ? (
                <Button variant="secondary" onClick={onClear}>ניקוי הסינון</Button>
              ) : (
                <ButtonLink to={`/new?date=${date}`} variant="secondary">פרסום מודעה ליום הזה</ButtonLink>
              )
            }
          />
        </div>
      );
    }
    return (
      <div className="space-y-6">
        {r!.periods.map((p) => {
          const items = g.byPeriod[p.id] ?? [];
          if (!items.length) return null;
          const times = r!.periodTimes(p.id);
          return (
            <div key={p.id}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-2">
                <PeriodDot code={p.code} />
                {r!.periodLabel(p.id)}
                {times && <bdi dir="ltr" className="tabular font-mono text-xs font-normal text-muted">{times}</bdi>}
                <span className="tabular text-xs font-normal text-muted">· {items.length}</span>
              </h3>
              <div className="grid gap-2 md:grid-cols-2">
                {items.map((l) => (
                  <ListingCard key={`${p.id}-${l.id}`} listing={l} reference={r!} qualified={me.qualified} isMine={l.owner_id === me.user_id} />
                ))}
              </div>
            </div>
          );
        })}
        {g.special.length > 0 && (
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-2">
              <span className="inline-block size-2 rounded-full border border-ink-2" aria-hidden="true" />
              משמרות מיוחדות <span className="tabular text-xs font-normal text-muted">· {g.special.length}</span>
            </h3>
            <div className="grid gap-2 md:grid-cols-2">
              {g.special.map((l) => (
                <ListingCard key={l.id} listing={l} reference={r!} qualified={me.qualified} isMine={l.owner_id === me.user_id} />
              ))}
            </div>
          </div>
        )}
        {g.flexible.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink-2">
              גמיש — כל משמרת <span className="tabular text-xs font-normal text-muted">· {g.flexible.length}</span>
            </h3>
            <div className="grid gap-2 md:grid-cols-2">
              {g.flexible.map((l) => (
                <ListingCard key={l.id} listing={l} reference={r!} qualified={me.qualified} isMine={l.owner_id === me.user_id} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
}

function ActiveFilterChips({
  filters: f,
  onChange,
  periodLabel,
  positionName,
}: {
  filters: MarketFilters;
  onChange: (f: MarketFilters) => void;
  periodLabel: (id: string) => string;
  positionName: (id: string) => string;
}) {
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...f.types.map((t) => ({ key: `t-${t}`, label: TYPE_LABEL[t], remove: () => onChange({ ...f, types: f.types.filter((x) => x !== t) }) })),
    ...f.periods.map((p) => ({ key: `p-${p}`, label: periodLabel(p), remove: () => onChange({ ...f, periods: f.periods.filter((x) => x !== p) }) })),
    ...f.positions.map((p) => ({ key: `pos-${p}`, label: positionName(p), remove: () => onChange({ ...f, positions: f.positions.filter((x) => x !== p) }) })),
    ...(f.option === null ? [] : [{ key: 'opt', label: f.option ? 'עם אופציה' : 'בלי אופציה', remove: () => onChange({ ...f, option: null }) }]),
    ...(f.qualifiedOnly ? [{ key: 'q', label: 'רק מה שאפשר לקחת', remove: () => onChange({ ...f, qualifiedOnly: false }) }] : []),
  ];
  return (
    <>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.remove}
          className={cn('inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface ps-3 pe-2 text-sm text-ink-2 hover:border-line-strong')}
          aria-label={`הסרת סינון: ${c.label}`}
        >
          {c.label}
          <X className="size-3.5 text-muted" aria-hidden="true" />
        </button>
      ))}
    </>
  );
}
