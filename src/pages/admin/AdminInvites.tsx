import { useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import { PageHeader, Panel } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Ltr, Tag } from '@/components/ui/controls';
import { Field, Input } from '@/components/ui/field';
import { EmptyState, ErrorState, ListSkeleton, Notice } from '@/components/ui/feedback';
import { ConfirmDialog, Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useCreateInvite, useInvites, useRevokeInvite, type Invite } from '@/data/admin';
import { addDays, formatNumeric, instantToISODate, todayIL, zonedToInstant } from '@/domain/dates';

function inviteState(i: Invite): { label: string; tone: 'accent' | 'neutral' | 'danger' } {
  if (i.revoked_at) return { label: 'בוטל', tone: 'danger' };
  if (i.expires_at && new Date(i.expires_at) <= new Date()) return { label: 'פג תוקף', tone: 'neutral' };
  if (i.use_count >= i.max_uses) return { label: 'נוצל', tone: 'neutral' };
  return { label: 'פעיל', tone: 'accent' };
}

export function AdminInvites() {
  const q = useInvites();
  const revoke = useRevokeInvite();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<Invite | null>(null);

  return (
    <>
      <PageHeader
        title="קודי הזמנה"
        subtitle="קוד מצרף עובד לארגון במצב ״ממתין לאישור״. הקוד נשמר מוצפן ומוצג פעם אחת בלבד."
        actions={<Button size="sm" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setCreating(true)}>קוד חדש</Button>}
      />
      {q.isLoading ? <ListSkeleton rows={2} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <Panel><EmptyState title="אין קודי הזמנה" body="יוצרים קוד ושולחים אותו לעובדים בערוץ פנימי." action={<Button onClick={() => setCreating(true)}>יצירת קוד</Button>} /></Panel>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {q.data.map((i) => {
            const st = inviteState(i);
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <Ltr className="font-mono text-sm tracking-wider text-ink-2">{i.code_hint}</Ltr>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{i.label || 'ללא תיאור'}</span>
                  <span className="tabular block text-sm text-muted">
                    {i.use_count}/{i.max_uses} שימושים
                    {i.expires_at && ` · עד ${formatNumeric(instantToISODate(i.expires_at))}`}
                  </span>
                </span>
                <Tag tone={st.tone}>{st.label}</Tag>
                {st.label === 'פעיל' && (
                  <Button variant="ghost" size="sm" onClick={() => setRevoking(i)}>ביטול</Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Notice className="mt-6">כדאי להחליף קוד מדי פעם ולבטל קודים שדלפו. ביטול קוד לא משפיע על עובדים שכבר הצטרפו.</Notice>
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
  const create = useCreateInvite();
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState('50');
  const [days, setDays] = useState('30');
  const [code, setCode] = useState<string | null>(null);

  const submit = async () => {
    const uses = Math.min(1000, Math.max(1, Number(maxUses) || 1));
    const d = Number(days);
    const expiresAt = d > 0 ? zonedToInstant(addDays(todayIL(), d), '23:59').toISOString() : null;
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
          <Button
            variant="secondary"
            className="w-full"
            icon={<Copy className="size-4" aria-hidden="true" />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                toast.success('הקוד הועתק');
              } catch {
                toast.error('לא הצלחנו להעתיק');
              }
            }}
          >
            העתקה
          </Button>
          <Notice tone="warn">זו הפעם היחידה שהקוד מוצג. כדאי להעתיק אותו עכשיו ולשלוח רק בערוץ פנימי.</Notice>
        </div>
      ) : (
        <div className="space-y-5">
          <Field label="תיאור" optional hint="למשל: גיוס נובמבר">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="מספר שימושים">
              <Input type="number" inputMode="numeric" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
            </Field>
            <Field label="תוקף (ימים)" hint="0 = ללא הגבלה">
              <Input type="number" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
            </Field>
          </div>
        </div>
      )}
    </Sheet>
  );
}
