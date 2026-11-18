/** Marketplace filtering & grouping for the weekly board (pure). */
import type { ISODate } from './dates';
import type { Listing, MarketFilters, ShiftPeriod } from './types';

export function listingAppearsOn(l: Listing, date: ISODate): boolean {
  return l.shift_date === date || (l.type === 'seek' && l.want_dates.includes(date));
}

/**
 * Does a listing pass the filters?
 * `qualified` = position ids the viewer is qualified for (used by "only what I can take").
 */
export function passesFilters(l: Listing, f: MarketFilters, qualified: ReadonlySet<string>): boolean {
  if (f.types.length && !f.types.includes(l.type)) return false;

  if (l.type === 'seek') {
    if (f.periods.length && l.want_period_ids.length && !l.want_period_ids.some((p) => f.periods.includes(p))) return false;
    if (f.positions.length && !l.want_position_ids.some((p) => f.positions.includes(p))) return false;
    if (f.option === true && !l.want_option_ok) return false;
    return true;
  }

  if (f.periods.length && (!l.period_id || !f.periods.includes(l.period_id))) return false;
  if (f.positions.length && (!l.position_id || !f.positions.includes(l.position_id))) return false;
  if (f.option !== null && l.has_option !== f.option) return false;
  if (f.qualifiedOnly && (!l.position_id || !qualified.has(l.position_id))) return false;
  return true;
}

export function activeFilterCount(f: MarketFilters): number {
  return f.types.length + f.periods.length + f.positions.length + (f.option === null ? 0 : 1) + (f.qualifiedOnly ? 1 : 0);
}

export interface DayGroups {
  /** listings grouped by period id, oldest first */
  byPeriod: Record<string, Listing[]>;
  /** seek listings open to any period */
  flexible: Listing[];
  /** non-standard shifts with their own name & hours */
  special: Listing[];
  total: number;
}

const byCreated = (a: Listing, b: Listing) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

/** Group the listings that concern `date` by shift period. Seek listings may appear under several periods. */
export function groupDay(listings: Listing[], date: ISODate, periods: ShiftPeriod[]): DayGroups {
  const byPeriod: Record<string, Listing[]> = Object.fromEntries(periods.map((p) => [p.id, [] as Listing[]]));
  const flexible: Listing[] = [];
  const special: Listing[] = [];
  const seen = new Set<string>();

  for (const l of listings) {
    if (l.shift_date === date && l.period_id) {
      (byPeriod[l.period_id] ??= []).push(l);
      seen.add(l.id);
    } else if (l.shift_date === date && !l.period_id) {
      special.push(l);
      seen.add(l.id);
    } else if (l.type === 'seek' && l.want_dates.includes(date)) {
      seen.add(l.id);
      if (l.want_period_ids.length === 0) flexible.push(l);
      else for (const p of l.want_period_ids) (byPeriod[p] ??= []).push(l);
    }
  }
  for (const k of Object.keys(byPeriod)) byPeriod[k].sort(byCreated);
  flexible.sort(byCreated);
  special.sort(byCreated);
  return { byPeriod, flexible, special, total: seen.size };
}

/** Per-day, per-period counts for the week strip. */
export function weekCounts(listings: Listing[], days: ISODate[], periods: ShiftPeriod[]) {
  return Object.fromEntries(
    days.map((d) => {
      const g = groupDay(listings, d, periods);
      return [d, { total: g.total, byPeriod: Object.fromEntries(periods.map((p) => [p.id, g.byPeriod[p.id]?.length ?? 0])) }];
    }),
  ) as Record<ISODate, { total: number; byPeriod: Record<string, number> }>;
}
