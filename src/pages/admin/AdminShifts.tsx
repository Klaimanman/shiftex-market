import { useEffect, useState } from 'react';
import { PageHeader, Panel } from '@/components/PageHeader';
import { PeriodDot } from '@/components/listing-bits';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { TimeInput } from '@/components/ui/time-input';
import { ErrorState, ListSkeleton, Notice } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { usePeriods } from '@/data/reference';
import { useSavePeriod } from '@/data/admin';
import { formatTime } from '@/domain/dates';
import type { ShiftPeriod } from '@/domain/types';

export function AdminShifts() {
  const q = usePeriods();
  return (
    <>
      <PageHeader title="משמרות" subtitle="שם ושעות של כל משמרת. השעות קובעות מתי מודעה נסגרת אוטומטית (כשהמשמרת מתחילה)." />
      <Notice className="mb-4">
        משמרת לילה שמסתיימת אחרי חצות — מזינים שעת סיום קטנה משעת ההתחלה (למשל 23:00–07:00). כונן היא משמרת בפני עצמה. כל משמרת יכולה להגיע עם אופציה ל־12 שעות — מסמנים זאת בכל מודעה.
      </Notice>
      {q.isLoading ? <ListSkeleton rows={4} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {(q.data ?? []).map((p) => <PeriodCard key={p.id} period={p} />)}
        </div>
      )}
    </>
  );
}

function PeriodCard({ period: p }: { period: ShiftPeriod }) {
  const toast = useToast();
  const save = useSavePeriod();
  const [label, setLabel] = useState(p.label);
  const [start, setStart] = useState(formatTime(p.start_time) ?? '');
  const [end, setEnd] = useState(formatTime(p.end_time) ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLabel(p.label);
    setStart(formatTime(p.start_time) ?? '');
    setEnd(formatTime(p.end_time) ?? '');
  }, [p]);

  const dirty = label !== p.label || start !== (formatTime(p.start_time) ?? '') || end !== (formatTime(p.end_time) ?? '');

  const submit = async () => {
    if (!label.trim()) return setError('יש לתת שם');
    if (!!start !== !!end) return setError('יש למלא גם שעת התחלה וגם שעת סיום');
    setError(null);
    try {
      await save.mutateAsync({ id: p.id, label, start_time: start || null, end_time: end || null });
      toast.success(`משמרת ${label} עודכנה`);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Panel className="space-y-4 p-4">
      <div className="flex items-center gap-2 font-semibold">
        <PeriodDot code={p.code} className="size-2.5" />
        {p.label}
        {!p.start_time && <span className="text-xs font-normal text-warn">שעות לא הוגדרו</span>}
      </div>
      <Field label="שם תצוגה" error={error}>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={30} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="התחלה">
          <TimeInput value={start} onChange={setStart} />
        </Field>
        <Field label="סיום">
          <TimeInput value={end} onChange={setEnd} />
        </Field>
      </div>
      <Button size="sm" disabled={!dirty} loading={save.isPending} onClick={submit}>
        שמירה
      </Button>
    </Panel>
  );
}
