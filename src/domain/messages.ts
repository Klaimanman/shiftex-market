/**
 * WhatsApp + coordinator-email composition. Nothing here sends anything:
 * the user always reviews and edits the text, then their own app sends it.
 * Wording is gender-neutral.
 */
import { formatLong, formatNumeric, type ISODate } from './dates';
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
export function composeCoordinatorEmail(e: TransferEmail): { subject: string; body: string } {
  const dateText = e.date ? formatNumeric(e.date) : '';
  const block = (g: GuardLine) => [g.name, `משמרת נוכחית: ${g.current}`, `משמרת רצויה: ${g.desired}`];
  const lines = [
    `שלום וברכה, אבקש החלפת משמרת בתאריך ${dateText}`.trim(),
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
