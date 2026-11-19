import { describe, expect, it } from 'vitest';
import { buildMailto, buildWhatsAppUrl, composeCoordinatorEmail, composeWhatsAppMessage } from '@/domain/messages';
import { formatILMobile, normalizeILMobile } from '@/domain/phone';
import { groupDay, passesFilters } from '@/domain/marketplace';
import { EMPTY_FILTERS, type Listing, type ShiftPeriod } from '@/domain/types';
import { listingFormSchema, profileSchema } from '@/domain/validation';

describe('phone numbers', () => {
  it.each([
    ['050-1234567', '+972501234567'],
    ['0501234567', '+972501234567'],
    ['+972 50 123 4567', '+972501234567'],
    ['972501234567', '+972501234567'],
    ['501234567', '+972501234567'],
  ])('normalizes %s', (input, out) => expect(normalizeILMobile(input)).toBe(out));

  it.each(['03-1234567', '12345', '', '+1 555 123 4567', '05012345678'])('rejects %s', (input) => {
    expect(normalizeILMobile(input)).toBeNull();
  });

  it('formats for display', () => expect(formatILMobile('+972501234567')).toBe('050-123-4567'));
});

describe('WhatsApp', () => {
  it('builds a correctly encoded wa.me link', () => {
    const text = composeWhatsAppMessage('offer', 'דנה כהן', { date: '2026-11-20', shiftName: 'בוקר', position: 'סיור 50' });
    expect(text).toBe('היי דנה, ראיתי ב-ShiftEX Market את המודעה על משמרת בוקר בעמדת סיור 50 ביום שישי, 20 בנובמבר. רציתי לבדוק אם היא עדיין רלוונטית.');
    const url = buildWhatsAppUrl('+972501234567', text);
    expect(url.startsWith('https://wa.me/972501234567?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1])).toBe(text);
  });
});

describe('coordinator email', () => {
  it('composes the agreed template and a valid mailto', () => {
    const { subject, body } = composeCoordinatorEmail({
      date: '2026-11-20',
      guard1: { name: 'ישראל ישראלי', current: 'לילה, מסוף', desired: 'ללא משמרת' },
      guard2: { name: 'דנה כהן', current: 'ללא משמרת', desired: 'לילה, מסוף' },
    });
    expect(subject).toBe('החלפת משמרת בתאריך 20.11.2026');
    expect(body).toBe(
      [
        'שלום וברכה, אבקש החלפת משמרת בתאריך 20.11.2026',
        '',
        'ישראל ישראלי',
        'משמרת נוכחית: לילה, מסוף',
        'משמרת רצויה: ללא משמרת',
        '',
        'דנה כהן',
        'משמרת נוכחית: ללא משמרת',
        'משמרת רצויה: לילה, מסוף',
        '',
        'תודה רבה מראש.',
      ].join('\n'),
    );
    const href = buildMailto('coord@example.com', subject, body);
    expect(href.startsWith('mailto:coord@example.com?subject=')).toBe(true);
    expect(href).toContain('%0D%0A');
    expect(href).not.toContain('\n');
    const withCc = buildMailto('coord@example.com', subject, body, 'other@gmail.com');
    expect(withCc).toContain('&cc=other%40gmail.com&body=');
    expect(buildMailto('coord@example.com', subject, body, '  ')).not.toContain('cc=');
  });
});

const periods: ShiftPeriod[] = [
  { id: 'm', org_id: 'o', code: 'morning', label: 'בוקר', start_time: null, end_time: null, sort_order: 1 },
  { id: 'n', org_id: 'o', code: 'night', label: 'לילה', start_time: null, end_time: null, sort_order: 3 },
];
const base: Listing = {
  id: 'x', org_id: 'o', owner_id: 'u', type: 'offer', status: 'active', shift_date: '2026-11-20', period_id: 'm',
  position_id: 'p1', has_option: false, custom_title: null, custom_start: null, custom_end: null, want_dates: [],
  want_period_ids: [], want_position_ids: [], want_option_ok: true, note: null, starts_at: '', expires_at: '',
  taken_by: null, removed_reason: null, version: 0, created_at: '2026-11-10T00:00:00Z', updated_at: '', closed_at: null,
};

describe('marketplace grouping & filters', () => {
  it('groups by period, oldest first; flexible seeks separately; seek with periods appears under each', () => {
    const a = { ...base, id: 'a', created_at: '2026-11-12T00:00:00Z' };
    const b = { ...base, id: 'b', created_at: '2026-11-11T00:00:00Z' };
    const s1: Listing = { ...base, id: 's1', type: 'seek', shift_date: null, period_id: null, position_id: null, want_dates: ['2026-11-20'] };
    const s2: Listing = { ...s1, id: 's2', want_period_ids: ['m', 'n'], created_at: '2026-11-13T00:00:00Z' };
    const g = groupDay([a, b, s1, s2], '2026-11-20', periods);
    expect(g.byPeriod.m.map((l) => l.id)).toEqual(['b', 'a', 's2']);
    expect(g.byPeriod.n.map((l) => l.id)).toEqual(['s2']);
    expect(g.flexible.map((l) => l.id)).toEqual(['s1']);
    expect(g.total).toBe(4);
  });

  it('filters by type, period, position, option and qualification', () => {
    const q = new Set(['p1']);
    expect(passesFilters(base, { ...EMPTY_FILTERS, types: ['seek'] }, q)).toBe(false);
    expect(passesFilters(base, { ...EMPTY_FILTERS, periods: ['n'] }, q)).toBe(false);
    expect(passesFilters(base, { ...EMPTY_FILTERS, positions: ['p1'] }, q)).toBe(true);
    expect(passesFilters(base, { ...EMPTY_FILTERS, option: true }, q)).toBe(false);
    expect(passesFilters({ ...base, position_id: 'p53' }, { ...EMPTY_FILTERS, qualifiedOnly: true }, q)).toBe(false);
  });
});

describe('form validation', () => {
  it('profile requires a name and an Israeli mobile', () => {
    expect(profileSchema.safeParse({ fullName: 'דנה כהן', phone: '050-1234567' }).success).toBe(true);
    expect(profileSchema.safeParse({ fullName: "Dana Cohen", phone: "050-1234567" }).success).toBe(false);
    expect(profileSchema.safeParse({ fullName: 'ד', phone: '050-1234567' }).success).toBe(false);
    expect(profileSchema.safeParse({ fullName: 'דנה כהן', phone: '02-1234567' }).success).toBe(false);
  });

  it('offer requires date, period and position; custom shift requires a title', () => {
    const ok = { type: 'offer', shiftDate: '2026-11-20', periodId: 'm', positionId: 'p', hasOption: false, isCustom: false,
      customTitle: '', customStart: '', customEnd: '', wantDates: [], wantPeriodIds: [], wantPositionIds: [], wantOptionOk: true, note: '' };
    expect(listingFormSchema.safeParse(ok).success).toBe(true);
    expect(listingFormSchema.safeParse({ ...ok, periodId: '' }).success).toBe(false);
    expect(listingFormSchema.safeParse({ ...ok, isCustom: true }).success).toBe(false);
    expect(listingFormSchema.safeParse({ ...ok, isCustom: true, customTitle: 'משמרת אירוע' }).success).toBe(true);
    // special (non-standard) shift: name + both hours required
    expect(listingFormSchema.safeParse({ ...ok, periodId: 'special', customTitle: 'תגבור' }).success).toBe(false);
    expect(listingFormSchema.safeParse({ ...ok, periodId: 'special', customTitle: 'תגבור', customStart: '16:00', customEnd: '22:00' }).success).toBe(true);
    expect(listingFormSchema.safeParse({ ...ok, type: 'seek' }).success).toBe(false); // no wanted dates
    expect(listingFormSchema.safeParse({ ...ok, type: 'seek', wantDates: ['2026-11-20'] }).success).toBe(true);
  });
});
