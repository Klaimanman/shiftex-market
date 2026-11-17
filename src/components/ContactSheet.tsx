import { useEffect, useState } from 'react';
import { Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { Sheet } from './ui/sheet';
import { Button, buttonClass } from './ui/button';
import { Field, Textarea } from './ui/field';
import { ErrorState, Notice, Skeleton } from './ui/feedback';
import { Ltr } from './ui/controls';
import { useToast } from './ui/toast';
import { fetchContact, type Contact } from '@/data/listings';
import { buildWhatsAppUrl } from '@/domain/messages';
import { formatILMobile } from '@/domain/phone';

/**
 * WhatsApp contact composer. The phone number is fetched on demand through the
 * audited get_contact() RPC. The message is always reviewed/edited by the user and
 * sent from their own WhatsApp — never automatically.
 */
export function ContactSheet({
  open,
  onOpenChange,
  listingId,
  userId,
  buildMessage,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listingId: string;
  /** contact a specific interested member (owner flow); omit to contact the listing owner */
  userId?: string | null;
  buildMessage: (recipientName: string) => string;
}) {
  const toast = useToast();
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await fetchContact(listingId, userId);
      setContact(c);
      setText(buildMessage(c.full_name));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !contact) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const href = contact?.phone ? buildWhatsAppUrl(contact.phone, text) : undefined;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="פנייה בוואטסאפ"
      description="ההודעה לא נשלחת אוטומטית — היא נפתחת בוואטסאפ, ושם אפשר לערוך ולשלוח."
      footer={
        contact?.phone ? (
          <div className="flex gap-2">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass('primary', 'md', 'flex-1')}
              onClick={() => onOpenChange(false)}
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              פתיחה בוואטסאפ
              <ExternalLink className="size-3.5 opacity-70" aria-hidden="true" />
            </a>
            <Button
              variant="secondary"
              icon={<Copy className="size-4" aria-hidden="true" />}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  toast.success('ההודעה הועתקה');
                } catch {
                  toast.error('לא הצלחנו להעתיק. אפשר לסמן ולהעתיק ידנית.');
                }
              }}
            >
              העתקה
            </Button>
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={load} title="לא ניתן לפנות כרגע" />
      ) : contact ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border border-line bg-surface-2 px-3 py-2.5">
            <span className="font-medium">{contact.full_name}</span>
            {contact.phone ? <Ltr className="tabular font-mono text-sm text-ink-2">{formatILMobile(contact.phone)}</Ltr> : <span className="text-sm text-muted">אין מספר</span>}
          </div>
          {!contact.phone && <Notice tone="warn">לעמית הזה עדיין לא שמור מספר טלפון.</Notice>}
          <Field label="ההודעה" aside={<span className="tabular text-xs text-muted">{text.length}</span>}>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={1000} />
          </Field>
          <p className="text-xs text-muted">פנייה לא מסמנת את המשמרת כנלקחה. בעל המודעה סוגר אותה כשמסכמים.</p>
        </div>
      ) : null}
    </Sheet>
  );
}
