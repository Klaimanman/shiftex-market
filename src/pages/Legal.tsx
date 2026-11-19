import { Link } from 'react-router-dom';
import { PublicShell } from '@/components/AppShell';
import { ButtonLink } from '@/components/ui/button';
import { Ltr } from '@/components/ui/controls';
import { CONTACT_EMAIL } from '@/config';

export const STATEMENT_DATE = '18/11/2026';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

/** Statement of independent development, non-commercial use, and privacy & security. */
export function LegalPage() {
  return (
    <PublicShell>
      <article className="mx-auto w-full max-w-2xl space-y-4 py-8">
        <h1 className="text-xl font-semibold">הצהרה, פרטיות ואבטחה</h1>
        <p className="text-sm text-muted">נכון לתאריך {STATEMENT_DATE}</p>

        <Block title="פיתוח עצמאי">
          <p>
            ShiftEX Market פותחה באופן עצמאי, כפרויקט אישי, ואינה קשורה לאף ארגון, חברה או אתר אחר. המערכת נבנתה על ידי בינה
            מלאכותית (<Ltr>Claude</Ltr>) לפי הנחיות המפתח, לרבות הקוד, העיצוב, המבנה ובחירת הצבעים, ללא השראה מגורם או מאתר אחר.
          </p>
          <p>
            המערכת משתמשת ברכיבי קוד פתוח מוכרים, בהתאם לרישיונות שלהם: אייקונים מספריית <Ltr>Lucide</Ltr> (רישיון <Ltr>ISC</Ltr>), הגופנים{' '}
            <Ltr>IBM Plex</Ltr> (רישיון <Ltr>SIL OFL</Ltr>), וספריות פיתוח כמו <Ltr>React</Ltr> ו-<Ltr>Tailwind CSS</Ltr> (רישיון <Ltr>MIT</Ltr>).
          </p>
        </Block>

        <Block title="שימוש לא מסחרי">
          <p>נכון לתאריך {STATEMENT_DATE}, אין במערכת שימוש מסחרי: היא ניתנת ללא תשלום, ללא פרסומות וללא מכירה של מידע.</p>
          <p>
            המערכת היא כלי תיאום בלבד. היא אינה מנהלת את סידור העבודה הרשמי ואינה מאשרת העברות משמרת; האחריות לעדכון רכז השיבוץ היא של
            העובדים.
          </p>
        </Block>

        <Block title="הגנת פרטיות">
          <ul className="list-disc space-y-1.5 ps-5">
            <li>נאסף רק המינימום הדרוש: שם, מייל מחשבון Google, טלפון נייד, תגים והמודעות שפרסמת. לא נשמרות סיסמאות.</li>
            <li>המידע אינו נמכר, אינו מועבר לצד שלישי לצורכי שיווק, ואין באתר פרסומות, כלי מעקב או כלי סטטיסטיקה חיצוניים.</li>
            <li>רק עובדים שאושרו על ידי מנהל הקבוצה רואים את הלוח. האתר מסומן כך שמנועי חיפוש לא יאנדקסו אותו.</li>
            <li>מספר הטלפון אינו מוצג ברשימות. הוא נחשף רק לעמית שמתאם איתך משמרת מסוימת, וכל חשיפה נרשמת.</li>
            <li>כתובת המייל שלך זמינה רק לעובדים מאושרים בקבוצה, לצורך הוספה בעותק למייל לאחראי הסידור. היא לא מוצגת לאף גורם מחוץ לקבוצה.</li>
            <li>מודעות סגורות נמחקות אוטומטית אחרי תקופה קצובה. אפשר למחוק את החשבון בכל עת, וכל המידע האישי נמחק איתו.</li>
          </ul>
          <p>
            פירוט מלא נמצא ב<Link to="/privacy" className="font-medium text-accent underline underline-offset-2">מדיניות הפרטיות</Link>.
          </p>
        </Block>

        <Block title="אבטחת מידע">
          <ul className="list-disc space-y-1.5 ps-5">
            <li>כניסה מאובטחת עם חשבון Google בלבד. ההצטרפות דורשת קוד הזמנה וגם אישור ידני של מנהל.</li>
            <li>כל ההרשאות נאכפות בשרת הנתונים עצמו (<Ltr>Row Level Security</Ltr>), ולא רק במסך. גם ניסיון לעקוף את האתר נחסם.</li>
            <li>כל התקשורת מוצפנת (<Ltr>HTTPS</Ltr>), ומוגדרות הגנות דפדפן מחמירות נגד הזרקת קוד והטמעת האתר באתרים אחרים.</li>
            <li>חסימה או השעיה של עובד נכנסות לתוקף מיד. כל פעולת ניהול נרשמת ביומן שאי אפשר למחוק.</li>
            <li>אין בקוד המערכת סיסמאות או מפתחות סודיים. המידע מאוחסן אצל ספק ענן מוכר (<Ltr>Supabase</Ltr>) בשרתים באירופה.</li>
            <li>מתבצעות בדיקות אבטחה אוטומטיות לכל שינוי בקוד.</li>
          </ul>
          <p>
            אנו נוקטים אמצעים סבירים ומקובלים להגנה על המידע. עם זאת, אף מערכת מקוונת אינה חסינה לחלוטין. אם עולה חשש לחשיפת מידע,
            נעדכן את המשתמשים בהקדם.
          </p>
        </Block>

        <Block title="יצירת קשר">
          <p>
            לשאלות, לבקשה למחיקת מידע או לדיווח על בעיה:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-accent underline underline-offset-2">
              <Ltr>{CONTACT_EMAIL}</Ltr>
            </a>
            .
          </p>
        </Block>

        <ButtonLink to="/" variant="secondary" className="mt-2">
          חזרה
        </ButtonLink>
      </article>
    </PublicShell>
  );
}
