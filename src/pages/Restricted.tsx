import { useState } from 'react';
import { Ban, LogOut, PauseCircle, XCircle } from 'lucide-react';
import { PublicShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/feedback';
import { signOut } from '@/data/session';
import type { MyContext } from '@/domain/types';
import { JoinFlow } from './Onboarding';

const COPY = {
  suspended: { icon: PauseCircle, title: 'החשבון מושעה זמנית', body: 'הגישה ללוח המשמרות הושהתה על ידי ההנהלה. לבירור אפשר לפנות להנהלה ישירות.' },
  banned: { icon: Ban, title: 'הגישה לחשבון בוטלה', body: 'החשבון כבר לא משויך לארגון. לבירור אפשר לפנות להנהלה ישירות.' },
  rejected: { icon: XCircle, title: 'הבקשה לא אושרה', body: 'ההנהלה לא אישרה את בקשת ההצטרפות. אם מדובר בטעות, אפשר לבקש קוד חדש ולהגיש שוב.' },
} as const;

export function RestrictedPage({ me }: { me: MyContext }) {
  const status = (me.membership?.status ?? 'banned') as keyof typeof COPY;
  const c = COPY[status] ?? COPY.banned;
  const [reapply, setReapply] = useState(false);
  const Icon = c.icon;

  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-md py-12">
        {reapply ? (
          <JoinFlow reapply />
        ) : (
          <>
            <span className="grid size-11 place-items-center rounded-lg bg-danger-soft text-danger">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-xl font-semibold">{c.title}</h1>
            <p className="mt-2 text-ink-2">{c.body}</p>
            {me.membership?.status_reason && (
              <Notice className="mt-5">
                <span className="font-medium">הערת ההנהלה: </span>
                {me.membership.status_reason}
              </Notice>
            )}
            <div className="mt-8 flex gap-2">
              {status === 'rejected' && <Button onClick={() => setReapply(true)}>הגשת בקשה חדשה</Button>}
              <Button variant="secondary" icon={<LogOut className="size-4" aria-hidden="true" />} onClick={() => signOut()}>
                יציאה מהחשבון
              </Button>
            </div>
          </>
        )}
      </div>
    </PublicShell>
  );
}
