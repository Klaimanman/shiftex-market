import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, ChevronLeft, Search, Send, ShieldCheck } from 'lucide-react';
import { Panel, Section } from '@/components/PageHeader';
import { ListingCard } from '@/components/ListingCard';
import { WeekStrip } from '@/components/WeekStrip';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, ErrorState, ListSkeleton, Notice, Skeleton } from '@/components/ui/feedback';
import { useMe } from '@/data/session';
import { useReference } from '@/data/reference';
import { useOpenListings, useWeekListings } from '@/data/listings';
import { useAdminStats } from '@/data/admin';
import { findSuggestions, isOpen } from '@/domain/matching';
import { weekCounts } from '@/domain/marketplace';
import { firstName } from '@/domain/messages';
import { formatLong, startOfWeek, todayIL, weekDays } from '@/domain/dates';
import { TYPE_HINT } from '@/domain/labels';
import { useNavigate } from 'react-router-dom';

const ACTIONS = [
  { type: 'offer', title: 'מסירת משמרת', icon: Send },
  { type: 'seek', title: 'חיפוש משמרת', icon: Search },
  { type: 'exchange', title: 'החלפת משמרת', icon: ArrowLeftRight },
] as const;

export function HomePage() {
  const me = useMe();
  const navigate = useNavigate();
  const today = todayIL();
  const weekStart = startOfWeek(today);
  const days = weekDays(weekStart);
  const { ref: r } = useReference();
  const open = useOpenListings();
  const week = useWeekListings(weekStart);

  const mine = useMemo(() => (open.data ?? []).filter((l) => l.owner_id === me.user_id && isOpen(l)), [open.data, me.user_id]);
  const suggestions = useMemo(() => {
    if (!open.data) return [];
    const others = open.data.filter((l) => l.owner_id !== me.user_id);
    const isQ = (u: string, p: string) => (u === me.user_id ? me.qualified.has(p) : undefined);
    const seen = new Set<string>();
    return findSuggestions(mine, others, isQ).filter((s) => !seen.has(s.other.id) && seen.add(s.other.id));
  }, [open.data, mine, me.user_id, me.qualified]);
  const counts = useMemo(() => (r && week.data ? weekCounts(week.data, days, r.periods) : undefined), [r, week.data, days]);

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm text-muted">{formatLong(today, true)}</p>
        <h1 className="mt-1 text-xl font-semibold">שלום, {firstName(me.full_name)}</h1>
      </header>

      {me.isAdmin && <AdminNotice />}

      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map(({ type, title, icon: Icon }) => (
          <Link
            key={type}
            to={`/new?type=${type}`}
            title={TYPE_HINT[type]}
            className="group flex flex-col justify-between gap-6 rounded-lg border border-line bg-surface p-3 transition-colors hover:border-line-strong sm:p-4"
          >
            <Icon className="size-5 text-accent" aria-hidden="true" />
            <span className="text-sm font-medium leading-tight sm:text-base">{title}</span>
          </Link>
        ))}
      </div>

      <Section
        title="השבוע בלוח"
        action={
          <Link to="/market" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            ללוח המלא <ChevronLeft className="size-4" aria-hidden="true" />
          </Link>
        }
      >
        {!r || week.isLoading ? (
          <Skeleton className="h-[72px]" />
        ) : week.error ? (
          <ErrorState error={week.error} onRetry={() => week.refetch()} />
        ) : (
          <WeekStrip days={days} today={today} selected={today} onSelect={(d) => navigate(`/market?day=${d}`)} counts={counts} periods={r.periods} />
        )}
      </Section>

      <Section
        title="התאמות בשבילך"
        action={
          suggestions.length > 3 && (
            <Link to="/matches" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              כל ההתאמות ({suggestions.length}) <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
          )
        }
      >
        {open.isLoading || !r ? (
          <ListSkeleton rows={2} />
        ) : open.error ? (
          <ErrorState error={open.error} onRetry={() => open.refetch()} />
        ) : mine.length === 0 ? (
          <Panel>
            <EmptyState compact title="אין כרגע מודעות פעילות שלך" body="כשמפרסמים מסירה, חיפוש או החלפה — המערכת מציגה כאן משמרות מתאימות." />
          </Panel>
        ) : suggestions.length === 0 ? (
          <Panel>
            <EmptyState compact title="עדיין אין התאמות" body="ההתאמות מתעדכנות אוטומטית, ותגיע התראה כשתעלה משמרת מתאימה." />
          </Panel>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {suggestions.slice(0, 4).map((s) => (
              <ListingCard
                key={s.other.id}
                listing={s.other}
                reference={r}
                qualified={me.qualified}
                showDate
                badge={<span className={s.result.level === 'exact' ? 'text-xs font-semibold text-accent' : 'text-xs font-medium text-warn'}>{s.result.level === 'exact' ? 'התאמה מלאה' : 'התאמה חלקית'}</span>}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="המודעות הפעילות שלי"
        action={
          <Link to="/mine" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            ניהול <ChevronLeft className="size-4" aria-hidden="true" />
          </Link>
        }
      >
        {open.isLoading || !r ? (
          <ListSkeleton rows={1} />
        ) : mine.length === 0 ? (
          <Panel>
            <EmptyState compact title="אין מודעות פעילות" action={<ButtonLink to="/new" variant="secondary">פרסום מודעה</ButtonLink>} />
          </Panel>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {mine.slice(0, 4).map((l) => (
              <ListingCard key={l.id} listing={l} reference={r} qualified={me.qualified} isMine showDate compact />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function AdminNotice() {
  const stats = useAdminStats();
  const s = stats.data;
  if (!s) return null;
  const items: string[] = [];
  if (s.pending) items.push(`${s.pending} בקשות הצטרפות ממתינות`);
  if (s.periods_missing_times) items.push('שעות המשמרות עוד לא הוגדרו');
  if (!s.coordinator_email_set) items.push('כתובת רכז השיבוץ לא הוגדרה');
  if (!items.length) return null;
  return (
    <Notice tone="warn" className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-4" aria-hidden="true" />
          {items.join(' · ')}
        </span>
        <Link to="/admin" className="font-medium text-ink underline underline-offset-2">
          למסך הניהול
        </Link>
      </div>
    </Notice>
  );
}
