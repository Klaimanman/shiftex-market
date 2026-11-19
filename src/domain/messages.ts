/**
 * WhatsApp + coordinator-email composition. Nothing here sends anything:
 * the user always reviews and edits the text, then their own app sends it.
 * Wording is gender-neutral.
 */
import { dayOfWeek, formatLong, formatNumeric, WEEKDAYS_HE, type ISODate } from './dates';
import type { ListingType } from './types';
import { toWhatsAppNumber } from './phone';

export interface ShiftDescription {
  date: ISODate | null;
  /** e.g. "בוקר" or a custom title */
  shiftName: string;
  position: string | null;
  times?: string | null;
  hasOption?: boolean;
}

export function firstName(full: string): string {
  return (full || '').trim().split(/\s+/)[0] || '';
}

export function describeShift(s: ShiftDescription): string {
  const parts = [`משמרת ${s.shiftName}`];
  if (s.position) parts.push(`בעמדת ${s.position}`);
  if (s.date) parts.push(`ב${formatLong(s.date)}`);
  return parts.join(' ');
}

export function composeWhatsAppMessage(type: ListingType, recipientName: string, shift: ShiftDescription, wantedSummary?: string): string {
  const hi = `היי ${firstName(recipientName)},`.replace(' ,', ',');
  switch (type) {
    case 'offer':
      return `${hi} ראיתי ב-ShiftEX Market את המודעה על ${describeShift(shift)}. רציתי לבדוק אם היא עדיין רלוונטית.`;
    case 'exchange':
      return `${hi} ראיתי ב-ShiftEX Market את ההצעה להחלפת ${describeShift(shift)}. אשמח לבדוק אם נוכל להתחלף.`;
    case 'seek':
      return `${hi} ראיתי ב-ShiftEX Market שמחפשים ${wantedSummary || 'משמרת'}. ייתכן שיש לי משמרת שמתאימה, רציתי לבדוק אם זה עדיין רלוונטי.`;
  }
}

export function buildWhatsAppUrl(phoneE164: string, text: string): string {
  return `https://wa.me/${toWhatsAppNumber(phoneE164)}?text=${encodeURIComponent(text)}`;
}

/** Text used when a guard has no shift on one side of the swap (plain hand-over). */
export const NO_SHIFT = 'ללא משמרת';

export interface GuardLine {
  name: string;
  /** shift the guard has now */
  current: string;
  /** shift the guard wants / receives */
  desired: string;
}

export interface TransferEmail {
  date: ISODate | null;
  guard1: GuardLine;
  guard2: GuardLine;
}

/**
 * The organization's coordinator email format:
 *   Subject: החלפת משמרת בתאריך [date]
 *   Body: greeting, then for each guard: name / current shift / desired shift, then thanks.
 */
/** Position that is the default and is therefore not mentioned in the email. */
export const DEFAULT_POSITION = 'נמל';

export interface EmailShift {
  date: ISODate | null;
  /** base period label: בוקר / צהריים / לילה (for on-call periods, the base without "כונן") */
  period: string | null;
  onCall: boolean;
  hasOption: boolean;
  position: string | null;
  /** non-standard shift name, used instead of the period */
  customTitle?: string | null;
}

/**
 * Short shift text for the coordinator email: "[day] [shift] [additions]".
 *   "שלישי לילה" · "שלישי לילה כונן" · "שלישי לילה אופציה" · "שלישי בוקר קשמ״ז"
 * The default position (נמל) is not mentioned.
 */
export function emailShiftText(s: EmailShift): string {
  const parts: string[] = [];
  if (s.date) parts.push(WEEKDAYS_HE[dayOfWeek(s.date)]);
  parts.push(s.customTitle || s.period || '');
  if (s.onCall) parts.push('כונן');
  if (s.hasOption) parts.push('אופציה');
  if (s.position && s.position.trim() !== DEFAULT_POSITION) parts.push(s.position.trim());
  return parts.filter(Boolean).join(' ');
}

export function composeCoordinatorEmail(e: TransferEmail): { subject: string; body: string } {
  const dateText = e.date ? formatNumeric(e.date) : '';
  const dayText = e.date ? ` ביום ${WEEKDAYS_HE[dayOfWeek(e.date)]}` : '';
  const block = (g: GuardLine) => [g.name, `משמרת נוכחית: ${g.current}`, `משמרת רצויה: ${g.desired}`];
  const lines = [
    `שלום וברכה, אבקש החלפת משמרת בתאריך ${dateText}${dayText}`.trim(),
    '',
    ...block(e.guard1),
    '',
    ...block(e.guard2),
    '',
    'תודה רבה מראש.',
  ];
  return { subject: `החלפת משמרת בתאריך ${dateText}`.trim(), body: lines.join('\n') };
}

/** RFC 6068 mailto with CRLF line breaks. The address itself is not percent-encoded. */
export function buildMailto(to: string, subject: string, body: string, cc?: string | null): string {
  const enc = (s: string) => encodeURIComponent(s.replace(/\r?\n/g, '\r\n'));
  const ccPart = cc && cc.trim() ? `&cc=${encodeURIComponent(cc.trim())}` : '';
  return `mailto:${to.trim()}?subject=${enc(subject)}${ccPart}&body=${enc(body)}`;
}
