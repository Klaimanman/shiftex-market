import { useQueryClient } from '@tanstack/react-query';
import { Clock, LogOut, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { PublicShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/controls';
import { signOut } from '@/data/session';
import type { MyContext } from '@/domain/types';

export function PendingPage({ me }: { me: MyContext }) {
  const qc = useQueryClient();
  const [checking, setChecking] = useState(false);
  const recheck = async () => {
    setChecking(true);
    await qc.invalidateQueries({ queryKey: ['ctx'] });
    setChecking(false);
  };

  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-md py-12">
        <span className="grid size-11 place-items-center rounded-lg bg-warn-soft text-warn">
          <Clock className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-semibold">הבקשה ממתינה לאישור</h1>
        <p className="mt-2 text-ink-2">
          הבקשה להצטרף אל <span className="font-medium">{me.membership?.org_name}</span> נשלחה להנהלה. ברגע שתאושר, הלוח ייפתח כאן.
        </p>

        <dl className="mt-8 divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-muted">שם</dt>
            <dd className="font-medium">{me.full_name}</dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-muted">תגים שנבחרו</dt>
            <dd className="flex flex-wrap justify-end gap-1">
              {me.badge_names.length ? me.badge_names.map((b) => <Tag key={b}>{b}</Tag>) : <span className="text-muted">לא נבחרו</span>}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex gap-2">
          <Button variant="secondary" icon={<RotateCcw className="size-4" aria-hidden="true" />} loading={checking} onClick={recheck}>
            בדיקה מחדש
          </Button>
          <Button variant="ghost" icon={<LogOut className="size-4" aria-hidden="true" />} onClick={() => signOut()}>
            יציאה
          </Button>
        </div>
      </div>
    </PublicShell>
  );
}
