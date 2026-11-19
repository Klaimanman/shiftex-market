import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { ListingCard } from './ListingCard';
import { ListSkeleton } from './ui/feedback';
import { useMe } from '@/data/session';
import { useOpenListings } from '@/data/listings';
import type { Reference } from '@/data/reference';
import { findSuggestions } from '@/domain/matching';
import type { Listing } from '@/domain/types';
import { cn } from '@/lib/cn';

/**
 * Listings that match the owner's listing. Exact matches first, then by publish time
 * (first come, first served), so #1 is the person who posted the fitting shift first.
 */
export function MatchPanel({ listing, reference: r, justPublished }: { listing: Listing; reference: Reference; justPublished: boolean }) {
  const me = useMe();
  const q = useOpenListings();

  const matches = useMemo(() => {
    const others = (q.data ?? []).filter((x) => x.owner_id !== me.user_id);
    const isQ = (u: string, p: string) => (u === me.user_id ? me.qualified.has(p) : undefined);
    return findSuggestions([listing], others, isQ);
  }, [q.data, listing, me.user_id, me.qualified]);

  const title =
    listing.type === 'seek' ? 'משמרות שמוסרים ומתאימות לחיפוש שלך' : listing.type === 'offer' ? 'מי מחפש משמרת כמו שלך' : 'החלפות מתאימות';

  if (q.isLoading) return <ListSkeleton rows={1} />;
  if (!matches.length) {
    return justPublished ? (
      <p className="rounded-lg border border-dashed border-line-strong px-4 py-4 text-sm text-muted">
        המודעה פורסמה. עדיין אין משמרת מתאימה בלוח; תגיע התראה ברגע שתעלה אחת.
      </p>
    ) : null;
  }

  return (
    <section
      aria-labelledby="matches-title"
      className={cn('rounded-lg border p-4', justPublished ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface')}
    >
      <h2 id="matches-title" className="flex items-center gap-2 font-semibold">
        <Sparkles className="size-4 text-accent" aria-hidden="true" />
        {justPublished ? 'נמצאה התאמה!' : title}
        <span className="tabular text-sm font-normal text-muted">({matches.length})</span>
      </h2>
      {justPublished && <p className="mt-1 text-sm text-ink-2">{title}. הראשון ברשימה פרסם ראשון.</p>}
      <ol className="mt-3 space-y-2">
        {matches.slice(0, 5).map((m, i) => (
          <li key={m.other.id}>
            <ListingCard
              listing={m.other}
              reference={r}
              qualified={me.qualified}
              showDate
              order={i + 1}
              badge={
                <span className={m.result.level === 'exact' ? 'text-xs font-semibold text-accent' : 'text-xs font-medium text-warn'}>
                  {m.result.level === 'exact' ? 'התאמה מלאה' : 'התאמה חלקית'}
                </span>
              }
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
