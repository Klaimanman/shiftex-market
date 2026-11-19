import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Copy, Mail, UserRound } from 'lucide-react';
import { Sheet } from './ui/sheet';
import { Button, buttonClass } from './ui/button';
import { Field, Input, Textarea } from './ui/field';
import { Notice } from './ui/feedback';
import { Ltr } from './ui/controls';
import { useToast } from './ui/toast';
import { useOrgSettings } from '@/data/reference';
import { fetchContact, searchColleagues, type Colleague } from '@/data/listings';
import { buildMailto, composeCoordinatorEmail, type TransferEmail } from '@/domain/messages';
import { emailSchema } from '@/domain/validation';

/**
 * Prepares (never sends) the email to the scheduling coordinator via mailto:,
 * in the organization's format, with the other guard in CC so both see the approval.
 * Typing a name or email in the CC field suggests colleagues; picking one fills
 * both the CC address and the second guard's name in the email.
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
  /** The other guard in the swap, prefilled when known. userId null = the listing owner. */
  cc?: { listingId: string; userId: string | null } | null;
}) {
  const settings = useOrgSettings();
  const toast = useToast();
  const listId = useId();
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [guard2Name, setGuard2Name] = useState(data.guard2.name);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [bodyEdited, setBodyEdited] = useState(false);
  const [suggestions, setSuggestions] = useState<Colleague[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchSeq = useRef(0);

  const composed = useMemo(
    () => composeCoordinatorEmail({ ...data, guard2: { ...data.guard2, name: guard2Name } }),
    [data, guard2Name],
  );

  // Reset when (re)opened.
  useEffect(() => {
    if (!open) return;
    setGuard2Name(data.guard2.name);
    setBodyEdited(false);
    setCc('');
    setTo(settings.data?.coordinator_email ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && !to && settings.data?.coordinator_email) setTo(settings.data.coordinator_email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.data?.coordinator_email]);

  // Keep subject/body in sync with the structured data until the user edits the body by hand.
  useEffect(() => {
    if (!open) return;
    setSubject(composed.subject);
    if (!bodyEdited) setBody(composed.body);
  }, [open, composed, bodyEdited]);

  // Prefill the counterpart (audited server-side).
  useEffect(() => {
    if (!open || !ccSource) return;
    let cancelled = false;
    fetchContact(ccSource.listingId, ccSource.userId)
      .then((c) => {
        if (cancelled) return;
        if (c.email) setCc(c.email);
      })
      .catch(() => {
        /* leave empty; the user can search */
      });
    return () => {
      cancelled = true;
    };
  }, [open, ccSource?.listingId, ccSource?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCcChange = (value: string) => {
    setCc(value);
    const seq = ++searchSeq.current;
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    window.setTimeout(async () => {
      if (seq !== searchSeq.current) return;
      try {
        const found = await searchColleagues(value);
        if (seq !== searchSeq.current) return;
        setSuggestions(found);
        setShowSuggestions(true);
        // An exact email match fills the name automatically.
        const exact = found.find((f) => f.email.toLowerCase() === value.trim().toLowerCase());
        if (exact) setGuard2Name(exact.full_name);
      } catch {
        setSuggestions([]);
      }
    }, 250);
  };

  const pick = (c: Colleague) => {
    setCc(c.email);
    setGuard2Name(c.full_name);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const validTo = emailSchema.safeParse(to).success;
  const validCc = !cc.trim() || emailSchema.safeParse(cc).success;
  const href = validTo && validCc ? buildMailto(to, subject, body, cc) : undefined;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="מייל לאחראי הסידור"
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
          <Notice tone="warn">כתובת אחראי הסידור עדיין לא הוגדרה על ידי ההנהלה. אפשר להזין כתובת ידנית.</Notice>
        )}
        <Field label="אל (אחראי הסידור)" error={to && !validTo ? 'כתובת מייל לא תקינה' : null}>
          <Input value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" className="text-right" inputMode="email" autoComplete="email" />
        </Field>

        <div className="relative">
          <Field
            label="עותק (CC): המאבטח השני"
            error={!validCc ? 'כתובת מייל לא תקינה' : null}
            hint="אפשר להקליד שם או מייל של מאבטח ולבחור מהרשימה."
          >
            <Input
              value={cc}
              onChange={(e) => onCcChange(e.target.value)}
              onFocus={() => suggestions.length && setShowSuggestions(true)}
              onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
              role="combobox"
              aria-expanded={showSuggestions && suggestions.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              className="text-right"
              autoComplete="off"
              placeholder="שם או מייל"
            />
          </Field>
          {showSuggestions && suggestions.length > 0 && (
            <ul id={listId} role="listbox" className="absolute inset-x-0 top-[4.6rem] z-10 overflow-hidden rounded-md border border-line bg-surface shadow-pop">
              {suggestions.map((s) => (
                <li key={s.user_id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-surface-2 focus:bg-surface-2"
                  >
                    <UserRound className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{s.full_name}</span>
                      <Ltr className="block truncate text-sm text-muted">{s.email}</Ltr>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Field label="שם המאבטח השני" hint="ממלאים ידנית, או בוחרים מאבטח בשדה העותק למעלה.">
          <Input value={guard2Name} onChange={(e) => setGuard2Name(e.target.value)} maxLength={80} />
        </Field>

        <Field label="נושא">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
        </Field>
        <Field label="תוכן" hint="אפשר לערוך את כל הפרטים לפני הפתיחה.">
          <Textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setBodyEdited(true);
            }}
            rows={13}
            maxLength={1500}
            className="font-sans"
          />
        </Field>
      </div>
    </Sheet>
  );
}
