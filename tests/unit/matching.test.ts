import { describe, expect, it } from 'vitest';
import { findSuggestions, giveFitsWants, matchListings } from '@/domain/matching';
import type { Listing } from '@/domain/types';

const NOW = new Date('2026-11-17T10:00:00Z');
const LATER = '2026-12-31T00:00:00Z';
const MORNING = 'p-morning';
const NIGHT = 'p-night';
const OPEN_POS = 'pos-open';
const POS_53 = 'pos-53';

let seq = 0;
function listing(over: Partial<Listing>): Listing {
  seq++;
  return {
    id: `l${seq}`, org_id: 'o', owner_id: `u${seq}`, type: 'offer', status: 'active',
    shift_date: null, period_id: null, position_id: null, has_option: false,
    custom_title: null, custom_start: null, custom_end: null,
    want_dates: [], want_period_ids: [], want_position_ids: [], want_option_ok: true,
    note: null, starts_at: LATER, expires_at: LATER, taken_by: null, removed_reason: null,
    version: 0, created_at: `2026-11-1${seq % 9}T00:00:00Z`, updated_at: LATER, closed_at: null,
    ...over,
  };
}

const offer = (over: Partial<Listing> = {}) =>
  listing({ type: 'offer', shift_date: '2026-11-20', period_id: MORNING, position_id: OPEN_POS, ...over });
const seek = (over: Partial<Listing> = {}) =>
  listing({ type: 'seek', want_dates: ['2026-11-20'], want_period_ids: [MORNING], want_position_ids: [OPEN_POS], ...over });

const everyoneQualified = () => true;

describe('giveFitsWants', () => {
  it('exact: same date, period, position', () => {
    expect(giveFitsWants(offer(), seek()).level).toBe('exact');
  });
  it('none: different date', () => {
    expect(giveFitsWants(offer({ shift_date: '2026-11-21' }), seek()).level).toBe('none');
  });
  it('partial: same date & position, different period', () => {
    const r = giveFitsWants(offer({ period_id: NIGHT }), seek());
    expect(r.level).toBe('partial');
    expect(r.differences).toContain('משמרת שונה מהמבוקש');
  });
  it('none: same date but both period and position differ', () => {
    expect(giveFitsWants(offer({ period_id: NIGHT, position_id: POS_53 }), seek()).level).toBe('none');
  });
  it('empty want periods means any period', () => {
    expect(giveFitsWants(offer({ period_id: NIGHT }), seek({ want_period_ids: [] })).level).toBe('exact');
  });
  it('12h option not accepted -> partial', () => {
    const r = giveFitsWants(offer({ has_option: true }), seek({ want_option_ok: false }));
    expect(r.level).toBe('partial');
  });
});

describe('matchListings', () => {
  it('offer ↔ seek exact match in both argument orders', () => {
    const o = offer();
    const s = seek();
    expect(matchListings(o, s, everyoneQualified, NOW).level).toBe('exact');
    expect(matchListings(s, o, everyoneQualified, NOW).level).toBe('exact');
  });

  it('respects qualifications: an unqualified seeker never matches a 53 shift', () => {
    const o = offer({ position_id: POS_53 });
    const s = seek({ want_position_ids: [POS_53] });
    const q = (user: string, pos: string) => !(user === s.owner_id && pos === POS_53);
    expect(matchListings(o, s, q, NOW).level).toBe('none');
  });

  it('never matches own listings', () => {
    const o = offer({ owner_id: 'same' });
    const s = seek({ owner_id: 'same' });
    expect(matchListings(o, s, everyoneQualified, NOW).level).toBe('none');
  });

  it('closed or expired listings never match', () => {
    expect(matchListings(offer({ status: 'closed_taken' }), seek(), everyoneQualified, NOW).level).toBe('none');
    expect(matchListings(offer({ expires_at: '2026-11-01T00:00:00Z' }), seek(), everyoneQualified, NOW).level).toBe('none');
  });

  it('offer ↔ offer and seek ↔ seek never match', () => {
    expect(matchListings(offer(), offer(), everyoneQualified, NOW).level).toBe('none');
    expect(matchListings(seek(), seek(), everyoneQualified, NOW).level).toBe('none');
  });

  it('exchange ↔ exchange: exact when both sides fit', () => {
    const a = listing({ type: 'exchange', shift_date: '2026-11-20', period_id: MORNING, position_id: OPEN_POS,
      want_dates: ['2026-11-22'], want_period_ids: [NIGHT], want_position_ids: [OPEN_POS] });
    const b = listing({ type: 'exchange', shift_date: '2026-11-22', period_id: NIGHT, position_id: OPEN_POS,
      want_dates: ['2026-11-20'], want_period_ids: [MORNING], want_position_ids: [OPEN_POS] });
    expect(matchListings(a, b, everyoneQualified, NOW).level).toBe('exact');
  });

  it('exchange ↔ exchange: partial when only one direction fits', () => {
    const a = listing({ type: 'exchange', shift_date: '2026-11-20', period_id: MORNING, position_id: OPEN_POS,
      want_dates: ['2026-11-25'], want_position_ids: [OPEN_POS] });
    const b = listing({ type: 'exchange', shift_date: '2026-11-22', period_id: NIGHT, position_id: OPEN_POS,
      want_dates: ['2026-11-20'], want_position_ids: [OPEN_POS] });
    const r = matchListings(a, b, everyoneQualified, NOW);
    expect(r.level).toBe('partial');
    expect(r.differences).toContain('ההתאמה רק בכיוון אחד');
  });

  it('exchange ↔ seek is at most partial', () => {
    const ex = listing({ type: 'exchange', shift_date: '2026-11-20', period_id: MORNING, position_id: OPEN_POS,
      want_dates: ['2026-11-25'], want_position_ids: [OPEN_POS] });
    expect(matchListings(ex, seek(), everyoneQualified, NOW).level).toBe('partial');
  });
});

describe('findSuggestions', () => {
  it('returns exact before partial, then oldest first; empty when nothing matches', () => {
    const mine = seek({ owner_id: 'me', want_period_ids: [] , want_position_ids: [OPEN_POS] });
    const old = offer({ created_at: '2026-11-01T00:00:00Z' });
    const newer = offer({ created_at: '2026-11-10T00:00:00Z' });
    const partial = offer({ position_id: POS_53, created_at: '2026-10-01T00:00:00Z' });
    const s = findSuggestions([mine], [newer, partial, old], everyoneQualified, NOW);
    expect(s.map((x) => x.other.id)).toEqual([old.id, newer.id, partial.id]);
    expect(s[2].result.level).toBe('partial');
    expect(findSuggestions([mine], [offer({ shift_date: '2026-12-01' })], everyoneQualified, NOW)).toEqual([]);
  });
});
