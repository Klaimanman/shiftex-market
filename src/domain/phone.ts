/** Israeli mobile numbers (WhatsApp requires a mobile). Mirrors public.normalize_il_mobile(). */

export function normalizeILMobile(input: string): string | null {
  const d = (input ?? '').replace(/\D/g, '');
  if (d.startsWith('9725') && d.length === 12) return `+${d}`;
  if (d.startsWith('05') && d.length === 10) return `+972${d.slice(1)}`;
  if (d.startsWith('5') && d.length === 9) return `+972${d}`;
  return null;
}

/** "+972501234567" -> "050-123-4567" */
export function formatILMobile(e164: string | null | undefined): string {
  if (!e164) return '';
  const local = e164.startsWith('+972') ? `0${e164.slice(4)}` : e164;
  return local.length === 10 ? `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}` : local;
}

/** Digits-only international form used by wa.me links. */
export function toWhatsAppNumber(e164: string): string {
  return e164.replace(/\D/g, '');
}
