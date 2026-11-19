import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AppError, unwrap } from '@/lib/errors';
import type { ISODate } from '@/domain/dates';
import { weekDays } from '@/domain/dates';
import type { Interest, Listing, ListingStatus, ListingType } from '@/domain/types';

export const LISTING_SELECT = '*, owner:profiles!shift_listings_owner_id_fkey(id, full_name, avatar_url)';
const OPEN: ListingStatus[] = ['active', 'in_coordination'];

/** Open listings relevant to a Sunday-starting week. Oldest first (fair ordering). */
export function useWeekListings(weekStart: ISODate) {
  return useQuery({
    queryKey: ['listings', 'week', weekStart],
    staleTime: 30_000,
    queryFn: async () => {
      const days = weekDays(weekStart);
      const res = await supabase
        .from('shift_listings')
        .select(LISTING_SELECT)
        .in('status', OPEN)
        .gt('expires_at', new Date().toISOString())
        .or(`and(shift_date.gte.${days[0]},shift_date.lte.${days[6]}),want_dates.ov.{${days.join(',')}}`)
        .order('created_at', { ascending: true })
        .limit(1000);
      return unwrap(res) as Listing[];
    },
  });
}

/** All open listings (for matching suggestions). Bounded to keep egress low. */
export function useOpenListings() {
  return useQuery({
    queryKey: ['listings', 'open'],
    staleTime: 30_000,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('shift_listings')
          .select(LISTING_SELECT)
          .in('status', OPEN)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: true })
          .limit(800),
      ) as Listing[],
  });
}

export function useMyListings(userId: string) {
  return useQuery({
    queryKey: ['listings', 'mine', userId],
    queryFn: async () =>
      unwrap(
        await supabase.from('shift_listings').select(LISTING_SELECT).eq('owner_id', userId).order('created_at', { ascending: false }).limit(100),
      ) as Listing[],
  });
}

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: ['listings', 'one', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await supabase.from('shift_listings').select(LISTING_SELECT).eq('id', id!).maybeSingle();
      return unwrap(res) as Listing | null;
    },
  });
}

export interface ListingInput {
  id?: string;
  type: ListingType;
  shift_date: ISODate | null;
  period_id: string | null;
  position_id: string | null;
  has_option: boolean;
  custom_title: string | null;
  custom_start: string | null;
  custom_end: string | null;
  want_dates: ISODate[];
  want_period_ids: string[];
  want_position_ids: string[];
  want_option_ok: boolean;
  note: string | null;
}

function invalidateListings(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: ['listings'] });
}

export function useCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ListingInput & { id: string; org_id: string; owner_id: string }) => {
      // starts_at / expires_at are computed by the database; placeholders satisfy NOT NULL.
      const now = new Date().toISOString();
      const res = await supabase
        .from('shift_listings')
        .insert({ ...input, starts_at: now, expires_at: now })
        .select(LISTING_SELECT)
        .single();
      return unwrap(res) as Listing;
    },
    onSuccess: () => invalidateListings(qc),
  });
}

/** Optimistic-concurrency update: fails with `conflict` if someone changed the row meanwhile. */
export function useUpdateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version, patch }: { id: string; version: number; patch: Partial<ListingInput> & { status?: ListingStatus; taken_by?: string | null } }) => {
      const res = await supabase.from('shift_listings').update(patch).eq('id', id).eq('version', version).select(LISTING_SELECT);
      const rows = unwrap(res) as Listing[];
      if (rows.length === 0) throw new AppError('conflict');
      return rows[0];
    },
    onSettled: () => invalidateListings(qc),
  });
}

/** Owner permanently deletes their own listing (e.g. after the shift was taken). */
export function useDeleteListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const rows = unwrap(await supabase.from('shift_listings').delete().eq('id', id).select('id')) as { id: string }[];
      if (rows.length === 0) throw new AppError('forbidden');
    },
    onSuccess: () => invalidateListings(qc),
  });
}

// ---------------------------------------------------------------------------
// Interests & contact
// ---------------------------------------------------------------------------
const INTEREST_SELECT = '*, user:profiles!listing_interests_user_id_fkey(id, full_name, avatar_url)';

export function useListingInterests(listingId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['interests', 'listing', listingId],
    enabled: !!listingId && enabled,
    queryFn: async () =>
      unwrap(await supabase.from('listing_interests').select(INTEREST_SELECT).eq('listing_id', listingId!).order('created_at')) as Interest[],
  });
}

export function useMyInterest(listingId: string | undefined, userId: string) {
  return useQuery({
    queryKey: ['interests', 'mine', listingId],
    enabled: !!listingId,
    queryFn: async () =>
      unwrap(await supabase.from('listing_interests').select('*').eq('listing_id', listingId!).eq('user_id', userId).maybeSingle()) as Interest | null,
  });
}

export function useExpressInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { listingId: string; offeredListingId?: string | null; note?: string | null }) =>
      unwrap(await supabase.rpc('express_interest', { p_listing: v.listingId, p_offered: v.offeredListingId ?? null, p_note: v.note ?? null })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interests'] }),
  });
}

export function useSetInterestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; status: Interest['status'] }) =>
      unwrap(await supabase.rpc('set_interest_status', { p_interest: v.id, p_status: v.status })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interests'] }),
  });
}

export interface Contact { user_id: string; full_name: string; phone: string | null; email: string | null }

export interface Colleague { user_id: string; full_name: string; email: string }

/** Active colleagues matching a name or email (for the coordinator email CC). */
export async function searchColleagues(query: string): Promise<Colleague[]> {
  if (query.trim().length < 2) return [];
  return (unwrap(await supabase.rpc('search_colleagues', { p_query: query.trim() })) as Colleague[]) ?? [];
}

export async function fetchContact(listingId: string, userId?: string | null): Promise<Contact> {
  return unwrap(await supabase.rpc('get_contact', { p_listing: listingId, p_user: userId ?? null })) as Contact;
}
