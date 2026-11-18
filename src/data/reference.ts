import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import type { Badge, BadgePosition, MiniProfile, OrgSettings, Position, ShiftPeriod } from '@/domain/types';
import { formatTime } from '@/domain/dates';
import { PERIOD_FALLBACK } from '@/domain/labels';
import type { Listing } from '@/domain/types';

const REF_STALE = 5 * 60_000;

export function usePeriods() {
  return useQuery({
    queryKey: ['periods'],
    staleTime: REF_STALE,
    queryFn: async () => unwrap(await supabase.from('shift_periods').select('*').order('sort_order')) as ShiftPeriod[],
  });
}

export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    staleTime: REF_STALE,
    queryFn: async () => unwrap(await supabase.from('positions').select('*').order('sort_order').order('name')) as Position[],
  });
}

export function useBadges() {
  return useQuery({
    queryKey: ['badges'],
    staleTime: REF_STALE,
    queryFn: async () => {
      const [badges, links] = await Promise.all([
        supabase.from('badges').select('*').order('sort_order').order('name'),
        supabase.from('badge_positions').select('badge_id, position_id'),
      ]);
      return { badges: unwrap(badges) as Badge[], links: unwrap(links) as BadgePosition[] };
    },
  });
}

export function useOrgSettings() {
  return useQuery({
    queryKey: ['org-settings'],
    staleTime: REF_STALE,
    queryFn: async () => unwrap(await supabase.rpc('get_org_settings')) as OrgSettings | null,
  });
}

/** Active colleagues (names only — no contact details). */
export function useColleagues() {
  return useQuery({
    queryKey: ['colleagues'],
    staleTime: REF_STALE,
    queryFn: async () => {
      const rows = unwrap(
        await supabase.from('organization_members').select('user_id, profile:profiles!organization_members_user_id_fkey(id, full_name, avatar_url)').eq('status', 'active'),
      ) as unknown as { user_id: string; profile: MiniProfile | null }[];
      return rows
        .map((r) => r.profile)
        .filter((p): p is MiniProfile => !!p)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, 'he'));
    },
  });
}

export interface Reference {
  periods: ShiftPeriod[];
  positions: Position[];
  periodById: Map<string, ShiftPeriod>;
  positionById: Map<string, Position>;
  periodLabel: (id: string | null | undefined) => string;
  positionName: (id: string | null | undefined) => string;
  /** "07:00–15:00" or null when not configured */
  periodTimes: (id: string | null | undefined) => string | null;
  /** Display title of a listing's concrete shift */
  shiftTitle: (l: Pick<Listing, 'custom_title' | 'period_id'>) => string;
  shiftTimes: (l: Pick<Listing, 'custom_start' | 'custom_end' | 'period_id'>) => string | null;
}

/** Combined, memoized reference data used everywhere. */
export function useReference(): { ref: Reference | null; isLoading: boolean; error: unknown; refetch: () => void } {
  const p = usePeriods();
  const q = usePositions();
  const ref = useMemo<Reference | null>(() => {
    if (!p.data || !q.data) return null;
    const periodById = new Map(p.data.map((x) => [x.id, x]));
    const positionById = new Map(q.data.map((x) => [x.id, x]));
    const periodTimes = (id: string | null | undefined) => {
      const pr = id ? periodById.get(id) : undefined;
      if (!pr?.start_time || !pr?.end_time) return null;
      return `${formatTime(pr.start_time)}-${formatTime(pr.end_time)}`;
    };
    const periodLabel = (id: string | null | undefined) => {
      const pr = id ? periodById.get(id) : undefined;
      return pr ? pr.label || PERIOD_FALLBACK[pr.code] : '';
    };
    return {
      periods: p.data,
      positions: q.data,
      periodById,
      positionById,
      periodLabel,
      positionName: (id) => (id ? positionById.get(id)?.name ?? '' : ''),
      periodTimes,
      shiftTitle: (l) => l.custom_title || periodLabel(l.period_id),
      shiftTimes: (l) =>
        l.custom_start && l.custom_end ? `${formatTime(l.custom_start)}-${formatTime(l.custom_end)}` : periodTimes(l.period_id),
    };
  }, [p.data, q.data]);
  return {
    ref,
    isLoading: p.isLoading || q.isLoading,
    error: p.error ?? q.error,
    refetch: () => {
      p.refetch();
      q.refetch();
    },
  };
}
