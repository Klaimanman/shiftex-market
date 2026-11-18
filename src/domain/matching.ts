/**
 * Deterministic matching engine (pure, UI-independent, unit-tested).
 *
 * A match is only a suggestion — it never creates or approves a shift transfer.
 *
 * Give side  = the concrete shift a listing offers (offer, exchange).
 * Want side  = what a listing is looking for (seek, exchange-in-return).
 * want_position_ids is always filled server-side with positions the owner is
 * qualified for, so wants are qualification-safe for their owner.
 */
import type { Listing } from './types';

export type MatchLevel = 'exact' | 'partial' | 'none';

export interface MatchResult {
  level: MatchLevel;
  /** Human-readable Hebrew explanation of what differs (empty for exact). */
  differences: string[];
}

type Give = Pick<Listing, 'shift_date' | 'period_id' | 'position_id' | 'has_option'>;
type Want = Pick<Listing, 'want_dates' | 'want_period_ids' | 'want_position_ids' | 'want_option_ok'>;
type MatchableListing = Pick<
  Listing,
  | 'id' | 'type' | 'status' | 'owner_id' | 'expires_at' | 'created_at'
  | 'shift_date' | 'period_id' | 'position_id' | 'has_option'
  | 'want_dates' | 'want_period_ids' | 'want_position_ids' | 'want_option_ok'
>;

const NONE: MatchResult = { level: 'none', differences: [] };

export function isOpen(l: Pick<Listing, 'status' | 'expires_at'>, now: Date = new Date()): boolean {
  return (l.status === 'active' || l.status === 'in_coordination') && new Date(l.expires_at).getTime() > now.getTime();
}

/** How well a concrete shift satisfies a set of wants. */
export function giveFitsWants(give: Give, want: Want): MatchResult {
  if (!give.shift_date || !give.position_id) return NONE;
  if (!want.want_dates.includes(give.shift_date)) return NONE;

  // Special shifts (no regular period) only fit wants that accept any period.
  const periodOk =
    want.want_period_ids.length === 0 || (!!give.period_id && want.want_period_ids.includes(give.period_id));
  const positionOk = want.want_position_ids.includes(give.position_id);
  const optionOk = want.want_option_ok || !give.has_option;

  if (periodOk && positionOk && optionOk) return { level: 'exact', differences: [] };

  // Partial: same date, and at least one of period / position lines up.
  if (!periodOk && !positionOk) return NONE;
  const differences: string[] = [];
  if (!periodOk) differences.push('משמרת שונה מהמבוקש');
  if (!positionOk) differences.push('עמדה שונה מהמבוקש');
  if (!optionOk) differences.push('כוללת אופציה ל־12 שעות');
  return { level: 'partial', differences };
}

const cap = (r: MatchResult): MatchResult => (r.level === 'exact' ? { level: 'partial', differences: [...r.differences, 'ללא החלפה הדדית'] } : r);

/**
 * Compare two listings from different owners.
 * `isQualified(userId, positionId)` must answer for the users whose qualification is known
 * (typically the viewer). Unknown users fall back to their want lists (already qualification-safe).
 */
export function matchListings(
  a: MatchableListing,
  b: MatchableListing,
  isQualified: (userId: string, positionId: string) => boolean | undefined,
  now: Date = new Date(),
): MatchResult {
  if (a.id === b.id || a.owner_id === b.owner_id) return NONE;
  if (!isOpen(a, now) || !isOpen(b, now)) return NONE;

  const qualifiedFor = (user: string, position: string | null) => {
    if (!position) return false;
    const q = isQualified(user, position);
    return q === undefined ? true : q;
  };

  const pair = (x: MatchableListing, y: MatchableListing): MatchResult => {
    // x gives, y wants
    if (x.type === 'seek' || y.type === 'offer') return NONE;
    if (!qualifiedFor(y.owner_id, x.position_id)) return NONE;
    return giveFitsWants(x, y);
  };

  if (a.type === 'exchange' && b.type === 'exchange') {
    const ab = pair(a, b);
    const ba = pair(b, a);
    if (ab.level === 'exact' && ba.level === 'exact') return { level: 'exact', differences: [] };
    if (ab.level === 'none' && ba.level === 'none') return NONE;
    const differences = [...ab.differences, ...ba.differences];
    if (ab.level === 'none' || ba.level === 'none') differences.push('ההתאמה רק בכיוון אחד');
    return { level: 'partial', differences: Array.from(new Set(differences)) };
  }

  // offer ↔ seek: direct
  if (a.type === 'offer' && b.type === 'seek') return pair(a, b);
  if (a.type === 'seek' && b.type === 'offer') return pair(b, a);

  // Anything involving one exchange and a one-way listing is at most partial
  // (the exchange owner also wants something in return).
  if (a.type === 'exchange' && b.type === 'seek') return cap(pair(a, b));
  if (a.type === 'seek' && b.type === 'exchange') return cap(pair(b, a));
  if (a.type === 'offer' && b.type === 'exchange') return cap(pair(a, b));
  if (a.type === 'exchange' && b.type === 'offer') return cap(pair(b, a));

  return NONE;
}

export interface Suggestion<L> {
  mine: L;
  other: L;
  result: MatchResult;
}

/** All suggestions for my open listings, exact first, then oldest listing first (fair & predictable). */
export function findSuggestions<L extends MatchableListing>(
  mine: L[],
  others: L[],
  isQualified: (userId: string, positionId: string) => boolean | undefined,
  now: Date = new Date(),
): Suggestion<L>[] {
  const out: Suggestion<L>[] = [];
  for (const m of mine) {
    if (!isOpen(m, now)) continue;
    for (const o of others) {
      const result = matchListings(m, o, isQualified, now);
      if (result.level !== 'none') out.push({ mine: m, other: o, result });
    }
  }
  return out.sort((x, y) => {
    if (x.result.level !== y.result.level) return x.result.level === 'exact' ? -1 : 1;
    return x.other.created_at.localeCompare(y.other.created_at);
  });
}
