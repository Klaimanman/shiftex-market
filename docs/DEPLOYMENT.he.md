# העלאה לאוויר — מדריך צעד אחר צעד

המדריך מעלה את ShiftEX Market לאוויר **בחינם**, בלי ידע בתכנות. זמן משוער: 45–60 דקות, פעם אחת.

שלושה שירותים חינמיים מעורבים:

| שירות | תפקיד | מה צריך |
|---|---|---|
| **GitHub** | שמירת הקוד | חשבון |
| **Supabase** | מסד נתונים + התחברות עם Google | חשבון (אפשר להיכנס עם GitHub) |
| **Google Cloud** | כפתור "כניסה עם Google" | חשבון Google |
| **Cloudflare Pages** | האתר עצמו (כתובת שאפשר לשלוח לאנשים) | חשבון |

> שמרו בצד קובץ טקסט עם הערכים שתעתיקו בדרך (כתובות ומפתחות). **אף פעם** אל תעלו אותו ל-GitHub.

---

## שלב 1 — העלאת הקוד ל-GitHub

1. נכנסים ל-<https://github.com> ונרשמים (אם אין חשבון).
2. מתקינים את **GitHub Desktop**: <https://desktop.github.com>, ומתחברים עם החשבון.
3. ב-GitHub Desktop: `File → Add local repository` ובוחרים את התיקייה `ShiftEX Market`.
   - אם מופיעה הודעה שזו לא תיקיית Git: לוחצים **create a repository** ← `Create repository`.
4. בתחתית משמאל כותבים בתיבת Summary: `Initial commit` ולוחצים **Commit to main**.
5. לוחצים **Publish repository**:
   - Name: `shiftex-market`
   - **מבטלים** את הסימון ב-"Keep this code private" אם רוצים מאגר ציבורי (כמו שביקשת).
   - לוחצים **Publish**.

### הגנה על המאגר (רק את/ה יכול/ה לשנות קוד)
מאגר ציבורי = כולם יכולים **לקרוא** את הקוד, אבל רק בעלים ומשתפים שהוזמנו יכולים **לשנות**. בנוסף:

1. ב-GitHub: `Settings → Collaborators` — לוודא שאין משתפים שלא רוצים.
2. `Settings → Branches → Add branch ruleset` (או Branch protection rule) על `main`:
   סימון **Require a pull request before merging** ו-**Block force pushes**.
3. `Settings → Actions → General`: תחת *Fork pull request workflows* לבחור **Require approval for all outside collaborators**.

> אין בקוד שום סוד. המפתחות האמיתיים נשמרים רק בהגדרות של Cloudflare ו-Supabase.

---

## שלב 2 — מסד הנתונים (Supabase)

1. נכנסים ל-<https://supabase.com> → **Start your project** → נרשמים.
2. **New project**:
   - Name: `shiftex`
   - Database Password: לוחצים *Generate* ו**שומרים** בקובץ הצדדי.
   - Region: **Central EU (Frankfurt)** (הכי קרוב לישראל).
   - Plan: **Free**.
3. מחכים כ-2 דקות עד שהפרויקט מוכן.

### הרצת קבצי מסד הנתונים
1. בתפריט הצד: **SQL Editor** → **New query**.
2. פותחים במחשב את התיקייה `supabase/migrations` ומריצים את 4 הקבצים **לפי הסדר**. לכל קובץ:
   פותחים אותו ב-Notepad, מעתיקים הכול (Ctrl+A, Ctrl+C), מדביקים ב-SQL Editor, ולוחצים **Run**.
   1. `20261117000001_core_schema.sql`
   2. `20261117000002_functions.sql`
   3. `20261117000003_rls.sql`
   4. `20261117000004_platform.sql`
   
   אחרי כל אחד צריך להופיע **Success. No rows returned**. אם מופיעה שגיאה — עוצרים ובודקים את סעיף "תקלות נפוצות".

### העתקת הכתובת והמפתח
1. **Project Settings** (גלגל שיניים) → **API Keys** (או **Data API**).
2. מעתיקים לקובץ הצדדי:
   - **Project URL** — נראה כמו `https://abcdefgh.supabase.co`
   - **Publishable key** — מתחיל ב-`sb_publishable_` (בפרויקטים ישנים: ה-`anon` key).
   
   ⚠️ **לא** להעתיק את ה-*secret* / *service_role* key לשום מקום.

---

## שלב 3 — כניסה עם Google (Google Cloud)

1. נכנסים ל-<https://console.cloud.google.com> → למעלה **Select a project → New Project** → שם: `ShiftEX` → Create.
2. בתפריט: **APIs & Services → OAuth consent screen** (או **Google Auth Platform**):
   - App name: `ShiftEX Market`
   - User support email: המייל שלך
   - Audience / User type: **External**
   - Contact email: המייל שלך → Save.
3. **Audience** (או *Publishing status*) → **Publish app** → Confirm.
   > חשוב! במצב "Testing" רק 100 אנשים יכולים להיכנס וההתחברות פגה כל 7 ימים. אנחנו מבקשים רק שם ומייל, אז לא צריך אימות של Google.
4. **Clients** (או **Credentials → Create credentials → OAuth client ID**):
   - Application type: **Web application**
   - Name: `ShiftEX`
   - **Authorized redirect URIs** → Add URI:
     `https://<הכתובת-שלך>.supabase.co/auth/v1/callback`
     (את הכתובת לוקחים מהשלב הקודם: Project URL + `/auth/v1/callback`).
   - Create → מעתיקים **Client ID** ו-**Client secret** לקובץ הצדדי.
5. חוזרים ל-Supabase: **Authentication → Sign In / Providers → Google** → מפעילים (Enable), מדביקים Client ID ו-Client Secret → **Save**.

---

## שלב 4 — האתר (Cloudflare Pages)

1. נכנסים ל-<https://dash.cloudflare.com> ונרשמים.
2. **Workers & Pages → Create → Pages → Connect to Git** → מחברים את GitHub ובוחרים את `shiftex-market`.
   > אם מוצג רק מסך של Workers: בוחרים **Import a repository**. ההגדרות למטה זהות.
3. הגדרות Build:
   - Framework preset: **None** (או Vite)
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Environment variables** → מוסיפים:
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | ה-Project URL משלב 2 |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | ה-Publishable key משלב 2 |
   | `NODE_VERSION` | `22` |
5. **Save and Deploy**. אחרי 1–3 דקות מקבלים כתובת כמו `https://shiftex-market.pages.dev` — זו הכתובת לשליחה לעובדים.

---

## שלב 5 — חיבור הכתובת להתחברות

ב-Supabase: **Authentication → URL Configuration**:
- **Site URL**: הכתובת מ-Cloudflare, למשל `https://shiftex-market.pages.dev`
- **Redirect URLs** → Add URL:
  - `https://shiftex-market.pages.dev/auth/callback`
  - (לפיתוח מקומי, רשות) `http://localhost:5173/auth/callback`
- Save.

---

## שלב 6 — הפיכת עצמך למנהל (פעם אחת)

1. פותחים את האתר → **כניסה עם Google** עם החשבון שלך.
2. ממלאים שם וטלפון → **המשך**. במסך "קוד הזמנה" **עוצרים** (אין עדיין קוד).
3. במחשב פותחים את `supabase/setup/setup.local.sql` (הקובץ הזה **לא** עולה ל-GitHub).
   - מחליפים את `YOUR_EMAIL@gmail.com` במייל שאיתו נכנסת.
   - אפשר לשנות את שם הארגון במקום `'ShiftEX'`.
4. מעתיקים את כל הקובץ ל-Supabase → **SQL Editor** → **Run**.
5. מרעננים את האתר — עכשיו את/ה מנהל/ת, ויש לשונית **ניהול**.

הקובץ יוצר את 4 המשמרות (בוקר, צהריים, לילה, כונן), את 6 העמדות ואת 3 התגים:

| תג | נותן הסמכה ל- |
|---|---|
| סיור | סיור 50, סיור 51 |
| מוסמך מסוף | מסוף |
| מאבטח בכיר | סיור 53, אולם נוסעים |
| — | קשמ״ז פתוחה לכולם |

**כדאי לבדוק את המיפוי הזה** ב-ניהול → תגים והסמכות, ולתקן לפי המציאות.

---

## שלב 7 — הגדרה ראשונית במסך הניהול

1. **ניהול → משמרות**: מזינים שעות התחלה וסיום לכל משמרת (לילה: למשל 23:00–07:00). השעות קובעות מתי מודעה נסגרת אוטומטית.
2. **ניהול → הגדרות ארגון**: מזינים את המייל של רכז/ת השיבוץ.
3. **ניהול → קודי הזמנה → קוד חדש**: מעתיקים את הקוד (הוא מוצג פעם אחת בלבד!).
4. שולחים לעובדים: את כתובת האתר + הקוד, בערוץ פנימי (למשל קבוצת הוואטסאפ של הצוות).
5. כל עובד שנרשם מופיע ב-**ניהול → עובדים → ממתינים**. בודקים שהתגים נכונים ולוחצים **אישור הצטרפות**.

### התקנה בטלפון (כמו אפליקציה)
- **אייפון**: פותחים ב-Safari → כפתור השיתוף → **הוספה למסך הבית**.
- **אנדרואיד**: פותחים ב-Chrome → תפריט ⋮ → **התקנת אפליקציה**.

---

## שלב 8 — שמירה על השרת ער (מומלץ)

ב-Supabase החינמי, פרויקט "נרדם" אחרי שבוע בלי שימוש. אם משתמשים כל יום — לא יקרה. ליתר ביטחון:

1. ב-GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_URL` = ה-Project URL
   - `SUPABASE_PUBLISHABLE_KEY` = ה-Publishable key
2. **Actions** → *Keep Supabase awake* → **Run workflow** (בדיקה). מעכשיו זה ירוץ לבד כל 3 ימים.

> אם הפרויקט בכל זאת נרדם: ב-Supabase לוחצים **Restore project**. הנתונים לא נמחקים.

---

## עדכונים בעתיד

כל שינוי שנשמר ב-GitHub (Commit + Push ב-GitHub Desktop) עולה לאוויר אוטומטית תוך דקות. Cloudflare בונה מחדש לבד.

---

## תקלות נפוצות

| מה רואים | מה עושים |
|---|---|
| "האפליקציה עוד לא מחוברת לשרת" | חסרים משתני סביבה ב-Cloudflare (שלב 4.4). מוסיפים ← **Deployments → Retry deployment**. |
| אחרי Google חוזרים למסך הכניסה / שגיאת redirect | בודקים את שלב 5 (Redirect URLs) ואת ה-redirect URI ב-Google (שלב 3.4) — חייבים להיות בדיוק אותה כתובת. |
| "Error 400: redirect_uri_mismatch" | ה-URI ב-Google חייב להיות `https://<ref>.supabase.co/auth/v1/callback`. |
| "Access blocked: app is in testing" | שלב 3.3 — Publish app. |
| שגיאה בהרצת קובץ SQL: "already exists" | הקובץ כבר הורץ. ממשיכים לקובץ הבא. |
| שגיאה ב-setup: "No user with email" | קודם נכנסים לאתר עם Google עם המייל הזה, ואז מריצים שוב. |
| שגיאה ב-setup: "Already bootstrapped" | הארגון כבר קיים — אין צורך להריץ שוב. |
| עובד/ת לא רואה משמרות בעמדה מסוימת | העמדה דורשת הסמכה — ניהול → עובדים → בוחרים עובד → מוסיפים תג. |
| מודעות לא נסגרות בזמן | לא הוגדרו שעות למשמרת (שלב 7.1). |
