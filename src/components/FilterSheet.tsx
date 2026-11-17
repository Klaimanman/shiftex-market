import { useEffect, useState } from 'react';
import { Sheet } from './ui/sheet';
import { Button } from './ui/button';
import { Chip, Segmented, Switch } from './ui/controls';
import { FieldGroup } from './ui/field';
import { EMPTY_FILTERS, type ListingType, type MarketFilters } from '@/domain/types';
import { TYPE_LABEL } from '@/domain/labels';
import type { Reference } from '@/data/reference';
import { PeriodDot } from './listing-bits';

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

/** Search & Filters screen (bottom sheet on mobile). Edits a draft; applies on confirm. */
export function FilterSheet({
  open,
  onOpenChange,
  value,
  onApply,
  reference: r,
  qualified,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  value: MarketFilters;
  onApply: (f: MarketFilters) => void;
  reference: Reference;
  qualified: Set<string>;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const optionValue = draft.option === null ? 'any' : draft.option ? 'with' : 'without';

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="סינון הלוח"
      description="הסינון חל על כל ימי השבוע."
      footer={
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            הצגת תוצאות
          </Button>
          <Button variant="secondary" onClick={() => setDraft(EMPTY_FILTERS)}>
            איפוס
          </Button>
        </div>
      }
    >
      <div className="space-y-7">
        <FieldGroup legend="סוג מודעה">
          <div className="flex flex-wrap gap-2">
            {(['offer', 'seek', 'exchange'] as ListingType[]).map((t) => (
              <Chip key={t} selected={draft.types.includes(t)} onToggle={() => setDraft({ ...draft, types: toggle(draft.types, t) })}>
                {TYPE_LABEL[t]}
              </Chip>
            ))}
          </div>
        </FieldGroup>

        <FieldGroup legend="משמרת">
          <div className="flex flex-wrap gap-2">
            {r.periods.map((p) => (
              <Chip key={p.id} selected={draft.periods.includes(p.id)} onToggle={() => setDraft({ ...draft, periods: toggle(draft.periods, p.id) })}>
                <PeriodDot code={p.code} />
                {r.periodLabel(p.id)}
              </Chip>
            ))}
          </div>
        </FieldGroup>

        <FieldGroup legend="עמדה">
          <div className="flex flex-wrap gap-2">
            {r.positions
              .filter((p) => p.is_active)
              .map((p) => (
                <Chip
                  key={p.id}
                  selected={draft.positions.includes(p.id)}
                  onToggle={() => setDraft({ ...draft, positions: toggle(draft.positions, p.id) })}
                  title={!qualified.has(p.id) ? 'דורש הסמכה' : undefined}
                >
                  {p.name}
                </Chip>
              ))}
          </div>
        </FieldGroup>

        <FieldGroup legend="אופציה ל־12 שעות">
          <Segmented
            label="אופציה ל־12 שעות"
            value={optionValue}
            onChange={(v) => setDraft({ ...draft, option: v === 'any' ? null : v === 'with' })}
            options={[
              { value: 'any', label: 'הכול' },
              { value: 'with', label: 'עם אופציה' },
              { value: 'without', label: 'בלי אופציה' },
            ]}
          />
        </FieldGroup>

        <Switch
          checked={draft.qualifiedOnly}
          onChange={(v) => setDraft({ ...draft, qualifiedOnly: v })}
          label="רק משמרות שאפשר לקחת"
          description="מסתיר משמרות בעמדות שדורשות הסמכה שאין לך."
        />
      </div>
    </Sheet>
  );
}
