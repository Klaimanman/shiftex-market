/** Maps database error keys and network failures to clear Hebrew messages. */

const MESSAGES: Record<string, string> = {
  not_authenticated: 'פג תוקף ההתחברות. יש להתחבר מחדש.',
  not_member: 'החשבון אינו פעיל בארגון.',
  forbidden: 'אין הרשאה לפעולה הזו.',
  not_found: 'הפריט לא נמצא. ייתכן שהוא נמחק או נסגר.',
  not_qualified: 'המשמרת דורשת הסמכה (תג) שלא מופיעה בפרופיל שלך.',
  owner_not_qualified: 'למפרסם המודעה אין הסמכה לעמדה שהוצעה בתמורה.',
  date_out_of_range: 'אפשר לבחור תאריך מהיום ועד 60 יום קדימה.',
  shift_started: 'המשמרת כבר התחילה, אי אפשר לפרסם אותה.',
  invalid_listing: 'חסרים פרטים במודעה.',
  special_shift_incomplete: 'למשמרת מיוחדת יש לתת שם ושעות התחלה וסיום.',
  invalid_period: 'המשמרת שנבחרה לא קיימת.',
  invalid_position: 'העמדה שנבחרה לא קיימת או לא פעילה.',
  want_dates_required: 'יש לבחור לפחות תאריך אחד.',
  no_qualified_positions: 'לא נמצאו עמדות שמתאימות להסמכות בפרופיל שלך.',
  too_many_active: 'הגעת למספר המרבי של מודעות פעילות. אפשר לסגור מודעה קיימת ולנסות שוב.',
  rate_limited: 'בוצעו יותר מדי פעולות בזמן קצר. כדאי לנסות שוב מאוחר יותר.',
  listing_closed: 'המודעה כבר סגורה.',
  listing_expired: 'תוקף המודעה פג.',
  own_listing: 'זו מודעה שלך.',
  invalid_status: 'אי אפשר לשנות את הסטטוס הזה.',
  immutable_field: 'אי אפשר לשנות את סוג המודעה.',
  invalid_member: 'יש לבחור עמית פעיל אחר.',
  invalid_offer: 'המשמרת שהוצעה בתמורה כבר לא זמינה.',
  invalid_note: 'ההערה ארוכה מדי.',
  member_unavailable: 'החשבון של העמית לא פעיל כרגע.',
  invalid_phone: 'מספר נייד ישראלי לא תקין. לדוגמה: 050-1234567',
  phone_taken: 'מספר הטלפון כבר רשום לחשבון אחר.',
  invalid_name: 'יש להזין שם מלא.',
  invalid_avatar: 'קובץ התמונה לא תקין.',
  profile_incomplete: 'יש להשלים קודם את הפרטים האישיים.',
  banned: 'הגישה לחשבון בוטלה.',
  already_member: 'החשבון כבר רשום בארגון.',
  too_many_attempts: 'יותר מדי ניסיונות שגויים. אפשר לנסות שוב בעוד שעה.',
  invalid_code: 'קוד ההזמנה שגוי, פג תוקף או נוצל עד הסוף.',
  cannot_target_self: 'אי אפשר לבצע את הפעולה הזו על החשבון שלך.',
  last_admin: 'חייב להישאר לפחות מנהל אחד פעיל.',
  invalid_transition: 'אי אפשר לבצע את השינוי הזה במצב הנוכחי.',
  invalid_expiry: 'תאריך התפוגה חייב להיות בעתיד.',
  too_many_saved_searches: 'אפשר לשמור עד 10 חיפושים.',
  conflict: 'המודעה עודכנה בינתיים. הנתונים רועננו ואפשר לנסות שוב.',
  duplicate: 'כבר קיימת מודעה פעילה זהה.',
  in_use: 'אי אפשר למחוק פריט שנמצא בשימוש. אפשר להשבית אותו במקום.',
  network: 'אין חיבור לשרת כרגע. כדאי לבדוק את החיבור ולנסות שוב.',
  unknown: 'משהו השתבש. כדאי לנסות שוב.',
};

export class AppError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? MESSAGES[code] ?? MESSAGES.unknown);
    this.name = 'AppError';
  }
}

interface PgLike { code?: string; message?: string; details?: string }

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const err = (e ?? {}) as PgLike & { name?: string };
  const msg = String(err.message ?? '');
  if (MESSAGES[msg]) return new AppError(msg);
  if (err.code === '23505') return new AppError('duplicate');
  if (err.code === '23503') return new AppError('in_use');
  if (err.code === '42501' || /row-level security|permission denied/i.test(msg)) return new AppError('forbidden');
  if (err.code === 'PGRST116') return new AppError('not_found');
  if (/Failed to fetch|NetworkError|Load failed|fetch failed|ERR_NETWORK|timeout/i.test(msg)) {
    return new AppError('network');
  }
  if (import.meta.env.DEV) console.error(e);
  return new AppError('unknown');
}

export function errorMessage(e: unknown): string {
  return toAppError(e).message;
}

/** Unwraps a Supabase response, throwing a mapped AppError. */
export function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw toAppError(res.error);
  return res.data as T;
}
