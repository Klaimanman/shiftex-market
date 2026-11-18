import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { GOOGLE_CLIENT_ID } from '@/config';
import { useTheme } from '@/lib/theme';

/* Minimal typings for Google Identity Services. */
interface GsiCredentialResponse { credential: string }
interface GsiApi {
  accounts: {
    id: {
      initialize: (cfg: Record<string, unknown>) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
}
declare global {
  interface Window { google?: GsiApi }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let loader: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  loader ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loader = null;
      reject(new Error('gsi_load_failed'));
    };
    document.head.appendChild(s);
  });
  return loader;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * "Sign in with Google" rendered by Google on our own origin. Google's window therefore
 * names this site (shiftex-market.pages.dev) rather than the Supabase project domain.
 * The returned ID token is exchanged with Supabase (signInWithIdToken), protected by a nonce.
 * If Google's script can't load (blocked network / old browser), `onUnavailable` lets the
 * caller show the classic redirect button instead.
 */
export function GoogleButton({ onError, onUnavailable, onBusy }: { onError: (msg: string) => void; onUnavailable: () => void; onBusy: (b: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolved } = useTheme();
  const [width, setWidth] = useState(320);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.min(400, Math.max(220, Math.floor(el.getBoundingClientRect().width))));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadGsi();
        if (cancelled || !ref.current || !window.google) return;
        const rawNonce = crypto.randomUUID() + crypto.randomUUID();
        const hashedNonce = await sha256Hex(rawNonce);
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashedNonce,
          ux_mode: 'popup',
          use_fedcm_for_button: true,
          itp_support: true,
          callback: async (res: GsiCredentialResponse) => {
            onBusy(true);
            const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: res.credential, nonce: rawNonce });
            if (error) {
              onBusy(false);
              onError('הכניסה עם Google לא הצליחה. אפשר לנסות שוב.');
            }
            // On success the session listener in SessionProvider re-renders the app.
          },
        });
        ref.current.innerHTML = '';
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: resolved === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          locale: 'he',
          width,
        });
      } catch {
        if (!cancelled) onUnavailable();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, width]);

  return <div ref={ref} className="flex min-h-11 w-full justify-center" aria-label="כניסה עם Google" />;
}
