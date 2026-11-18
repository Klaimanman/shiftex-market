/**
 * Operational date utilities. All calendar logic happens in Asia/Jerusalem.
 * Calendar dates are plain `YYYY-MM-DD` strings — never JS Dates at local midnight —
 * so month/year boundaries and DST transitions cannot shift a day.
 */
export const TZ = 'Asia/Jerusalem';
export type ISODate = string;

export const WEEKDAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;
export const WEEKDAYS_SHORT_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'] as const;
export const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
] as const;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !ISO_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

function parts(d: ISODate): [number, number, number] {
  const [y, m, day] = d.split('-').map(Number);
  return [y, m, day];
}

function utcNoon(d: ISODate): Date {
  const [y, m, day] = parts(d);
  return new Date(Date.UTC(y, m - 1, day, 12));
}

/** Today's date in Israel. */
export function todayIL(now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(d: ISODate, n: number): ISODate {
  const t = utcNoon(d);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(d: ISODate): number {
  return utcNoon(d).getUTCDay();
}

/** Weeks start on Sunday. */
export function startOfWeek(d: ISODate): ISODate {
  return addDays(d, -dayOfWeek(d));
}

export function weekDays(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((utcNoon(to).getTime() - utcNoon(from).getTime()) / 86_400_000);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function dayNumber(d: ISODate): number {
  return parts(d)[2];
}

/** "17.11" */
export function formatDayMonth(d: ISODate): string {
  const [, m, day] = parts(d);
  return `${day}.${m}`;
}

/** "17.11.2026" */
export function formatNumeric(d: ISODate): string {
  const [y, m, day] = parts(d);
  return `${String(day).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}

/** "יום שלישי, 17 בנובמבר" */
export function formatLong(d: ISODate, withYear = false): string {
  const [y, m, day] = parts(d);
  return `יום ${WEEKDAYS_HE[dayOfWeek(d)]}, ${day} ב${MONTHS_HE[m - 1]}${withYear ? ` ${y}` : ''}`;
}

/** "ג׳ 17.11" */
export function formatShort(d: ISODate): string {
  return `${WEEKDAYS_SHORT_HE[dayOfWeek(d)]} ${formatDayMonth(d)}`;
}

/** "15–21 בנובמבר 2026" / "29 בנובמבר – 5 בדצמבר 2026" / "28 בדצמבר 2026 – 3 בינואר 2027" */
export function formatWeekRange(weekStart: ISODate): string {
  const end = addDays(weekStart, 6);
  const [y1, m1, d1] = parts(weekStart);
  const [y2, m2, d2] = parts(end);
  if (y1 !== y2) return `${d1} ב${MONTHS_HE[m1 - 1]} ${y1} - ${d2} ב${MONTHS_HE[m2 - 1]} ${y2}`;
  if (m1 !== m2) return `${d1} ב${MONTHS_HE[m1 - 1]} - ${d2} ב${MONTHS_HE[m2 - 1]} ${y2}`;
  // LRI…PDI keeps "15–21" in reading order inside right-to-left text.
  return `⁦${d1}-${d2}⁩ ב${MONTHS_HE[m1 - 1]} ${y1}`;
}

/** Strip Unicode bidi isolates (for comparisons / plain-text output). */
export const stripBidi = (s: string) => s.replace(/[⁦-⁩]/g, '');

/** Offset (minutes) of `tz` from UTC at a given instant. Israel: +120 or +180. */
export function tzOffsetMinutes(instant: Date, tz: string = TZ): number {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(instant).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUTC - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** Converts a local wall-clock time in Israel to an absolute instant (DST-aware). */
export function zonedToInstant(date: ISODate, time: string, tz: string = TZ): Date {
  const [y, m, d] = parts(date);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMinutes(new Date(guess), tz);
  let t = guess - off1 * 60000;
  const off2 = tzOffsetMinutes(new Date(t), tz);
  if (off2 !== off1) t = guess - off2 * 60000;
  return new Date(t);
}

/** "07:00:00" -> "07:00" */
export function formatTime(t: string | null | undefined): string | null {
  return t ? t.slice(0, 5) : null;
}

/** Relative time in Hebrew for timestamps ("לפני 5 דק׳"). */
export function relativeTimeHe(iso: string, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'עכשיו';
  if (min < 60) return `לפני ${min} דק׳`;
  const h = Math.floor(min / 60);
  if (h === 1) return 'לפני שעה';
  if (h === 2) return 'לפני שעתיים';
  if (h < 24) return `לפני ${h} שעות`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  return formatNumeric(todayIL(new Date(iso)));
}

/** Local Israel date of an instant. */
export function instantToISODate(iso: string): ISODate {
  return todayIL(new Date(iso));
}

/** "HH:MM" of an instant in Israel. */
export function instantToLocalTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}
