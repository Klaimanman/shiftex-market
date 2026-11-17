import { useEffect, useState } from 'react';
import { Sheet } from './ui/sheet';
import { Button } from './ui/button';
import { Segmented } from './ui/controls';
import { Field, Select } from './ui/field';
import { Notice } from './ui/feedback';
import { useToast } from './ui/toast';
import { useColleagues } from '@/data/reference';
import { useUpdateListing } from '@/data/listings';
import { useMe } from '@/data/session';
import type { Listing, MiniProfile } from '@/domain/types';

/** Owner closes a listing: taken (optionally by whom) or cancelled. */
export function CloseListingSheet({
  open,
  onOpenChange,
  listing,
  suggested,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listing: Listing;
  suggested?: string | null;
  onClosed: (status: 'closed_taken' | 'closed_cancelled', takenBy: MiniProfile | null) => void;
}) {
  const me = useMe();
  const toast = useToast();
  const colleagues = useColleagues();
  const update = useUpdateListing();
  const [mode, setMode] = useState<'closed_taken' | 'closed_cancelled'>('closed_taken');
  const [takenBy, setTakenBy] = useState('');

  useEffect(() => {
    if (open) {
      setMode('closed_taken');
      setTakenBy(suggested ?? '');
    }
  }, [open, suggested]);

  const others = (colleagues.data ?? []).filter((c) => c.id !== me.user_id);
  const takenLabel = listing.type === 'seek' ? 'נמצאה משמרת' : 'המשמרת נלקחה';

  const submit = async () => {
    try {
      await update.mutateAsync({
        id: listing.id,
        version: listing.version,
        patch: { status: mode, taken_by: mode === 'closed_taken' && takenBy ? takenBy : null },
      });
      toast.success('המודעה נסגרה והוסרה מהלוח');
      onOpenChange(false);
      onClosed(mode, others.find((c) => c.id === takenBy) ?? null);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="סגירת המודעה"
      description="המודעה תוסר מהלוח, ומי שהביע עניין יקבל עדכון."
      footer={
        <Button className="w-full" onClick={submit} loading={update.isPending}>
          סגירת המודעה
        </Button>
      }
    >
      <div className="space-y-5">
        <Segmented
          label="סיבת הסגירה"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'closed_taken', label: takenLabel },
            { value: 'closed_cancelled', label: 'ביטול המודעה' },
          ]}
        />
        {mode === 'closed_taken' && (
          <>
            <Field label={listing.type === 'seek' ? 'ממי התקבלה המשמרת' : 'מי לקח את המשמרת'} optional hint="מאפשר למלא אוטומטית את המייל לרכז השיבוץ.">
              <Select value={takenBy} onChange={(e) => setTakenBy(e.target.value)} disabled={colleagues.isLoading}>
                <option value="">לא לציין</option>
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Notice>ShiftEX לא מעדכן את סידור העבודה הרשמי. בשלב הבא אפשר להכין מייל לרכז השיבוץ.</Notice>
          </>
        )}
      </div>
    </Sheet>
  );
}
