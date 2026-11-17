import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/errors';
import type { MyContext } from '@/domain/types';

interface SessionState { session: Session | null; loading: boolean }
const Ctx = createContext<SessionState>({ session: null, loading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });
  const qc = useQueryClient();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setState({ session: data.session, loading: false });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false });
      if (event === 'SIGNED_OUT') qc.clear();
      if (event === 'SIGNED_IN') qc.invalidateQueries({ queryKey: ['ctx'] });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

export function useMyContext(enabled = true) {
  const { session } = useSession();
  return useQuery({
    queryKey: ['ctx', session?.user.id],
    enabled: enabled && !!session,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => unwrap(await supabase.rpc('my_context')) as MyContext,
  });
}

/** For screens rendered only for active members: context is guaranteed by the gate. */
const MeCtx = createContext<MyContext | null>(null);
export const MeProvider = MeCtx.Provider;
export function useMe(): MyContext & { orgId: string; isAdmin: boolean; qualified: Set<string> } {
  const me = useContext(MeCtx);
  if (!me || !me.membership) throw new Error('useMe used outside an active-member area');
  return useMemo(
    () => ({ ...me, orgId: me.membership!.org_id, isAdmin: me.membership!.role === 'admin', qualified: new Set(me.qualified_position_ids) }),
    [me],
  );
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}
