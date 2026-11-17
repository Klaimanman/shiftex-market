import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, CalendarRange, MessageCircle, ShieldCheck } from 'lucide-react';
import { PublicShell } from '@/components/AppShell';
import { Logo } from '@/components/Logo';
import { Notice } from '@/components/ui/feedback';
import { Spinner } from '@/components/ui/feedback';
import { signInWithGoogle } from '@/data/session';
import { errorMessage } from '@/lib/errors';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}

const POINTS = [
  { icon: CalendarRange, title: 'לוח שבועי אחד', body: 'כל המשמרות שמוסרים, מחפשים ומחליפים — לפי תאריך ומשמרת, במקום גלילה בקבוצות.' },
  { icon: ArrowLeftRight, title: 'התאמות מדויקות', body: 'המערכת מציגה רק משמרות שמתאימות להסמכות שלך, ומתריעה כשמשהו רלוונטי עולה.' },
  { icon: MessageCircle, title: 'סגירה בוואטסאפ', body: 'פנייה ישירה עם הודעה מוכנה, וטיוטת מייל לרכז השיבוץ — הכול בשליטתך.' },
];

export function WelcomePage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <PublicShell>
      <div className="grid flex-1 items-center gap-12 py-8 lg:grid-cols-[1.1fr_1fr] lg:py-16">
        <section>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted" dir="ltr" style={{ textAlign: 'right' }}>
            Your shift. Your choice.
          </p>
          <h1 className="mt-4 text-2xl font-semibold leading-tight text-ink sm:text-[36px] sm:leading-[1.15]">
            שוק המשמרות של הצוות.
            <br />
            <span className="text-muted">מסודר, הוגן ופרטי.</span>
          </h1>
          <p className="mt-4 max-w-md text-md text-ink-2">
            מקום אחד למסור משמרת, למצוא משמרת או להתחלף — בלי לאבד הודעות בקבוצות.
          </p>

          <div className="mt-8 max-w-sm space-y-3">
            <button
              type="button"
              onClick={start}
              disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-line-strong bg-surface text-base font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition-colors hover:bg-surface-2 disabled:opacity-60"
            >
              {busy ? <Spinner className="size-5" /> : <GoogleIcon />}
              כניסה עם Google
            </button>
            {error && <Notice tone="danger">{error}</Notice>}
            <p className="flex items-start gap-2 text-sm text-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              הגישה בהזמנה בלבד. אחרי הכניסה יש להזין קוד הזמנה ולחכות לאישור ההנהלה.
            </p>
          </div>
        </section>

        <section aria-label="מה אפשר לעשות" className="rounded-lg border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <Logo withMarket size="md" />
            <span className="font-mono text-2xs uppercase tracking-[0.14em] text-muted">private board</span>
          </div>
          <ul className="divide-y divide-line">
            {POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4 px-5 py-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-medium text-ink">{title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-4 text-xs text-muted">
        <span>ShiftEX Market הוא כלי תיאום. העברת משמרת רשמית מתבצעת מול רכז השיבוץ לפי נהלי העבודה.</span>
        <Link to="/privacy" className="underline underline-offset-2 hover:text-ink">פרטיות</Link>
      </footer>
    </PublicShell>
  );
}
