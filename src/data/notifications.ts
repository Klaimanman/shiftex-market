import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import type { AppNotification, SavedSearch } from '@/domain/types';

const N_SELECT =
  'id, kind, listing_id, actor_id, payload, read_at, created_at, ' +
  'actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url), ' +
  'listing:shift_listings(id, type, shift_date, period_id, position_id, custom_title, status, want_dates)';

export function useNotifications(userId: string) {
  return useQuery({
    queryKey: ['notifications', userId],
    staleTime: 30_000,
    queryFn: async () =>
      unwrap(await supabase.from('notifications').select(N_SELECT).order('created_at', { ascending: false }).limit(100)) as unknown as AppNotification[],
  });
}

export function useUnreadCount(userId: string) {
  return useQuery({
    queryKey: ['notifications', userId, 'unread'],
    staleTime: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMarkRead(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[] | 'all') => {
      let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
      if (ids !== 'all') q = q.in('id', ids);
      unwrap(await q);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', userId] }),
  });
}

export function useDeleteNotification(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('notifications').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', userId] }),
  });
}

export interface NotificationPrefs { matches: boolean; interests: boolean; saved_searches: boolean }
const DEFAULT_PREFS: NotificationPrefs = { matches: true, interests: true, saved_searches: true };

export function useNotificationPrefs(userId: string) {
  return useQuery({
    queryKey: ['notif-prefs', userId],
    queryFn: async () => {
      const row = unwrap(await supabase.from('notification_preferences').select('matches, interests, saved_searches').eq('user_id', userId).maybeSingle());
      return (row as NotificationPrefs | null) ?? DEFAULT_PREFS;
    },
  });
}

export function useSaveNotificationPrefs(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: NotificationPrefs) =>
      unwrap(await supabase.from('notification_preferences').upsert({ user_id: userId, ...p, updated_at: new Date().toISOString() })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notif-prefs', userId] }),
  });
}

// ---------------------------------------------------------------------------
// Saved searches
// ---------------------------------------------------------------------------
export function useSavedSearches(userId: string) {
  return useQuery({
    queryKey: ['saved-searches', userId],
    queryFn: async () =>
      unwrap(await supabase.from('saved_searches').select('id, name, filters, notify, created_at').order('created_at')) as SavedSearch[],
  });
}

export function useSaveSearch(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id?: string; name: string; filters: SavedSearch['filters']; notify: boolean; orgId: string }) => {
      if (v.id) return unwrap(await supabase.from('saved_searches').update({ name: v.name, filters: v.filters, notify: v.notify }).eq('id', v.id));
      return unwrap(
        await supabase.from('saved_searches').insert({ name: v.name, filters: v.filters, notify: v.notify, org_id: v.orgId, user_id: userId }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches', userId] }),
  });
}

export function useDeleteSavedSearch(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('saved_searches').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches', userId] }),
  });
}
