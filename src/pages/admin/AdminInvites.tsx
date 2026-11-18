import { useState } from 'react';
import { Copy, Infinity as InfinityIcon, Plus } from 'lucide-react';
import { PageHeader, Panel } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Ltr, Switch, Tag } from '@/components/ui/controls';
import { Field, Input } from '@/components/ui/field';
import { EmptyState, ErrorState, ListSkeleton, Notice } from '@/components/ui/feedback';
import { ConfirmDialog, Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useCreateInvite, useInvites, useRevokeInvite, type Invite } from '@/data/admin';
import { addDays, formatNumeric, instantToISODate, todayIL, zonedToInstant } from '@/domain/dates';
import { cn } from '@/lib/cn';

export const UNLIMITED_USES = 1_000_000;

function inviteState(i: Invite): { label: string; tone: 'accent' | 'neutral' | 'danger'; active: boolean } {
  if (i.revoked_at) return { label: 'בוטל', tone: 'danger', active: false };
  if (i.expires_at && new Date(i.expires_at) <= new Date()) return { label: 'פג תוקף', tone: 'neutral', active: false };
  if (i.use_count >= i.max_uses) return { label: 'נוצל', tone: 'neutral', active: false };
  return { label: 'פעיל', tone: 'accent', active: true };
}

function useCopy() {
  const toast = useToast();
  return async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('הקוד הועתק');
    } catch {
      toast.error('לא הצלחנו להעתיק. אפשר לסמן ולהעתיק ידנית.');
    }
  };
}

export function AdminInvites() {
  const q = useInvites();
  const revoke = useRevokeInvite();
  const toast = useToast();
  const copy = useCopy();
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<Invite | null>(null);

  return (
    <>
      <PageHeader
        title="קודי הזמנה"
        subtitle="קוד מצרף עובד לארגון במצב ״ממתין לאישור״. רק מנהלים רואים את הקודים."
        actions={<Button size="sm" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setCreating(true)}>קוד חדש</Button>}
      />
      {q.isLoading ? <ListSkeleton rows={2} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <Panel><EmptyState title="אין קודי הזמנה" body="יוצרים קוד קבוע ושולחים אותו לעובדים בערוץ פנימי." action={<Button onClick={() => setCreating(true)}>יצירת קוד</Button>} /></Panel>
      ) : (
        <ul className="space-y-2">
          {q.data.map((i) => {
            const st = inviteState(i);
            const unlimited = i.max_uses >= UNLIMITED_USES;
            return (
              <li key={i.id} className={cn('rounded-lg border border-line bg-surface p-4', !st.active && 'opacity-60')}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{i.label || 'ללא תיאור'}</span>
                    <span className="tabular mt-0.5 flex items-center gap-1 text-sm text-muted">
                      {unlimited ? (
                        <>
                          <InfinityIcon className="size-3.5" aria-hidden="true" /> ללא הגבלה · {i.use_count} הצטרפו
                        </>
                      ) : (
                        <>{i.use_count}/{i.max_uses} שימושים</>
                      )}
                      {i.expires_at ? ` · עד ${formatNumeric(instantToISODate(i.expires_at))}` : ' · ללא תפוגה'}
                    </span>
                  </span>
                  <Tag tone={st.tone}>{st.label}</Tag>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {i.code ? (
                    <>
                      <Ltr className="rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-lg font-semibold tracking-[0.18em]">{i.code}</Ltr>
                      {st.active && (
                        <Button variant="secondary" size="sm" icon={<Copy className="size-4" aria-hidden="true" />} onClick={() => copy(i.code!)}>
                          העתקה
                        </Button>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-muted">
                      קוד ישן (<Ltr className="font-mono">{i.code_hint}</Ltr>) — לא נשמר לתצוגה. אפשר ליצור קוד חדש.
                    </span>
                  )}
                  {st.active && (
                    <Button variant="ghost" size="sm" className="ms-auto text-danger" onClick={() => setRevoking(i)}>
                      ביטול הקוד
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Notice className="mt-6">אם קוד דלף מחוץ לצוות — מבטלים אותו ויוצרים חדש. ביטול לא משפיע על עובדים שכבר הצטרפו, וכל הצטרפות עדיין דורשת את האישור שלך.</Notice>
      {creating && <CreateInviteSheet onClose={() => setCreating(false)} />}
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title="לבטל את הקוד?"
        body="לא ניתן יהיה להצטרף איתו יותר."
        confirmLabel="ביטול הקוד"
        tone="danger"
        onConfirm={async () => {
          try {
            await revoke.mutateAsync(revoking!.id);
            toast.success('הקוד בוטל');
          } catch (e) {
            toast.error(e);
            throw e;
          }
        }}
      />
    </>
  );
}

function CreateInviteSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const copy = useCopy();
  const create = useCreateInvite();
  const [label, setLabel] = useState('קוד קבוע');
  const [permanent, setPermanent] = useState(true);
  const [maxUses, setMaxUses] = useState('50');
  const [days, setDays] = useState('30');
  const [code, setCode] = useState<string | null>(null);

  const submit = async () => {
    const uses = permanent ? UNLIMITED_USES : Math.min(UNLIMITED_USES, Math.max(1, Number(maxUses) || 1));
    const d = Number(days);
    const expiresAt = !permanent && d > 0 ? zonedToInstant(addDays(todayIL(), d), '23:59').toISOString() : null;
    try {
      const res = (await create.mutateAsync({ label: label.trim(), maxUses: uses, expiresAt })) as { id: string; code: string };
      setCode(res.code);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={code ? 'הקוד נוצר' : 'קוד הזמנה חדש'}
      footer={code ? <Button className="w-full" onClick={onClose}>סיום</Button> : <Button className="w-full" onClick={submit} loading={create.isPending}>יצירת קוד</Button>}
    >
      {code ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface-2 p-5 text-center">
            <Ltr className="font-mono text-2xl font-semibold tracking-[0.2em]">{code}</Ltr>
          </div>
          <Button variant="secondary" className="w-full" icon={<Copy className="size-4" aria-hidden="true" />} onClick={() => copy(code)}>
            העתקה
          </Button>
          <Notice>הקוד נשמר ותמיד יופיע כאן במסך קודי ההזמנה.</Notice>
        </div>
      ) : (
        <div className="space-y-5">
          <Field label="תיאור" optional>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
          </Field>
          <div className="rounded-md border border-line px-3">
            <Switch checked={permanent} onChange={setPermanent} label="קוד קבוע" description="ללא תפוגה וללא הגבלת מספר הצטרפויות." />
          </div>
          {!permanent && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="מספר שימושים">
                <Input type="number" inputMode="numeric" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
              </Field>
              <Field label="תוקף (ימים)" hint="0 = ללא הגבלה">
                <Input type="number" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
              </Field>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
