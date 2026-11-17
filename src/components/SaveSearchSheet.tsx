import { useEffect, useState } from 'react';
import { Sheet } from './ui/sheet';
import { Button } from './ui/button';
import { Field, Input } from './ui/field';
import { Switch } from './ui/controls';
import { useToast } from './ui/toast';
import { useMe } from '@/data/session';
import { useSaveSearch } from '@/data/notifications';
import type { MarketFilters, SavedSearch } from '@/domain/types';

export function SaveSearchSheet({
  open,
  onOpenChange,
  filters,
  existing,
  suggestedName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filters: MarketFilters | SavedSearch['filters'];
  existing?: SavedSearch;
  suggestedName?: string;
}) {
  const me = useMe();
  const save = useSaveSearch(me.user_id);
  const toast = useToast();
  const [name, setName] = useState('');
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(existing?.name ?? suggestedName ?? '');
      setNotify(existing?.notify ?? true);
      setError(null);
    }
  }, [open, existing, suggestedName]);

  const submit = async () => {
    if (name.trim().length < 1) {
      setError('יש לתת שם לחיפוש');
      return;
    }
    try {
      await save.mutateAsync({ id: existing?.id, name: name.trim().slice(0, 40), filters, notify, orgId: me.orgId });
      toast.success(existing ? 'החיפוש עודכן' : 'החיפוש נשמר');
      onOpenChange(false);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? 'עריכת חיפוש שמור' : 'שמירת החיפוש'}
      description="חיפוש שמור מאפשר לחזור לסינון בלחיצה, ולקבל התראה כשמתפרסמת משמרת מתאימה."
      footer={
        <Button className="w-full" onClick={submit} loading={save.isPending}>
          שמירה
        </Button>
      }
    >
      <div className="space-y-5">
        <Field label="שם" error={error}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="למשל: לילות בסיור" />
        </Field>
        <Switch checked={notify} onChange={setNotify} label="התראה על משמרות חדשות" description="רק משמרות שמתאימות להסמכות שלך." />
      </div>
    </Sheet>
  );
}
