import { useState } from 'react';
import { PageHeader, Panel } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { useAuditLog, useAdminMembers } from '@/data/admin';
import { formatNumeric, instantToISODate, instantToLocalTime } from '@/domain/dates';
import { MEMBER_STATUS_LABEL } from '@/domain/labels';
import type { MemberStatus } from '@/domain/types';

const ACTIONS: Record<string, string> = {
  bootstrap: 'הקמת הארגון',
  member_status: 'שינוי סטטוס עובד',
  member_role: 'שינוי הרשאה',
  member_badges: 'עדכון תגים',
  invite_create: 'יצירת קוד הזמנה',
  invite_revoke: 'ביטול קוד הזמנה',
  listing_remove: 'הסרת מודעה',
  self_delete: 'מחיקת חשבון עצמית',
};

function actionLabel(a: string): string {
  if (ACTIONS[a]) return ACTIONS[a];
  const [op, table] = a.split(':');
  const t: Record<string, string> = { positions: 'עמדה', badges: 'תג', badge_positions: 'שיוך תג לעמדה', shift_periods: 'משמרת', organization_settings: 'הגדרות ארגון' };
  const o: Record<string, string> = { insert: 'הוספת', update: 'עדכון', delete: 'מחיקת' };
  return `${o[op] ?? op} ${t[table] ?? table ?? ''}`.trim();
}

export function AdminAudit() {
  const [page, setPage] = useState(0);
  const q = useAuditLog(page);
  const members = useAdminMembers();
  const name = (id: string | null) => (id ? members.data?.find((m) => m.user_id === id)?.full_name ?? 'משתמש שנמחק' : 'מערכת');

  return (
    <>
      <PageHeader title="יומן פעולות" subtitle="רישום קבוע של פעולות ניהול. לא ניתן לערוך או למחוק רשומות." />
      {q.isLoading ? <ListSkeleton rows={5} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <Panel><EmptyState title="אין רשומות" /></Panel>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {q.data.map((e) => {
            const target = e.target_type === 'member' && e.target_id ? name(e.target_id) : null;
            const status = e.action === 'member_status' ? (e.details as { to?: MemberStatus }).to : undefined;
            return (
              <li key={e.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className="tabular w-32 shrink-0 font-mono text-xs text-muted" dir="ltr" style={{ textAlign: 'right' }}>
                  {formatNumeric(instantToISODate(e.created_at))} {instantToLocalTime(e.created_at)}
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{actionLabel(e.action)}</span>
                  {target && <span className="text-ink-2"> · {target}</span>}
                  {status && <span className="text-ink-2"> → {MEMBER_STATUS_LABEL[status]}</span>}
                </span>
                <span className="text-xs text-muted">{name(e.actor_id)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>חדשות יותר</Button>
        <Button variant="secondary" size="sm" disabled={(q.data?.length ?? 0) < 50} onClick={() => setPage((p) => p + 1)}>ישנות יותר</Button>
      </div>
    </>
  );
}
