import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader, Panel } from '@/components/PageHeader';
import { ListingCard } from '@/components/ListingCard';
import { ButtonLink } from '@/components/ui/button';
import { Chip, Switch } from '@/components/ui/controls';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { PeriodDot } from '@/components/listing-bits';
import { useMe } from '@/data/session';
import { useReference } from '@/data/reference';
import { useOpenListings } from '@/data/listings';
import { formatLong, todayIL, type ISODate } from '@/domain/dates';
import { isOpen } from '@/domain/matching';
import type { Listing } from '@/domain/types';

type Kind = 'offers' | 'seeks';

const COPY: Record<Kind, { title: string; subtitle: string; empty: string; cta: string; newType: string }> = {
  offers: {
    title: 'מסירות משמרת',
    subtitle: 'כל המשמרות שעמיתים מוסרים או מציעים להחלפה, לפי תאריך.',
    empty: 'אין כרגע משמרות למסירה',
    cta: 'מסירת משמרת',
    newType: 'offer',
  },
  seeks: {
    title: 'חיפושי משמרת',
    subtitle: 'מי מחפש משמרת ובאילו תאריכים. יש לך משמרת שמתאימה? אפשר לפנות ישירות.',
    empty: 'אין כרגע חיפושי משמרת',
    cta: 'חיפוש משמרת',
    newType: 'seek',
  },
};

/** A listing's relevant dates: the shift date for offers/exchanges, the wanted dates for seeks. */
function datesOf(l: Listing, today: ISODate): ISODate[] {
  const ds = l.type === 'seek' ? l.want_dates : l.shift_date ? [l.shift_date] : [];
  return ds.filter((d) => d >= today);
}

export function ListingSectionPage({ kind }: { kind: Kind }) {
  const me = useMe();
  const { ref: r } = useReference();
  const q = useOpenListings();
  const today = todayIL();
  const c = COPY[kind];
  const [periods, setPeriods] = useState<string[]>([]);
  const [onlyMine, setOnlyMine] = useState(false);
  const [qualifiedOnly, setQualifiedOnly] = useState(false);

  const groups = useMemo(() => {
    const all = (q.data ?? []).filter((l) => isOpen(l) && (kind === 'seeks' ? l.type === 'seek' : l.type !== 'seek'));
    const filtered = all.filter((l) => {
      if (onlyMine && l.owner_id !== me.user_id) return false;
      if (qualifiedOnly && kind === 'offers' && l.position_id && !me.qualified.has(l.position_id)) return false;
      if (periods.length) {
        if (l.type === 'seek') {
          if (l.want_period_ids.length && !l.want_period_ids.some((p) => periods.includes(p))) return false;
        } else if (!l.period_id || !periods.includes(l.period_id)) return false;
      }
      return true;
    });
    const byDate = new Map<ISODate, Listing[]>();
    for (const l of filtered) for (const d of datesOf(l, today)) byDate.set(d, [...(byDate.get(d) ?? []), l]);
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ date, items: items.sort((a, b) => a.created_at.localeCompare(b.created_at)) }));
  }, [q.data, kind, onlyMine, qualifiedOnly, periods, me.user_id, me.qualified, today]);

  const total = new Set(groups.flatMap((g) => g.items.map((l) => l.id))).size;

  return (
    <>
      <PageHeader
        title={c.title}
        subtitle={c.subtitle}
        actions={
          <ButtonLink to={`/new?type=${c.newType}`} size="sm" icon={<Plus className="size-4" aria-hidden="true" />}>
            {c.cta}
          </ButtonLink>
        }
      />

      {r && (
        <div className="mb-5 space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="סינון לפי משמרת">
            {r.periods.map((p) => (
              <Chip
                key={p.id}
                selected={periods.includes(p.id)}
                onToggle={() => setPeriods((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))}
              >
                <PeriodDot code={p.code} />
                {r.periodLabel(p.id)}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-6 rounded-md border border-line bg-surface px-3">
            <Switch checked={onlyMine} onChange={setOnlyMine} label="רק המודעות שלי" />
            {kind === 'offers' && <Switch checked={qualifiedOnly} onChange={setQualifiedOnly} label="רק מה שאפשר לקחת" />}
          </div>
        </div>
      )}

      {q.isLoading || !r ? (
        <ListSkeleton rows={3} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : groups.length === 0 ? (
        <Panel>
          <EmptyState
            title={c.empty}
            body={periods.length || onlyMine || qualifiedOnly ? 'אפשר לנקות את הסינון.' : 'מודעות חדשות יופיעו כאן מיד כשהן מתפרסמות.'}
            action={<ButtonLink to={`/new?type=${c.newType}`} variant="secondary">{c.cta}</ButtonLink>}
          />
        </Panel>
      ) : (
        <div className="space-y-7">
          <p className="tabular text-sm text-muted">{total} מודעות</p>
          {groups.map((g) => (
            <section key={g.date}>
              <h2 className="mb-2 text-sm font-semibold text-ink-2">
                {formatLong(g.date)}
                {g.date === today && <span className="ms-2 font-normal text-accent">היום</span>}
              </h2>
              <ol className="max-w-3xl space-y-2">
                {g.items.map((l, i) => (
                  <li key={`${g.date}-${l.id}`}>
                    <ListingCard listing={l} reference={r} qualified={me.qualified} isMine={l.owner_id === me.user_id} order={i + 1} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
