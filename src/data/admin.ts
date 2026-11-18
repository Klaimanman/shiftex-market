import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import type { Listing, MemberRole, MemberStatus, OrgSettings } from '@/domain/types';
import { LISTING_SELECT } from './listings';

export interface AdminMember {
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  status_reason: string | null;
  created_at: string;
  approved_at: string | null;
  full_name: string;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  badge_ids: string[];
  self_selected: boolean;
}

export interface AdminStats {
  pending: number;
  active_members: number;
  suspended: number;
  open_listings: number;
  listings_7d: number;
  closed_taken_30d: number;
  periods_missing_times: number;
  coordinator_email_set: boolean;
}

export interface Invite {
  id: string;
  code_hint: string;
  code: string | null;
  label: string | null;
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export function useAdminStats() {
  return useQuery({ queryKey: ['admin', 'stats'], queryFn: async () => unwrap(await supabase.rpc('admin_stats')) as AdminStats });
}

export function useAdminMembers() {
  return useQuery({ queryKey: ['admin', 'members'], queryFn: async () => unwrap(await supabase.rpc('admin_list_members')) as AdminMember[] });
}

function useAdminMutation<V>(fn: (v: V) => Promise<unknown>, keys: string[][] = [['admin']]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k }))),
  });
}

export const useSetMemberStatus = () =>
  useAdminMutation(
    async (v: { userId: string; status: MemberStatus; reason?: string }) =>
      unwrap(await supabase.rpc('admin_set_member_status', { p_user: v.userId, p_status: v.status, p_reason: v.reason ?? null })),
    [['admin'], ['listings'], ['colleagues']],
  );

export const useSetMemberRole = () =>
  useAdminMutation(async (v: { userId: string; role: MemberRole }) => unwrap(await supabase.rpc('admin_set_member_role', { p_user: v.userId, p_role: v.role })));

export const useSetMemberBadges = () =>
  useAdminMutation(
    async (v: { userId: string; badgeIds: string[] }) => unwrap(await supabase.rpc('admin_set_member_badges', { p_user: v.userId, p_badge_ids: v.badgeIds })),
    [['admin'], ['ctx']],
  );

export function useInvites() {
  return useQuery({
    queryKey: ['admin', 'invites'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('organization_invites')
          .select('id, code_hint, code, label, max_uses, use_count, expires_at, revoked_at, created_at')
          .order('created_at', { ascending: false }),
      ) as Invite[],
  });
}

export const useCreateInvite = () =>
  useAdminMutation(
    async (v: { label: string; maxUses: number; expiresAt: string | null }) =>
      unwrap(await supabase.rpc('admin_create_invite', { p_label: v.label, p_max_uses: v.maxUses, p_expires_at: v.expiresAt })) as {
        id: string;
        code: string;
      },
  );

export const useRevokeInvite = () => useAdminMutation(async (id: string) => unwrap(await supabase.rpc('admin_revoke_invite', { p_id: id })));

export const useRemoveListing = () =>
  useAdminMutation(
    async (v: { id: string; reason: string }) => unwrap(await supabase.rpc('admin_remove_listing', { p_id: v.id, p_reason: v.reason })),
    [['admin'], ['listings']],
  );

export function useAdminOpenListings() {
  return useQuery({
    queryKey: ['admin', 'listings'],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('shift_listings')
          .select(LISTING_SELECT)
          .in('status', ['active', 'in_coordination'])
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(300),
      ) as Listing[],
  });
}

export function useAuditLog(page: number) {
  const size = 50;
  return useQuery({
    queryKey: ['admin', 'audit', page],
    queryFn: async () =>
      unwrap(
        await supabase
          .from('admin_audit_logs')
          .select('id, actor_id, action, target_type, target_id, details, created_at')
          .order('created_at', { ascending: false })
          .range(page * size, page * size + size - 1),
      ) as AuditEntry[],
  });
}

// --- Configuration tables (RLS: admins only) ---------------------------------
export const useSavePosition = () =>
  useAdminMutation(
    async (v: { id?: string; orgId: string; name: string; requires_qualification: boolean; is_active: boolean; sort_order: number }) => {
      const row = { name: v.name.trim(), requires_qualification: v.requires_qualification, is_active: v.is_active, sort_order: v.sort_order };
      if (v.id) return unwrap(await supabase.from('positions').update(row).eq('id', v.id));
      return unwrap(await supabase.from('positions').insert({ ...row, org_id: v.orgId }));
    },
    [['admin'], ['positions'], ['ctx']],
  );

export const useDeletePosition = () =>
  useAdminMutation(async (id: string) => unwrap(await supabase.from('positions').delete().eq('id', id)), [['positions'], ['ctx']]);

export const useSaveBadge = () =>
  useAdminMutation(
    async (v: { id?: string; orgId: string; name: string; description: string; is_active: boolean; sort_order: number; positionIds: string[]; previous: string[] }) => {
      const row = { name: v.name.trim(), description: v.description.trim() || null, is_active: v.is_active, sort_order: v.sort_order };
      let id = v.id;
      if (id) unwrap(await supabase.from('badges').update(row).eq('id', id));
      else id = (unwrap(await supabase.from('badges').insert({ ...row, org_id: v.orgId }).select('id').single()) as { id: string }).id;
      const toAdd = v.positionIds.filter((p) => !v.previous.includes(p));
      const toRemove = v.previous.filter((p) => !v.positionIds.includes(p));
      if (toAdd.length) unwrap(await supabase.from('badge_positions').insert(toAdd.map((position_id) => ({ badge_id: id, position_id, org_id: v.orgId }))));
      if (toRemove.length) unwrap(await supabase.from('badge_positions').delete().eq('badge_id', id!).in('position_id', toRemove));
    },
    [['badges'], ['ctx'], ['admin']],
  );

export const useDeleteBadge = () =>
  useAdminMutation(async (id: string) => unwrap(await supabase.from('badges').delete().eq('id', id)), [['badges'], ['ctx'], ['admin']]);

export const useSavePeriod = () =>
  useAdminMutation(
    async (v: { id: string; label: string; start_time: string | null; end_time: string | null }) =>
      unwrap(await supabase.from('shift_periods').update({ label: v.label.trim(), start_time: v.start_time, end_time: v.end_time }).eq('id', v.id)),
    [['periods'], ['listings'], ['admin']],
  );

export const useSaveSettings = () =>
  useAdminMutation(
    async (v: Pick<OrgSettings, 'org_id' | 'coordinator_email' | 'max_active_listings' | 'max_new_listings_per_day' | 'closed_retention_days'>) =>
      unwrap(
        await supabase
          .from('organization_settings')
          .update({
            coordinator_email: v.coordinator_email,
            max_active_listings: v.max_active_listings,
            max_new_listings_per_day: v.max_new_listings_per_day,
            closed_retention_days: v.closed_retention_days,
          })
          .eq('org_id', v.org_id),
      ),
    [['org-settings'], ['admin']],
  );
