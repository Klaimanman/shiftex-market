import { useState } from 'react';
import { PageHeader, Panel } from '@/components/PageHeader';
import { ListingCard } from '@/components/ListingCard';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useMe } from '@/data/session';
import { useReference } from '@/data/reference';
import { useAdminOpenListings, useRemoveListing } from '@/data/admin';
import type { Listing } from '@/domain/types';

export function AdminListings() {
  const me = useMe();
  const { ref: r } = useReference();
  const q = useAdminOpenListings();
  const remove = useRemoveListing();
  const toast = useToast();
  const [target, setTarget] = useState<Listing | null>(null);
  const [reason, setReason] = useState('');

  return (
    <>
      <PageHeader title="מודעות פתוחות" subtitle="הסרת מודעות לא תקינות. בעל המודעה מקבל התראה עם הסיבה." />
      {q.isLoading || !r ? <ListSkeleton rows={3} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <Panel><EmptyState title="אין מודעות פתוחות" /></Panel>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {q.data.map((l) => (
            <div key={l.id} className="space-y-1.5">
              <ListingCard listing={l} reference={r} qualified={me.qualified} showDate />
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => setTarget(l)}>הסרה</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => {
          if (!o) {
            setTarget(null);
            setReason('');
          }
        }}
        title="להסיר את המודעה?"
        body="המודעה תוסר מהלוח מיד ותירשם ביומן הפעולות."
        confirmLabel="הסרה"
        tone="danger"
        onConfirm={async () => {
          try {
            await remove.mutateAsync({ id: target!.id, reason });
            toast.success('המודעה הוסרה');
          } catch (e) {
            toast.error(e);
            throw e;
          }
        }}
      >
        <Field label="סיבה" optional hint="נשלחת לבעל המודעה.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} />
        </Field>
      </ConfirmDialog>
    </>
  );
}
