import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ShieldCheck } from 'lucide-react';
import { PageHeader, Panel } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Avatar, Chip, Ltr, Segmented, Tag } from '@/components/ui/controls';
import { Field, Input, Textarea } from '@/components/ui/field';
import { EmptyState, ErrorState, ListSkeleton, Notice } from '@/components/ui/feedback';
import { ConfirmDialog, Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useBadges } from '@/data/reference';
import { useMe } from '@/data/session';
import { useAdminMembers, useSetMemberBadges, useSetMemberRole, useSetMemberStatus, type AdminMember } from '@/data/admin';
import { MEMBER_STATUS_LABEL } from '@/domain/labels';
import { formatILMobile } from '@/domain/phone';
import { formatNumeric, instantToISODate } from '@/domain/dates';
import type { MemberStatus } from '@/domain/types';

type Tab = 'pending' | 'active' | 'restricted' | 'all';

export function AdminMembers() {
  const [sp, setSp] = useSearchParams();
  const tab = (['pending', 'active', 'restricted', 'all'].includes(sp.get('status') ?? '') ? sp.get('status') : 'active') as Tab;
  const q = useAdminMembers();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminMember | null>(null);

  const counts = useMemo(() => {
    const all = q.data ?? [];
    return {
      pending: all.filter((m) => m.status === 'pending').length,
      active: all.filter((m) => m.status === 'active').length,
      restricted: all.filter((m) => ['suspended', 'banned', 'rejected'].includes(m.status)).length,
      all: all.length,
    };
  }, [q.data]);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? [])
      .filter((m) =>
        tab === 'all' ? true : tab === 'restricted' ? ['suspended', 'banned', 'rejected'].includes(m.status) : m.status === tab,
      )
      .filter((m) => !s || m.full_name.toLowerCase().includes(s) || (m.email ?? '').includes(s) || (m.phone ?? '').includes(s.replace(/\D/g, '') || '§'));
  }, [q.data, tab, search]);

  const current = selected ? q.data?.find((m) => m.user_id === selected.user_id) ?? selected : null;

  return (
    <>
      <PageHeader title="עובדים" subtitle="אישור הצטרפות, תגים, הרשאות והשעיה." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented<Tab>
          label="סינון לפי סטטוס"
          size="sm"
          value={tab}
          onChange={(t) => setSp({ status: t }, { replace: true })}
          className="sm:max-w-lg sm:flex-1"
          options={[
            { value: 'pending', label: `ממתינים (${counts.pending})` },
            { value: 'active', label: `פעילים (${counts.active})` },
            { value: 'restricted', label: `מוגבלים (${counts.restricted})` },
            { value: 'all', label: 'הכול' },
          ]}
        />
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש שם, מייל או טלפון" className="h-10 ps-9" aria-label="חיפוש עובדים" />
        </div>
      </div>

      {q.isLoading ? (
        <ListSkeleton rows={4} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState compact title={tab === 'pending' ? 'אין בקשות ממתינות' : 'לא נמצאו עובדים'} />
        </Panel>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {rows.map((m) => (
            <li key={m.user_id}>
              <button type="button" onClick={() => setSelected(m)} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-surface-2">
                <Avatar name={m.full_name} src={m.avatar_url} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="truncate">{m.full_name || '(ללא שם)'}</span>
                    {m.role === 'admin' && <ShieldCheck className="size-4 shrink-0 text-accent" aria-label="מנהל" />}
                  </span>
                  <span className="block truncate text-sm text-muted">
                    <Ltr>{m.email}</Ltr>
                  </span>
                </span>
                <span className="hidden text-sm text-muted sm:block">
                  <Ltr className="tabular font-mono">{formatILMobile(m.phone)}</Ltr>
                </span>
                <StatusBadge status={m.status} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {current && <MemberSheet member={current} onClose={() => setSelected(null)} />}
    </>
  );
}

function StatusBadge({ status }: { status: MemberStatus }) {
  const tone = status === 'active' ? 'accent' : status === 'pending' ? 'warn' : status === 'banned' ? 'danger' : 'neutral';
  return <Tag tone={tone}>{MEMBER_STATUS_LABEL[status]}</Tag>;
}

function MemberSheet({ member: m, onClose }: { member: AdminMember; onClose: () => void }) {
  const me = useMe();
  const toast = useToast();
  const badges = useBadges();
  const setStatus = useSetMemberStatus();
  const setRole = useSetMemberRole();
  const setBadges = useSetMemberBadges();
  const [badgeIds, setBadgeIds] = useState<string[]>(m.badge_ids);
  const [action, setAction] = useState<{ status: MemberStatus; title: string; label: string; danger?: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const isSelf = m.user_id === me.user_id;
  const badgesChanged = [...badgeIds].sort().join() !== [...m.badge_ids].sort().join();

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e);
      throw e;
    }
  };

  const approve = async () => {
    await run(async () => {
      if (badgesChanged) await setBadges.mutateAsync({ userId: m.user_id, badgeIds });
      await setStatus.mutateAsync({ userId: m.user_id, status: 'active' });
    }, 'העובד/ת אושר/ה');
    onClose();
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={m.full_name || 'עובד/ת'}
      description={<>הצטרפות: {formatNumeric(instantToISODate(m.created_at))}</>}
      size="lg"
    >
      <div className="space-y-6">
        <dl className="divide-y divide-line rounded-md border border-line text-sm">
          <div className="flex justify-between gap-4 px-3 py-2.5">
            <dt className="text-muted">סטטוס</dt>
            <dd><StatusBadge status={m.status} /></dd>
          </div>
          <div className="flex justify-between gap-4 px-3 py-2.5">
            <dt className="text-muted">מייל</dt>
            <dd className="truncate"><Ltr>{m.email}</Ltr></dd>
          </div>
          <div className="flex justify-between gap-4 px-3 py-2.5">
            <dt className="text-muted">טלפון</dt>
            <dd><Ltr className="tabular font-mono">{formatILMobile(m.phone) || ''}</Ltr></dd>
          </div>
          {m.status_reason && (
            <div className="flex justify-between gap-4 px-3 py-2.5">
              <dt className="text-muted">הערה</dt>
              <dd>{m.status_reason}</dd>
            </div>
          )}
        </dl>

        <div>
          <p className="mb-2 text-sm font-medium">תגים</p>
          {m.status === 'pending' && m.self_selected && <Notice className="mb-3">התגים נבחרו על ידי העובד/ת בהרשמה, יש לוודא שהם נכונים לפני האישור.</Notice>}
          <div className="flex flex-wrap gap-2">
            {(badges.data?.badges ?? []).map((b) => (
              <Chip key={b.id} selected={badgeIds.includes(b.id)} onToggle={() => setBadgeIds((s) => (s.includes(b.id) ? s.filter((x) => x !== b.id) : [...s, b.id]))}>
                {b.name}
              </Chip>
            ))}
            {!badges.data?.badges.length && <span className="text-sm text-muted">לא הוגדרו תגים.</span>}
          </div>
          {badgesChanged && m.status !== 'pending' && (
            <Button
              size="sm"
              className="mt-3"
              loading={setBadges.isPending}
              onClick={() => run(() => setBadges.mutateAsync({ userId: m.user_id, badgeIds }), 'התגים עודכנו').catch(() => {})}
            >
              שמירת תגים
            </Button>
          )}
        </div>

        {isSelf ? (
          <Notice>זה החשבון שלך, אי אפשר לשנות לו סטטוס מכאן.</Notice>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">פעולות</p>
            <div className="flex flex-wrap gap-2">
              {m.status === 'pending' && (
                <>
                  <Button loading={setStatus.isPending || setBadges.isPending} onClick={() => approve().catch(() => {})}>
                    אישור הצטרפות
                  </Button>
                  <Button variant="secondary" onClick={() => setAction({ status: 'rejected', title: 'דחיית הבקשה', label: 'דחייה' })}>
                    דחייה
                  </Button>
                </>
              )}
              {m.status === 'active' && (
                <>
                  <Button
                    variant="secondary"
                    loading={setRole.isPending}
                    onClick={() =>
                      run(() => setRole.mutateAsync({ userId: m.user_id, role: m.role === 'admin' ? 'employee' : 'admin' }), m.role === 'admin' ? 'הרשאת הניהול הוסרה' : 'מונה למנהל').catch(() => {})
                    }
                  >
                    {m.role === 'admin' ? 'הסרת הרשאת ניהול' : 'מינוי למנהל'}
                  </Button>
                  <Button variant="secondary" onClick={() => setAction({ status: 'suspended', title: 'השעיית החשבון', label: 'השעיה' })}>
                    השעיה
                  </Button>
                  <Button variant="danger" onClick={() => setAction({ status: 'banned', title: 'ביטול גישה לצמיתות', label: 'ביטול גישה', danger: true })}>
                    ביטול גישה
                  </Button>
                </>
              )}
              {m.status === 'suspended' && (
                <>
                  <Button onClick={() => run(() => setStatus.mutateAsync({ userId: m.user_id, status: 'active' }), 'החשבון הוחזר לפעילות').catch(() => {})} loading={setStatus.isPending}>
                    החזרה לפעילות
                  </Button>
                  <Button variant="danger" onClick={() => setAction({ status: 'banned', title: 'ביטול גישה לצמיתות', label: 'ביטול גישה', danger: true })}>
                    ביטול גישה
                  </Button>
                </>
              )}
              {(m.status === 'banned' || m.status === 'rejected') && <p className="text-sm text-muted">אין פעולות זמינות לסטטוס הזה.</p>}
            </div>
            {m.status === 'active' && <p className="text-xs text-muted">השעיה וביטול גישה נכנסים לתוקף מיד, והמודעות הפתוחות של העובד/ת מוסרות מהלוח.</p>}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!action}
        onOpenChange={(o) => {
          if (!o) {
            setAction(null);
            setReason('');
          }
        }}
        title={action?.title ?? ''}
        body={action?.status === 'banned' ? 'הגישה תבוטל מיד ולא ניתן יהיה להצטרף מחדש עם קוד.' : undefined}
        confirmLabel={action?.label ?? ''}
        tone={action?.danger ? 'danger' : 'primary'}
        onConfirm={async () => {
          if (!action) return;
          await run(() => setStatus.mutateAsync({ userId: m.user_id, status: action.status, reason }), 'הסטטוס עודכן');
          onClose();
        }}
      >
        <Field label="סיבה" optional hint="מוצגת לעובד/ת במסך החשבון.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} />
        </Field>
      </ConfirmDialog>
    </Sheet>
  );
}
