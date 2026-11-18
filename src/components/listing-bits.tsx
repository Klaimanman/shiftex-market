import { Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Listing, PeriodCode } from '@/domain/types';
import type { Reference } from '@/data/reference';
import { formatShort } from '@/domain/dates';
import { OPTION_LABEL, STATUS_LABEL, TYPE_LABEL } from '@/domain/labels';
import { Tag } from './ui/controls';

export const PERIOD_BG: Record<PeriodCode, string> = {
  morning: 'bg-p-morning',
  afternoon: 'bg-p-afternoon',
  night: 'bg-p-night',
  oncall: 'bg-p-oncall',
  oncall_afternoon: 'bg-p-oncall',
  oncall_night: 'bg-p-oncall',
  port: 'bg-p-port',
};

export const PERIOD_TEXT: Record<PeriodCode, string> = {
  morning: 'text-p-morning',
  afternoon: 'text-p-afternoon',
  night: 'text-p-night',
  oncall: 'text-p-oncall',
  oncall_afternoon: 'text-p-oncall',
  oncall_night: 'text-p-oncall',
  port: 'text-p-port',
};

export function PeriodDot({ code, className }: { code: PeriodCode | undefined; className?: string }) {
  return <span className={cn('inline-block size-2 rounded-full', code ? PERIOD_BG[code] : 'bg-line-strong', className)} aria-hidden="true" />;
}

export function TypeTag({ type }: { type: Listing['type'] }) {
  const tone = type === 'offer' ? 'solid' : type === 'exchange' ? 'outline' : 'neutral';
  return <Tag tone={tone}>{TYPE_LABEL[type]}</Tag>;
}

export function StatusTag({ status }: { status: Listing['status'] }) {
  if (status === 'active') return null;
  const tone = status === 'in_coordination' ? 'warn' : status === 'closed_taken' ? 'accent' : status === 'removed_by_admin' ? 'danger' : 'neutral';
  return <Tag tone={tone}>{STATUS_LABEL[status]}</Tag>;
}

export function OptionTag() {
  return <Tag tone="outline">{OPTION_LABEL}</Tag>;
}

export function LockedHint() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
      <Lock className="size-3.5" aria-hidden="true" />
      דורש הסמכה
    </span>
  );
}

/** One-line description of what a seek / exchange listing wants. */
export function wantedSummary(l: Pick<Listing, 'want_dates' | 'want_period_ids' | 'want_position_ids'>, ref: Reference, opts: { dates?: boolean } = {}): string {
  const parts: string[] = [];
  if (opts.dates !== false) {
    parts.push(l.want_dates.length <= 3 ? l.want_dates.map(formatShort).join(', ') : `${l.want_dates.length} תאריכים`);
  }
  parts.push(l.want_period_ids.length === 0 ? 'כל משמרת' : l.want_period_ids.map((id) => ref.periodLabel(id)).join(' / '));
  const pos = l.want_position_ids;
  const activeCount = ref.positions.filter((p) => p.is_active).length;
  parts.push(pos.length >= activeCount && activeCount > 1 ? 'כל עמדה' : pos.length > 3 ? `${pos.length} עמדות` : pos.map((id) => ref.positionName(id)).join(', '));
  return parts.join(' · ');
}

/** Short title for any listing. */
export function listingHeadline(l: Listing, ref: Reference): string {
  if (l.type === 'seek') return `מחפשים: ${wantedSummary(l, ref, { dates: false })}`;
  return `${ref.shiftTitle(l)} · ${ref.positionName(l.position_id)}`;
}
