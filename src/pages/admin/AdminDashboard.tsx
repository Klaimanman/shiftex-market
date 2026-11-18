import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { PageHeader, Panel, Section } from '@/components/PageHeader';
import { ErrorState, Notice, Skeleton } from '@/components/ui/feedback';
import { useAdminStats } from '@/data/admin';

function Stat({ label, value, to }: { label: string; value: number | string; to?: string }) {
  const body = (
    <>
      <span className="text-sm text-muted">{label}</span>
      <span className="tabular mt-2 block text-2xl font-semibold text-ink">{value}</span>
    </>
  );
  return to ? (
    <Link to={to} className="rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong">
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border border-line bg-surface p-4">{body}</div>
  );
}

export function AdminDashboard() {
  const q = useAdminStats();
  const s = q.data;

  return (
    <>
      <PageHeader title="סקירה" subtitle="מצב הארגון והמשימות שמחכות לטיפול." />
      {q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !s ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          {(s.pending > 0 || s.periods_missing_times > 0 || !s.coordinator_email_set) && (
            <Section title="לטיפול">
              <Panel className="divide-y divide-line">
                {s.pending > 0 && <Todo to="/admin/members?status=pending" text={`${s.pending} בקשות הצטרפות ממתינות לאישור`} />}
                {s.periods_missing_times > 0 && <Todo to="/admin/shifts" text="להגדיר שעות התחלה וסיום למשמרות (משפיע על תפוגת מודעות)" />}
                {!s.coordinator_email_set && <Todo to="/admin/settings" text="להגדיר את כתובת המייל של רכז השיבוץ" />}
              </Panel>
            </Section>
          )}
          <Section title="מספרים">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              <Stat label="עובדים פעילים" value={s.active_members} to="/admin/members" />
              <Stat label="ממתינים לאישור" value={s.pending} to="/admin/members?status=pending" />
              <Stat label="מושעים / חסומים" value={s.suspended} to="/admin/members?status=restricted" />
              <Stat label="מודעות פתוחות" value={s.open_listings} to="/admin/listings" />
              <Stat label="מודעות ב-7 הימים האחרונים" value={s.listings_7d} />
              <Stat label="משמרות שנלקחו (30 יום)" value={s.closed_taken_30d} />
            </div>
          </Section>
          <Notice className="mt-8">כל פעולת ניהול נרשמת ביומן הפעולות. הרשאות נאכפות בשרת, גם אם מישהו עוקף את הממשק.</Notice>
        </>
      )}
    </>
  );
}

function Todo({ to, text }: { to: string; text: string }) {
  return (
    <Link to={to} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-2">
      <span className="flex items-center gap-3">
        <span className="size-2 rounded-full bg-warn" aria-hidden="true" />
        {text}
      </span>
      <ChevronLeft className="size-4 text-muted" aria-hidden="true" />
    </Link>
  );
}
