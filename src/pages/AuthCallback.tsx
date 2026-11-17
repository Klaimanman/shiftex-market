import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { PublicShell } from '@/components/AppShell';
import { FullPageSpinner, Notice } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';

/**
 * OAuth (PKCE) landing page. supabase-js exchanges the ?code automatically
 * (detectSessionInUrl); we wait for the session or surface the provider's error.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const providerError = params.get('error_description') || hash.get('error_description') || params.get('error');
    if (providerError) {
      setError(
        /access_denied|cancel/i.test(providerError)
          ? 'הכניסה בוטלה. אפשר לנסות שוב.'
          : 'הכניסה עם Google לא הצליחה. אפשר לנסות שוב בעוד רגע.',
      );
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      navigate('/', { replace: true });
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) finish();
    });
    supabase.auth.getSession().then(({ data }) => data.session && finish());
    const t = window.setTimeout(() => {
      if (!done) setError('לא הצלחנו להשלים את הכניסה. ייתכן שהקישור פג תוקף — אפשר לנסות שוב.');
    }, 12_000);
    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(t);
    };
  }, [navigate]);

  if (!error) return <FullPageSpinner label="משלימים את הכניסה…" />;
  return (
    <PublicShell>
      <div className="mx-auto mt-16 w-full max-w-sm space-y-4">
        <Notice tone="danger">{error}</Notice>
        <Button className="w-full" onClick={() => navigate('/', { replace: true })}>
          חזרה למסך הכניסה
        </Button>
      </div>
    </PublicShell>
  );
}
