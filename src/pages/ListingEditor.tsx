import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader, Panel } from '@/components/PageHeader';
import { MultiDatePicker } from '@/components/MultiDatePicker';
import { PeriodDot } from '@/components/listing-bits';
import { Button } from '@/components/ui/button';
import { Chip, Segmented, Switch } from '@/components/ui/controls';
import { Field, FieldGroup, Input, Textarea } from '@/components/ui/field';
import { TimeInput } from '@/components/ui/time-input';
import { ErrorState, ListSkeleton, Notice } from '@/components/ui/feedback';
import { useToast } from '@/components/ui/toast';
import { useMe } from '@/data/session';
import { useReference } from '@/data/reference';
import { useCreateListing, useListing, useUpdateListing, type ListingInput } from '@/data/listings';
import { addDays, formatTime, isISODate, todayIL } from '@/domain/dates';
import { listingFormSchema, SPECIAL_PERIOD as SPECIAL, type ListingFormValues } from '@/domain/validation';
import { OPTION_LABEL, TYPE_HINT, TYPE_TITLE } from '@/domain/labels';
import type { Listing, ListingType } from '@/domain/types';
import { errorMessage } from '@/lib/errors';
import { isOpen } from '@/domain/matching';

const EMPTY: ListingFormValues = {
  type: 'offer', shiftDate: '', periodId: '', positionId: '', hasOption: false, isCustom: false,
  customTitle: '', customStart: '', customEnd: '', wantDates: [], wantPeriodIds: [], wantPositionIds: [],
  wantOptionOk: true, note: '',
};

function fromListing(l: Listing): ListingFormValues {
  return {
    type: l.type,
    shiftDate: l.shift_date ?? '',
    periodId: l.period_id ?? (l.type !== 'seek' && l.custom_title ? SPECIAL : ''),
    positionId: l.position_id ?? '',
    hasOption: l.has_option,
    isCustom: !!l.custom_title,
    customTitle: l.custom_title ?? '',
    customStart: formatTime(l.custom_start) ?? '',
    customEnd: formatTime(l.custom_end) ?? '',
    wantDates: l.want_dates,
    wantPeriodIds: l.want_period_ids,
    wantPositionIds: l.want_position_ids,
    wantOptionOk: l.want_option_ok,
    note: l.note ?? '',
  };
}

function toInput(v: ListingFormValues): ListingInput {
  const give = v.type !== 'seek';
  const want = v.type !== 'offer';
  const special = v.periodId === SPECIAL;
  const custom = give && (v.isCustom || special);
  return {
    type: v.type,
    shift_date: give ? v.shiftDate : null,
    period_id: give && !special ? v.periodId : null,
    position_id: give ? v.positionId : null,
    has_option: give ? v.hasOption : false,
    custom_title: custom ? v.customTitle.trim() : null,
    custom_start: custom && v.customStart ? v.customStart : null,
    custom_end: custom && v.customEnd ? v.customEnd : null,
    want_dates: want ? v.wantDates : [],
    want_period_ids: want ? v.wantPeriodIds : [],
    want_position_ids: want ? v.wantPositionIds : [],
    want_option_ok: want ? v.wantOptionOk : true,
    note: v.note.trim() || null,
  };
}

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

export function ListingEditorPage() {
  const { id } = useParams();
  const editing = !!id;
  const existing = useListing(id);
  const { ref: r, error: refError, refetch } = useReference();
  const me = useMe();

  if (refError) return <ErrorState error={refError} onRetry={refetch} />;
  if (!r || (editing && existing.isLoading)) return <ListSkeleton rows={4} />;
  if (editing && existing.error) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />;
  if (editing && (!existing.data || existing.data.owner_id !== me.user_id || !isOpen(existing.data))) {
    return (
      <>
        <PageHeader title="עריכת מודעה" back />
        <Notice tone="warn">אפשר לערוך רק מודעה פעילה שלך.</Notice>
      </>
    );
  }
  return <Editor initial={editing ? fromListing(existing.data!) : undefined} listing={existing.data ?? undefined} />;
}

function Editor({ initial, listing }: { initial?: ListingFormValues; listing?: Listing }) {
  const { ref: r } = useReference();
  const me = useMe();
  const navigate = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const today = todayIL();
  const create = useCreateListing();
  const update = useUpdateListing();
  const newId = useRef<string>(crypto.randomUUID()); // idempotency: double-submits hit the same primary key
  const wantDatesLabel = useId();

  const [v, setV] = useState<ListingFormValues>(() => {
    if (initial) return initial;
    const t = sp.get('type');
    const d = sp.get('date');
    const type: ListingType = t === 'seek' || t === 'exchange' ? t : 'offer';
    const date = d && isISODate(d) && d >= today ? d : '';
    return { ...EMPTY, type, shiftDate: type !== 'seek' ? date : '', wantDates: type === 'seek' && date ? [date] : [] };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const set = <K extends keyof ListingFormValues>(k: K, val: ListingFormValues[K]) => setV((s) => ({ ...s, [k]: val }));

  const activePositions = useMemo(() => r!.positions.filter((p) => p.is_active), [r]);
  const qualifiedPositions = activePositions.filter((p) => me.qualified.has(p.id));
  // "נמל" is the default position for new listings (if the user may take it).
  useEffect(() => {
    if (listing || v.positionId) return;
    const port = qualifiedPositions.find((p) => p.name.trim() === 'נמל');
    if (port) set('positionId', port.id);
    else if (qualifiedPositions.length === 1) set('positionId', qualifiedPositions[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualifiedPositions.length]);

  const give = v.type !== 'seek';
  const special = v.periodId === SPECIAL;
  const want = v.type !== 'offer';
  const saving = create.isPending || update.isPending;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const parsed = listingFormSchema.safeParse(v);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      // after React renders the messages
      requestAnimationFrame(() =>
        document.querySelector('main [aria-invalid="true"], main [role="alert"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      );
      return;
    }
    setErrors({});
    try {
      if (listing) {
        const saved = await update.mutateAsync({ id: listing.id, version: listing.version, patch: toInput(parsed.data) });
        toast.success('המודעה עודכנה');
        navigate(`/listing/${saved.id}`, { replace: true });
      } else {
        const saved = await create.mutateAsync({ ...toInput(parsed.data), id: newId.current, org_id: me.orgId, owner_id: me.user_id });
        toast.success('המודעה פורסמה בלוח');
        navigate(`/listing/${saved.id}`, { replace: true });
      }
    } catch (err) {
      setServerError(errorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-2xl">
      <PageHeader title={listing ? 'עריכת מודעה' : 'פרסום מודעה'} subtitle={TYPE_HINT[v.type]} back />

      {!listing && (
        <Segmented
          label="סוג מודעה"
          value={v.type}
          onChange={(t) => setV((s) => ({ ...s, type: t }))}
          options={(['offer', 'seek', 'exchange'] as ListingType[]).map((t) => ({ value: t, label: TYPE_TITLE[t] }))}
          className="mb-6"
        />
      )}

      {qualifiedPositions.length === 0 && (
        <Notice tone="warn" className="mb-6">
          לא נמצאו עמדות שמתאימות לתגים בפרופיל שלך. אם זו טעות, יש לפנות להנהלה כדי לעדכן את התגים.
        </Notice>
      )}

      {give && (
        <Panel className="space-y-6 p-4 sm:p-5">
          <h2 className="font-semibold">{v.type === 'exchange' ? 'המשמרת שלך' : 'פרטי המשמרת'}</h2>

          <Field label="תאריך" error={errors.shiftDate}>
            <Input type="date" value={v.shiftDate} min={today} max={addDays(today, 60)} onChange={(e) => set('shiftDate', e.target.value)} className="tabular" />
          </Field>

          <FieldGroup legend="משמרת" error={errors.periodId}>
            <div role="group" aria-label="משמרת" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {r!.periods.map((p) => {
                const on = v.periodId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set('periodId', p.id)}
                    className={`flex min-h-14 flex-col items-start justify-center rounded-md border px-3 py-2 text-start transition-colors ${
                      on ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface hover:border-ink-2/40'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <PeriodDot code={p.code} />
                      {r!.periodLabel(p.id)}
                    </span>
                    {r!.periodTimes(p.id) && <bdi dir="ltr" className={`tabular font-mono text-xs ${on ? 'text-ink-2' : 'text-muted'}`}>{r!.periodTimes(p.id)}</bdi>}
                  </button>
                );
              })}
              <button
                type="button"

                aria-pressed={special}
                onClick={() => set('periodId', SPECIAL)}
                className={`col-span-2 flex min-h-14 flex-col items-start justify-center rounded-md border border-dashed px-3 py-2 text-start transition-colors sm:col-span-5 ${
                  special ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface hover:border-ink-2/40'
                }`}
              >
                <span className="font-medium">משמרת מיוחדת</span>
                <span className="text-xs text-muted">משמרת שאינה מהקבועות, עם שם, פירוט ושעות משלה</span>
              </button>
            </div>
          </FieldGroup>

          {special && (
            <div className="space-y-4 rounded-md bg-surface-2 p-3">
              <Field label="שם המשמרת" error={errors.customTitle} aside={<span className="tabular text-xs text-muted">{v.customTitle.length}/40</span>}>
                <Input value={v.customTitle} onChange={(e) => set('customTitle', e.target.value)} maxLength={40} placeholder="למשל: משמרת אירוע, תגבור, ליווי" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="שעת התחלה" error={errors.customStart}>
                  <TimeInput value={v.customStart} onChange={(x) => set('customStart', x)} />
                </Field>
                <Field label="שעת סיום" error={errors.customEnd}>
                  <TimeInput value={v.customEnd} onChange={(x) => set('customEnd', x)} />
                </Field>
              </div>
              <p className="text-xs text-muted">את הפירוט (מיקום, דרישות, מה צריך לדעת) כותבים בשדה ״פירוט המשמרת״ למטה.</p>
            </div>
          )}

          <FieldGroup legend="עמדה" error={errors.positionId} hint={activePositions.some((p) => !me.qualified.has(p.id)) ? 'עמדות נעולות דורשות תג שאין בפרופיל שלך.' : undefined}>
            <div className="flex flex-wrap gap-2">
              {activePositions.map((p) => (
                <Chip key={p.id} selected={v.positionId === p.id} onToggle={() => set('positionId', p.id)} locked={!me.qualified.has(p.id)}>
                  {p.name}
                </Chip>
              ))}
            </div>
          </FieldGroup>

          <div className="divide-y divide-line rounded-md border border-line px-3">
            <Switch checked={v.hasOption} onChange={(x) => set('hasOption', x)} label={OPTION_LABEL} description="המשמרת יכולה להתארך ל-12 שעות. לא מניחים שהאופציה תופעל." />
            {!special && (
              <Switch checked={v.isCustom} onChange={(x) => set('isCustom', x)} label="שם או שעות שונים" description="משמרת קבועה עם שם אחר או שעות שונות מהרגיל." />
            )}
          </div>

          {v.isCustom && !special && (
            <div className="space-y-4 rounded-md bg-surface-2 p-3">
              <Field label="שם המשמרת" error={errors.customTitle} aside={<span className="tabular text-xs text-muted">{v.customTitle.length}/40</span>}>
                <Input value={v.customTitle} onChange={(e) => set('customTitle', e.target.value)} maxLength={40} placeholder="למשל: משמרת אירוע" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="שעת התחלה" optional error={errors.customStart}>
                  <TimeInput value={v.customStart} onChange={(x) => set('customStart', x)} />
                </Field>
                <Field label="שעת סיום" optional error={errors.customEnd}>
                  <TimeInput value={v.customEnd} onChange={(x) => set('customEnd', x)} />
                </Field>
              </div>
            </div>
          )}
        </Panel>
      )}

      {want && (
        <Panel className={`space-y-6 p-4 sm:p-5 ${give ? 'mt-4' : ''}`}>
          <h2 className="font-semibold">{v.type === 'exchange' ? 'מה רוצים בתמורה' : 'מה מחפשים'}</h2>

          <div className="space-y-2">
            <p id={wantDatesLabel} className="text-sm font-medium">
              תאריכים <span className="font-normal text-muted">(אפשר כמה)</span>
            </p>
            <MultiDatePicker today={today} value={v.wantDates} onChange={(d) => set('wantDates', d)} labelledBy={wantDatesLabel} />
            {errors.wantDates ? (
              <p className="text-xs font-medium text-danger" role="alert">{errors.wantDates}</p>
            ) : (
              <p className="text-xs text-muted">{v.wantDates.length ? `${v.wantDates.length} תאריכים נבחרו` : 'יש לבחור לפחות תאריך אחד'}</p>
            )}
          </div>

          <FieldGroup legend="משמרות" hint="בלי בחירה = כל משמרת.">
            <div className="flex flex-wrap gap-2">
              {r!.periods.map((p) => (
                <Chip key={p.id} selected={v.wantPeriodIds.includes(p.id)} onToggle={() => set('wantPeriodIds', toggle(v.wantPeriodIds, p.id))}>
                  <PeriodDot code={p.code} />
                  {r!.periodLabel(p.id)}
                </Chip>
              ))}
            </div>
          </FieldGroup>

          <FieldGroup legend="עמדות" hint="בלי בחירה = כל עמדה שיש לך הסמכה אליה.">
            <div className="flex flex-wrap gap-2">
              {activePositions.map((p) => (
                <Chip
                  key={p.id}
                  selected={v.wantPositionIds.includes(p.id)}
                  onToggle={() => set('wantPositionIds', toggle(v.wantPositionIds, p.id))}
                  locked={!me.qualified.has(p.id)}
                >
                  {p.name}
                </Chip>
              ))}
            </div>
          </FieldGroup>

          <div className="rounded-md border border-line px-3">
            <Switch checked={v.wantOptionOk} onChange={(x) => set('wantOptionOk', x)} label="מתאים גם עם אופציה ל-12 שעות" />
          </div>
        </Panel>
      )}

      <Panel className="mt-4 p-4 sm:p-5">
        <Field label={special && give ? 'פירוט המשמרת' : 'הערות'} optional error={errors.note} aside={<span className="tabular text-xs text-muted">{v.note.length}/280</span>}>
          <Textarea value={v.note} onChange={(e) => set('note', e.target.value)} maxLength={280} placeholder="פרטים שחשוב לדעת" />
        </Field>
      </Panel>

      {serverError && <Notice tone="danger" className="mt-4">{serverError}</Notice>}

      <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-6 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0">
        <div className="flex gap-2">
          <Button type="submit" className="flex-1 sm:flex-none sm:px-8" loading={saving}>
            {listing ? 'שמירת שינויים' : 'פרסום בלוח'}
          </Button>
          <Button variant="secondary" onClick={() => navigate(-1)} disabled={saving}>
            ביטול
          </Button>
        </div>
      </div>
    </form>
  );
}
