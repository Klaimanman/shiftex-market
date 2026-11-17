import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * One Realtime channel per signed-in member (one websocket), used only to
 * invalidate cached queries — no polling. RLS is enforced by Supabase per subscriber.
 * Free tier: 200 concurrent connections; the channel closes when the tab is hidden.
 */
export function useRealtimeSync(orgId: string, userId: string) {
  const qc = useQueryClient();

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer: number | undefined;

    const invalidateListings = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['listings'] });
        qc.invalidateQueries({ queryKey: ['interests'] });
      }, 300);
    };

    const open = () => {
      if (channel) return;
      channel = supabase
        .channel(`org-${orgId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_listings', filter: `org_id=eq.${orgId}` }, invalidateListings)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => {
          qc.invalidateQueries({ queryKey: ['notifications', userId] });
          qc.invalidateQueries({ queryKey: ['interests'] });
        })
        .subscribe();
    };
    const close = () => {
      if (channel) supabase.removeChannel(channel);
      channel = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        open();
        invalidateListings();
      } else {
        close();
      }
    };

    if (document.visibilityState === 'visible') open();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(timer);
      close();
    };
  }, [orgId, userId, qc]);
}
