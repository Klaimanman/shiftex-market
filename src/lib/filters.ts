import { EMPTY_FILTERS, type ListingType, type MarketFilters } from '@/domain/types';

const TYPES: ListingType[] = ['offer', 'seek', 'exchange'];
const UUID_RE = /^[0-9a-f-]{36}$/i;

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

export function filtersFromParams(sp: URLSearchParams): MarketFilters {
  const opt = sp.get('opt');
  return {
    types: list(sp.get('t')).filter((t): t is ListingType => TYPES.includes(t as ListingType)),
    periods: list(sp.get('p')).filter((x) => UUID_RE.test(x)),
    positions: list(sp.get('pos')).filter((x) => UUID_RE.test(x)),
    option: opt === '1' ? true : opt === '0' ? false : null,
    qualifiedOnly: sp.get('q') === '1',
  };
}

export function writeFilters(sp: URLSearchParams, f: MarketFilters): URLSearchParams {
  const next = new URLSearchParams(sp);
  const set = (k: string, v: string | null) => (v ? next.set(k, v) : next.delete(k));
  set('t', f.types.join(',') || null);
  set('p', f.periods.join(',') || null);
  set('pos', f.positions.join(',') || null);
  set('opt', f.option === null ? null : f.option ? '1' : '0');
  set('q', f.qualifiedOnly ? '1' : null);
  return next;
}

export function filtersToSearch(f: Partial<MarketFilters>): string {
  return writeFilters(new URLSearchParams(), { ...EMPTY_FILTERS, ...f }).toString();
}
