import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Settings } from 'lucide-react';
import { PageHeader, Panel } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/button';
import { Avatar } from '@/components/ui/controls';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { useMe } from '@/data/session';
import { useReference, type Reference } from '@/data/reference';
import { useMarkRead, useNotifications } from '@/data/notifications';
import { formatShort, relativeTimeHe } from '@/domain/dates';
import type { AppNotification } from '@/domain/types';
import { cn } from '@/lib/cn';

function describe(n: AppNotification, r: Reference | null): { title: string; body?: string; to?: string } {
  const l = n.listing;
  const shift = l && r ? (l.type === 'seek' ? `חיפוש ל־${l.want_dates.map(formatShort).join(', ')}` : `${r.shiftTitle(l)} · ${r.positionName(l.position_id)}${l.shift_date ? ` · ${formatShort(l.shift_date)}` : ''}`) : undefined;
  const actor = n.actor?.full_name;
  const to = l ? `/listing/${l.id}` : undefined;
  switch (n.kind) {
    case 'match':
      return { title: 'עלתה משמרת שמתאימה לחיפוש שלך', body: shift, to };
    case 'seeker_found':
      return { title: 'מישהו מחפש משמרת כמו שלך', body: shift, to };
    case 'saved_search':
      return { title: 'משמרת חדשה לפי חיפוש שמור', body: shift, to };
    case 'interest':
      return { title: `${actor ?? 'עמית'} הביע/ה עניין במודעה שלך`, body: shift, to };
    case 'interest_update':
      return { title: n.payload.status === 'accepted' ? 'בעל המודעה סימן שהפנייה שלך מתאימה' : 'בעל המודעה סימן שהפנייה לא מתאימה', body: shift, to };
    case 'listing_closed':
      return { title: 'מודעה שהתעניינת בה נסגרה', body: shift, to };
    case 'listing_removed':
      return { title: 'ההנהלה הסירה מודעה שלך', body: n.payload.reason && n.payload.reason !== 'member_inactive' ? String(n.payload.reason) : shift, to };
    case 'account_approved':
      return { title: 'החשבון אושר — הלוח פתוח לשימוש', to: '/' };
    case 'account_status':
      return { title: 'סטטוס החשבון עודכן', to: '/profile' };
    case 'member_pending':
      return { title: `${actor ?? 'עובד/ת'} מבקש/ת להצטרף`, body: 'ממתין לאישור במסך הניהול', to: '/admin/members' };
  }
}

export function NotificationsPage() {
  const me = useMe();
  const { ref: r } = useReference();
  const q = useNotifications(me.user_id);
  const mark = useMarkRead(me.user_id);
  const unread = (q.data ?? []).filter((n) => !n.read_at);
  const markedOnce = useRef(false);

  // Mark as read shortly after the list is viewed.
  useEffect(() => {
    if (!q.data || markedOnce.current || unread.length === 0) return;
    markedOnce.current = true;
    const t = window.setTimeout(() => mark.mutate(unread.map((n) => n.id)), 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  return (
    <>
      <PageHeader
        title="התראות"
        actions={
          <>
            {unread.length > 0 && (
              <Button variant="ghost" size="sm" icon={<CheckCheck className="size-4" aria-hidden="true" />} onClick={() => mark.mutate('all')}>
                סימון הכול כנקרא
              </Button>
            )}
            <ButtonLink to="/settings#notifications" variant="ghost" size="icon" aria-label="הגדרות התראות">
              <Settings className="size-[18px]" aria-hidden="true" />
            </ButtonLink>
          </>
        }
      />
      {q.isLoading ? (
        <ListSkeleton rows={4} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <Panel>
          <EmptyState icon={<Bell className="size-6" />} title="אין התראות" body="כאן יופיעו התאמות חדשות, פניות למודעות שלך והודעות חשבון." />
        </Panel>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {q.data.map((n) => {
            const d = describe(n, r);
            const inner = (
              <div className="flex gap-3 px-4 py-3.5">
                <span className={cn('mt-2 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-accent')} aria-hidden="true" />
                {n.actor ? <Avatar name={n.actor.full_name} src={n.actor.avatar_url} size={32} /> : <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-muted"><Bell className="size-4" aria-hidden="true" /></span>}
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[15px] leading-snug', n.read_at ? 'text-ink-2' : 'font-medium text-ink')}>
                    {!n.read_at && <span className="sr-only">חדש: </span>}
                    {d.title}
                  </p>
                  {d.body && <p className="mt-0.5 truncate text-sm text-muted">{d.body}</p>}
                  <p className="mt-1 text-xs text-muted">{relativeTimeHe(n.created_at)}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {d.to ? (
                  <Link to={d.to} className="block hover:bg-surface-2">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
