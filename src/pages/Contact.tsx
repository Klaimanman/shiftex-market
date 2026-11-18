import { useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { PublicShell } from '@/components/AppShell';
import { Button, ButtonLink } from '@/components/ui/button';
import { Ltr, Segmented } from '@/components/ui/controls';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Notice } from '@/components/ui/feedback';
import { CONTACT_EMAIL } from '@/config';
import { buildMailto } from '@/domain/messages';

type Topic = 'bug' | 'accessibility' | 'idea' | 'other';
const TOPICS: Record<Topic, string> = { bug: 'תקלה', accessibility: 'נגישות', idea: 'הצעה לשיפור', other: 'אחר' };

/** Contact the developers. Opens the user's own mail app — nothing is sent from the site. */
export function ContactPage() {
  const [topic, setTopic] = useState<Topic>('bug');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 5) {
      setError('יש לכתוב כמה מילים על הפנייה');
      return;
    }
    setError(null);
    const body = [message.trim(), '', '', name.trim() ? `שם: ${name.trim()}` : '', `נשלח מ: ${window.location.origin}`, `דפדפן: ${navigator.userAgent}`]
      .filter((l, i, a) => l !== '' || a[i - 1] !== '')
      .join('\n');
    window.location.href = buildMailto(CONTACT_EMAIL, `ShiftEX Market: ${TOPICS[topic]}`, body);
  };

  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-xl py-8">
        <h1 className="text-xl font-semibold">יצירת קשר עם המפתחים</h1>
        <p className="mt-2 text-ink-2">
          מצאת תקלה, בעיית נגישות או שיש לך רעיון לשיפור? נשמח לשמוע. אפשר לכתוב ישירות אל{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-accent underline underline-offset-2">
            <Ltr>{CONTACT_EMAIL}</Ltr>
          </a>{' '}
          או למלא את הטופס.
        </p>

        <form onSubmit={submit} noValidate className="mt-8 space-y-5 rounded-lg border border-line bg-surface p-4 sm:p-5">
          <div>
            <p id="topic-label" className="mb-2 text-sm font-medium">נושא</p>
            <Segmented<Topic>
              label="נושא הפנייה"
              value={topic}
              onChange={setTopic}
              options={(Object.keys(TOPICS) as Topic[]).map((t) => ({ value: t, label: TOPICS[t] }))}
            />
          </div>
          <Field label="שם" optional>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
          </Field>
          <Field label="הפנייה" error={error} hint={topic === 'bug' ? 'מה ניסית לעשות, מה קרה, ובאיזה מסך.' : undefined}>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} maxLength={1500} />
          </Field>
          <Button type="submit" className="w-full sm:w-auto" icon={<Mail className="size-4" aria-hidden="true" />}>
            פתיחת המייל לשליחה
          </Button>
          <Notice>הטופס פותח את אפליקציית המייל שלך עם הפנייה מוכנה. השליחה עצמה מתבצעת משם.</Notice>
        </form>

        <ButtonLink to="/" variant="secondary" className="mt-6">
          חזרה
        </ButtonLink>
      </div>
    </PublicShell>
  );
}
