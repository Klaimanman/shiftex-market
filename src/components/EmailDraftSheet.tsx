import { useEffect, useState } from 'react';
import { Copy, Mail } from 'lucide-react';
import { Sheet } from './ui/sheet';
import { Button, buttonClass } from './ui/button';
import { Field, Input, Textarea } from './ui/field';
import { Notice } from './ui/feedback';
import { useToast } from './ui/toast';
import { useOrgSettings } from '@/data/reference';
import { fetchContact } from '@/data/listings';
import { buildMailto, composeCoordinatorEmail, type TransferEmail } from '@/domain/messages';
import { emailSchema } from '@/domain/validation';

/**
 * Prepares (never sends) an email to the scheduling coordinator via mailto:.
 * The app never claims the email was sent or that the transfer is approved.
 */
export function EmailDraftSheet({
  open,
  onOpenChange,
  data,
  cc: ccSource,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: TransferEmail;
  /** The other guard in the swap, to be CC'd. userId null = the listing owner. */
  cc?: { listingId: string; userId: string | null } | null;
}) {
  const settings = useOrgSettings();
  const toast = useToast();
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [ccName, setCcName] = useState('');
  const [ccLoading, setCcLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!open) return;
    const c = composeCoordinatorEmail(data);
    setSubject(c.subject);
    setBody(c.body);
    setTo(settings.data?.coordinator_email ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, settings.data?.coordinator_email]);

  // Fetch the other guard's email (audited server-side) to CC them.
  useEffect(() => {
    if (!open || !ccSource) return;
    let cancelled = false;
    setCcLoading(true);
    fetchContact(ccSource.listingId, ccSource.userId)
      .then((c) => {
        if (cancelled) return;
        setCc(c.email ?? '');
        setCcName(c.full_name);
      })
      .catch(() => {
        /* leave empty; the user can type it */
      })
      .finally(() => !cancelled && setCcLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, ccSource?.listingId, ccSource?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const validTo = emailSchema.safeParse(to).success;
  const validCc = !cc.trim() || emailSchema.safeParse(cc).success;
  const href = validTo && validCc ? buildMailto(to, subject, body, cc) : undefined;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="טיוטת מייל לרכז השיבוץ"
      description="הטיוטה נפתחת באפליקציית המייל שלך, עם המאבטח השני בעותק. השליחה והאישור הרשמי מתבצעים שם, לא ב-ShiftEX."
      footer={
        <div className="flex gap-2">
          <a
            href={href}
            aria-disabled={!href}
            onClick={(e) => {
              if (!href) e.preventDefault();
            }}
            className={buttonClass('primary', 'md', `flex-1 ${href ? '' : 'pointer-events-none opacity-50'}`)}
          >
            <Mail className="size-4" aria-hidden="true" />
            פתיחת הטיוטה במייל
          </a>
          <Button
            variant="secondary"
            icon={<Copy className="size-4" aria-hidden="true" />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${subject}\n\n${body}`);
                toast.success('הטקסט הועתק');
              } catch {
                toast.error('לא הצלחנו להעתיק.');
              }
            }}
          >
            העתקה
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {!settings.isLoading && !settings.data?.coordinator_email && (
          <Notice tone="warn">כתובת רכז השיבוץ עדיין לא הוגדרה על ידי ההנהלה. אפשר להזין כתובת ידנית.</Notice>
        )}
        <Field label="אל" error={to && !validTo ? 'כתובת מייל לא תקינה' : null}>
          <Input value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" className="text-right" inputMode="email" autoComplete="email" />
        </Field>
        <Field
          label="עותק (CC) למאבטח השני"
          error={!validCc ? 'כתובת מייל לא תקינה' : null}
          hint={ccLoading ? 'טוען את המייל…' : ccName ? `${ccName} יקבל/תקבל עותק, וכך יראה/תראה את אישור רכז השיבוץ.` : 'כדאי להוסיף את המאבטח השני בחילוף כדי שיקבל את האישור.'}
        >
          <Input value={cc} onChange={(e) => setCc(e.target.value)} dir="ltr" className="text-right" inputMode="email" placeholder="name@gmail.com" />
        </Field>
        <Field label="נושא">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
        </Field>
        <Field label="תוכן" hint="אפשר לערוך את כל הפרטים לפני הפתיחה.">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={11} maxLength={1500} className="font-sans" />
        </Field>
      </div>
    </Sheet>
  );
}
