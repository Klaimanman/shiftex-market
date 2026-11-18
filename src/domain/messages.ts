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

export interface TransferEmail {
  date: ISODate | null;
  shiftName: string;
  position: string | null;
  giverName: string;
  receiverName: string;
  isExchange?: boolean;
  returnShift?: string | null;
}

export function composeCoordinatorEmail(e: TransferEmail): { subject: string; body: string } {
  const dateText = e.date ? formatNumeric(e.date) : '';
  const subject = e.isExchange ? `בקשה להחלפת משמרות, ${dateText}` : `בקשה להעברת משמרת, ${dateText}`;
  const lines = [
    'שלום,',
    '',
    e.isExchange ? 'אבקש לעדכן על החלפת המשמרות הבאה:' : 'אבקש לעדכן על העברת המשמרת הבאה:',
    '',
    `תאריך: ${dateText}`,
    `משמרת: ${e.shiftName}`,
    `עמדה: ${e.position ?? ''}`,
    `מאבטח מוסר: ${e.giverName}`,
    `מאבטח מקבל: ${e.receiverName}`,
  ];
  if (e.isExchange) lines.push(`משמרת בתמורה: ${e.returnShift ?? ''}`);
  lines.push('', 'תודה רבה.');
  return { subject: subject.trim().replace(/,\s*$/, ''), body: lines.join('\n') };
}

/** RFC 6068 mailto with CRLF line breaks. The address itself is not percent-encoded. */
export function buildMailto(to: string, subject: string, body: string): string {
  const enc = (s: string) => encodeURIComponent(s.replace(/\r?\n/g, '\r\n'));
  return `mailto:${to.trim()}?subject=${enc(subject)}&body=${enc(body)}`;
}
