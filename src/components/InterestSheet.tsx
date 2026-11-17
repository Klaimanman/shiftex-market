import { useEffect, useState } from 'react';
import { Sheet } from './ui/sheet';
import { Button } from './ui/button';
import { Field, Select, Textarea } from './ui/field';
import { useToast } from './ui/toast';
import { useExpressInterest, useMyListings } from '@/data/listings';
import { useMe } from '@/data/session';
import { useReference } from '@/data/reference';
import type { Listing } from '@/domain/types';
import { isOpen } from '@/domain/matching';
import { formatShort } from '@/domain/dates';

/** "I'm interested" — notifies the owner in-app. For exchanges, lets the user propose one of their shifts. */
export function InterestSheet({ open, onOpenChange, listing }: { open: boolean; onOpenChange: (o: boolean) => void; listing: Listing }) {
  const me = useMe();
  const toast = useToast();
  const { ref: r } = useReference();
  const mine = useMyListings(me.user_id);
  const express = useExpressInterest();
  const [note, setNote] = useState('');
  const [offered, setOffered] = useState('');

  useEffect(() => {
    if (open) {
      setNote('');
      setOffered('');
    }
  }, [open]);

  const myShifts = (mine.data ?? []).filter((l) => l.type !== 'seek' && isOpen(l));
  const canOffer = listing.type === 'exchange' || listing.type === 'seek';

  const submit = async () => {
    try {
      await express.mutateAsync({ listingId: listing.id, offeredListingId: offered || null, note: note.trim() || null });
      toast.success('העניין נשלח. בעל המודעה קיבל התראה.');
      onOpenChange(false);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="הבעת עניין"
      description="בעל המודעה יקבל התראה באפליקציה. אפשר גם לפנות ישירות בוואטסאפ."
      footer={
        <Button className="w-full" onClick={submit} loading={express.isPending}>
          שליחה
        </Button>
      }
    >
      <div className="space-y-5">
        {canOffer && r && (
          <Field label={listing.type === 'exchange' ? 'משמרת שלך להצעה בתמורה' : 'משמרת שלך שיכולה להתאים'} optional hint={myShifts.length ? undefined : 'אין לך כרגע מודעת מסירה או החלפה פעילה.'}>
            <Select value={offered} onChange={(e) => setOffered(e.target.value)} disabled={!myShifts.length}>
              <option value="">ללא</option>
              {myShifts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.shift_date ? formatShort(l.shift_date) : ''} · {r.shiftTitle(l)} · {r.positionName(l.position_id)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="הודעה קצרה" optional aside={<span className="tabular text-xs text-muted">{note.length}/280</span>}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={3} />
        </Field>
      </div>
    </Sheet>
  );
}
