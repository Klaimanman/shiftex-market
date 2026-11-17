import { PublicShell } from '@/components/AppShell';
import { ButtonLink } from '@/components/ui/button';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'מה נשמר',
    body: 'שם מלא, כתובת המייל מחשבון Google, מספר טלפון נייד, תמונת פרופיל (רשות), התגים וההסמכות שלך, והמודעות שפרסמת. לא נשמרות סיסמאות.',
  },
  {
    title: 'מי רואה מה',
    body: 'רק עובדים מאושרים בארגון רואים את המודעות ואת השם שלך. מספר הטלפון לא מוצג ברשימות — הוא נחשף רק כשעמית פונה אליך בנוגע למודעה פעילה, וכל חשיפה נרשמת. מנהלי המערכת בארגון רואים פרטי קשר לצורך ניהול.',
  },
  {
    title: 'למה',
    body: 'כדי לאפשר תיאום החלפות משמרות בין עמיתים. ShiftEX Market אינו מנהל את סידור העבודה הרשמי ואינו מאשר העברות — האחריות לעדכון רכז השיבוץ היא של העובדים.',
  },
  {
    title: 'כמה זמן',
    body: 'מודעות סגורות נמחקות אוטומטית אחרי תקופה שההנהלה מגדירה (ברירת מחדל 90 יום). התראות נמחקות אחרי 60 יום. אפשר למחוק את החשבון בכל עת ממסך ההגדרות, וכל הנתונים האישיים נמחקים איתו.',
  },
  {
    title: 'אבטחה',
    body: 'הגישה מאובטחת בהתחברות Google, וכל הרשאה נאכפת בשרת הנתונים עצמו (Row Level Security). המידע מאוחסן אצל Supabase ומוגש דרך Cloudflare.',
  },
];

export function PrivacyPage() {
  return (
    <PublicShell>
      <article className="mx-auto w-full max-w-2xl py-8">
        <h1 className="text-xl font-semibold">פרטיות ושימוש במידע</h1>
        <p className="mt-2 text-sm text-muted">בקצרה ובשפה פשוטה.</p>
        <div className="mt-8 divide-y divide-line rounded-lg border border-line bg-surface">
          {SECTIONS.map((s) => (
            <section key={s.title} className="px-5 py-5">
              <h2 className="font-medium text-ink">{s.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{s.body}</p>
            </section>
          ))}
        </div>
        <ButtonLink to="/" variant="secondary" className="mt-6">
          חזרה
        </ButtonLink>
      </article>
    </PublicShell>
  );
}
