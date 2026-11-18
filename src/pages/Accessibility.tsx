import { Link } from 'react-router-dom';
import { PublicShell } from '@/components/AppShell';
import { ButtonLink } from '@/components/ui/button';
import { Ltr } from '@/components/ui/controls';
import { ACCESSIBILITY_REVIEWED, CONTACT_EMAIL } from '@/config';
import { formatNumeric } from '@/domain/dates';

const DONE = [
  'ממשק מלא בעברית עם כיווניות מימין לשמאל, ותמיכה נכונה בטקסט משולב (מספרי טלפון, שעות, מיילים).',
  'ניווט מלא במקלדת: קישור "דילוג לתוכן", סימון פוקוס ברור, חלונות קופצים שלוכדים פוקוס ונסגרים ב-Esc, וקבוצות בחירה שעובדות עם החצים.',
  'תמיכה בקוראי מסך: כותרות מסודרות, תוויות לכל שדה, הודעות שגיאה שמוקראות אוטומטית, והודעות מערכת באזור חי (aria-live).',
  'ניגודיות צבעים ברמה AA בשני מצבי התצוגה: בהיר וכהה.',
  'מידע לא מועבר באמצעות צבע בלבד: לכל סוג מודעה ומשמרת יש גם תווית טקסט.',
  'אזורי לחיצה גדולים לשימוש נוח בטלפון, ואפשרות הגדלה של הדף (זום) ללא הגבלה.',
  'כיבוד ההגדרה "הפחתת תנועה" של מערכת ההפעלה (האנימציות מתבטלות).',
  'שעות מוצגות בפורמט 24 שעות, ותאריכים בעברית.',
];

const LIMITS = [
  'בורר התאריך במודעות משתמש ברכיב המובנה של הדפדפן, ולכן תצוגתו תלויה בשפת המכשיר.',
  'הודעות הוואטסאפ והמייל נפתחות באפליקציות חיצוניות שאינן בשליטת המערכת.',
];

export function AccessibilityPage() {
  return (
    <PublicShell>
      <article className="mx-auto w-full max-w-2xl py-8">
        <h1 className="text-xl font-semibold">הצהרת נגישות</h1>
        <p className="mt-2 text-ink-2">
          ShiftEX Market נבנה כך שיהיה שמיש לכל העובדים, כולל אנשים עם מוגבלות. המערכת פותחה בהתאם להנחיות{' '}
          <Ltr>WCAG 2.1</Ltr> ברמה <Ltr>AA</Ltr> ולתקן הישראלי ת״י 5568, ונבדקה בכלי בדיקה אוטומטי (<Ltr>axe</Ltr>) ובבדיקה ידנית
          של ניווט במקלדת.
        </p>

        <section className="mt-8 rounded-lg border border-line bg-surface p-5">
          <h2 className="font-semibold">מה נעשה</h2>
          <ul className="mt-3 list-disc space-y-2 ps-5 text-sm leading-relaxed text-ink-2">
            {DONE.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>

        <section className="mt-4 rounded-lg border border-line bg-surface p-5">
          <h2 className="font-semibold">מגבלות ידועות</h2>
          <ul className="mt-3 list-disc space-y-2 ps-5 text-sm leading-relaxed text-ink-2">
            {LIMITS.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>

        <section className="mt-4 rounded-lg border border-line bg-surface p-5">
          <h2 className="font-semibold">נתקלת בבעיית נגישות?</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            נשמח לדעת ולתקן. אפשר לפנות במייל{' '}
            <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('ShiftEX Market: נגישות')}`} className="font-medium text-accent underline underline-offset-2">
              <Ltr>{CONTACT_EMAIL}</Ltr>
            </a>{' '}
            או דרך <Link to="/contact" className="font-medium text-accent underline underline-offset-2">טופס יצירת הקשר</Link>. כדאי לציין
            באיזה מסך הבעיה, מה ניסית לעשות, ובאיזה מכשיר ודפדפן.
          </p>
        </section>

        <p className="mt-6 text-xs text-muted">
          ההצהרה עודכנה לאחרונה: <span className="tabular">{formatNumeric(ACCESSIBILITY_REVIEWED)}</span>
        </p>
        <ButtonLink to="/" variant="secondary" className="mt-6">
          חזרה
        </ButtonLink>
      </article>
    </PublicShell>
  );
}
