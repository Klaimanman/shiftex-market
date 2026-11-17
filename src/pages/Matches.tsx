import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Panel } from '@/components/PageHeader';
import { ListingCard } from '@/components/ListingCard';
import { listingHeadline } from '@/components/listing-bits';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, ErrorState, ListSkeleton, Notice } from '@/components/ui/feedback';
import { Tag } from '@/components/ui/controls';
import { useMe } from '@/data/session';
import { useReference } from '@/data/reference';
import { useOpenListings } from '@/data/listings';
import { findSuggestions, isOpen } from '@/domain/matching';
import { formatShort } from '@/domain/dates';
import { TYPE_LABEL } from '@/domain/labels';

/** Matching suggestions grouped by my open listing. Deterministic; a suggestion is never a transfer. */
export function MatchesPage() {
  const me = useMe();
  const { ref: r } = useReference();
  const q = useOpenListings();

  const groups = useMemo(() => {
    const all = q.data ?? [];
    const mine = all.filter((l) => l.owner_id === me.user_id && isOpen(l));
    const others = all.filter((l) => l.owner_id !== me.user_id);
    const isQ = (u: string, p: string) => (u === me.user_id ? me.qualified.has(p) : undefined);
    return mine.map((m) => ({ mine: m, suggestions: findSuggestions([m], others, isQ) }));
  }, [q.data, me.user_id, me.qualified]);

  return (
    <>
      <PageHeader title="התאמות" subtitle="משמרות שמתאימות למודעות הפעילות שלך — לפי תאריך, משמרת, עמדה והסמכות." />
      <Notice className="mb-6">התאמה היא הצעה בלבד. ההעברה עצמה מתואמת ביניכם ומול רכז השיבוץ.</Notice>
      {q.isLoading || !r ? (
        <ListSkeleton rows={3} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : groups.length === 0 ? (
        <Panel>
          <EmptyState
            title="אין מודעות פעילות להתאים אליהן"
            body="התאמות מחושבות מול המודעות שלך. אפשר לפרסם חיפוש משמרת או הצעת החלפה."
            action={<ButtonLink to="/new?type=seek">פרסום חיפוש משמרת</ButtonLink>}
          />
        </Panel>
      ) : (
        <div className="space-y-8">
          {groups.map(({ mine, suggestions }) => (
            <section key={mine.id}>
              <Link to={`/listing/${mine.id}`} className="mb-3 flex flex-wrap items-center gap-2 hover:underline">
                <Tag tone="outline">{TYPE_LABEL[mine.type]}</Tag>
                <span className="font-semibold">{listingHeadline(mine, r)}</span>
                {mine.shift_date && <span className="tabular text-sm text-muted">{formatShort(mine.shift_date)}</span>}
              </Link>
              {suggestions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line-strong px-4 py-5 text-sm text-muted">אין עדיין משמרות מתאימות. תגיע התראה כשתעלה אחת.</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {suggestions.map((s) => (
                    <ListingCard
                      key={s.other.id}
                      listing={s.other}
                      reference={r}
                      qualified={me.qualified}
                      showDate
                      badge={
                        <span className={s.result.level === 'exact' ? 'text-xs font-semibold text-accent' : 'text-xs font-medium text-warn'} title={s.result.differences.join(' · ')}>
                          {s.result.level === 'exact' ? 'התאמה מלאה' : `התאמה חלקית${s.result.differences.length ? ` · ${s.result.differences[0]}` : ''}`}
                        </span>
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
