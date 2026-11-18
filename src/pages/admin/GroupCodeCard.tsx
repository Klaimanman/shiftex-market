import { useState } from 'react';
import { Copy, MessageCircle, RefreshCw, KeyRound } from 'lucide-react';
import { Button, buttonClass } from '@/components/ui/button';
import { Ltr } from '@/components/ui/controls';
import { Skeleton } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useCreateInvite, useInvites, useRevokeInvite, type Invite } from '@/data/admin';

export const UNLIMITED_USES = 1_000_000;

export function isActiveInvite(i: Invite): boolean {
  return !i.revoked_at && (!i.expires_at || new Date(i.expires_at) > new Date()) && i.use_count < i.max_uses;
}
export function isPermanent(i: Invite): boolean {
  return i.max_uses >= UNLIMITED_USES && !i.expires_at;
}

function inviteMessage(code: string): string {
  return [
    'הוזמנת להצטרף ל-ShiftEX Market, הלוח של הצוות למסירה, חיפוש והחלפה של משמרות.',
    '',
    `1. נכנסים לכתובת: ${window.location.origin}`,
    '2. כניסה עם Google, ממלאים שם וטלפון',
    `3. מזינים את קוד ההצטרפות: ${code}`,
    '4. מחכים לאישור שלי',
  ].join('\n');
}

/**
 * The group's permanent join code, always visible to admins with copy / WhatsApp share.
 * "Replace" creates a new permanent code first and only then retires the old one,
 * so the group is never left without a working code.
 */
export function GroupCodeCard() {
  const q = useInvites();
  const create = useCreateInvite();
  const revoke = useRevokeInvite();
  const toast = useToast();
  const [confirmRotate, setConfirmRotate] = useState(false);

  const current = (q.data ?? []).find((i) => isActiveInvite(i) && isPermanent(i) && i.code);

  const copy = async (text: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(ok);
    } catch {
      toast.error('לא הצלחנו להעתיק. אפשר לסמן ולהעתיק ידנית.');
    }
  };

  const createPermanent = async () => {
    const res = (await create.mutateAsync({ label: 'קוד קבוע', maxUses: UNLIMITED_USES, expiresAt: null })) as { id: string; code: string };
    return res;
  };

  return (
    <section aria-labelledby="group-code-title" className="rounded-lg border border-accent/30 bg-accent-soft p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-accent" aria-hidden="true" />
        <h2 id="group-code-title" className="font-semibold text-ink">קוד ההצטרפות של הקבוצה</h2>
      </div>

      {q.isLoading ? (
        <Skeleton className="mt-3 h-12 w-56" />
      ) : current?.code ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Ltr className="rounded-md border border-line bg-surface px-4 py-2.5 font-mono text-2xl font-semibold tracking-[0.18em] text-ink">
              {current.code}
            </Ltr>
            <span className="text-sm text-ink-2">
              קבוע · ללא תפוגה · <span className="tabular">{current.use_count}</span> הצטרפו
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" icon={<Copy className="size-4" aria-hidden="true" />} onClick={() => copy(current.code!, 'הקוד הועתק')}>
              העתקת הקוד
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(inviteMessage(current.code))}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass('secondary', 'sm')}
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              שליחה בוואטסאפ
            </a>
            <Button variant="secondary" size="sm" icon={<Copy className="size-4" aria-hidden="true" />} onClick={() => copy(inviteMessage(current.code!), 'ההזמנה המלאה הועתקה')}>
              העתקת הזמנה מלאה
            </Button>
            <Button variant="ghost" size="sm" className="ms-auto" icon={<RefreshCw className="size-4" aria-hidden="true" />} onClick={() => setConfirmRotate(true)}>
              החלפה בקוד חדש
            </Button>
          </div>
          <p className="mt-3 text-xs text-ink-2">כל מי שנרשם עם הקוד מגיע אליך לאישור. אם הקוד דלף מחוץ לצוות, מחליפים אותו בקוד חדש.</p>
        </>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-ink-2">אין כרגע קוד קבוע פעיל, ולכן עובדים חדשים לא יכולים להצטרף.</p>
          <Button
            size="sm"
            loading={create.isPending}
            onClick={async () => {
              try {
                await createPermanent();
                toast.success('נוצר קוד קבוע חדש');
              } catch (e) {
                toast.error(e);
              }
            }}
          >
            יצירת קוד קבוע
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title="להחליף את הקוד?"
        body="ייווצר קוד קבוע חדש, והקוד הנוכחי יפסיק לעבוד. עובדים שכבר הצטרפו לא מושפעים."
        confirmLabel="החלפה בקוד חדש"
        onConfirm={async () => {
          try {
            await createPermanent();
            if (current) await revoke.mutateAsync(current.id);
            toast.success('הקוד הוחלף. אפשר לשלוח את הקוד החדש לצוות.');
          } catch (e) {
            toast.error(e);
            throw e;
          }
        }}
      />
    </section>
  );
}
