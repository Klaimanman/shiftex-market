import { useEffect, useState, type FormEvent } from 'react';
import { PageHeader, Panel } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { useOrgSettings } from '@/data/reference';
import { useSaveSettings } from '@/data/admin';
import { emailSchema } from '@/domain/validation';

export function AdminSettings() {
  const q = useOrgSettings();
  const save = useSaveSettings();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [maxActive, setMaxActive] = useState('15');
  const [maxDaily, setMaxDaily] = useState('20');
  const [retention, setRetention] = useState('90');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!q.data) return;
    setEmail(q.data.coordinator_email ?? '');
    setMaxActive(String(q.data.max_active_listings));
    setMaxDaily(String(q.data.max_new_listings_per_day));
    setRetention(String(q.data.closed_retention_days));
  }, [q.data]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (email && !emailSchema.safeParse(email).success) errs.email = 'כתובת מייל לא תקינה';
    const n = (v: string, min: number, max: number, k: string) => {
      const x = Number(v);
      if (!Number.isInteger(x) || x < min || x > max) errs[k] = `מספר בין ${min} ל-${max}`;
      return x;
    };
    const a = n(maxActive, 1, 100, 'maxActive');
    const d = n(maxDaily, 1, 200, 'maxDaily');
    const r = n(retention, 7, 730, 'retention');
    setErrors(errs);
    if (Object.keys(errs).length || !q.data) return;
    try {
      await save.mutateAsync({ org_id: q.data.org_id, coordinator_email: email.trim() || null, max_active_listings: a, max_new_listings_per_day: d, closed_retention_days: r });
      toast.success('ההגדרות נשמרו');
    } catch (err) {
      toast.error(err);
    }
  };

  if (q.isLoading) return <ListSkeleton rows={2} />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  return (
    <form onSubmit={submit} noValidate className="max-w-xl">
      <PageHeader title="הגדרות ארגון" />
      <Panel className="space-y-5 p-4 sm:p-5">
        <Field label="מייל רכז השיבוץ" hint="ממולא אוטומטית בטיוטות המייל שעובדים מכינים אחרי סיכום העברה." error={errors.email}>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className="text-right" inputMode="email" placeholder="scheduling@example.com" />
        </Field>
      </Panel>
      <Panel className="mt-4 space-y-5 p-4 sm:p-5">
        <h2 className="font-semibold">הגבלות נגד הצפה</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="מודעות פעילות לעובד" error={errors.maxActive}>
            <Input type="number" inputMode="numeric" value={maxActive} onChange={(e) => setMaxActive(e.target.value)} />
          </Field>
          <Field label="מודעות חדשות ביום לעובד" error={errors.maxDaily}>
            <Input type="number" inputMode="numeric" value={maxDaily} onChange={(e) => setMaxDaily(e.target.value)} />
          </Field>
        </div>
        <Field label="שמירת מודעות סגורות (ימים)" hint="אחרי התקופה הזו מודעות סגורות נמחקות אוטומטית." error={errors.retention}>
          <Input type="number" inputMode="numeric" value={retention} onChange={(e) => setRetention(e.target.value)} className="sm:w-40" />
        </Field>
      </Panel>
      <Button type="submit" className="mt-5" loading={save.isPending}>
        שמירת הגדרות
      </Button>
    </form>
  );
}
