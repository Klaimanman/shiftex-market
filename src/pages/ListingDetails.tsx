import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, Check, Lock, Mail, MessageCircle, Pencil, Trash2, X } from 'lucide-react';
import { PageHeader, Panel, Section } from '@/components/PageHeader';
import { Button, ButtonLink } from '@/components/ui/button';
import { Avatar, Tag } from '@/components/ui/controls';
import { EmptyState, ErrorState, ListSkeleton, Notice } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { OptionTag, PERIOD_BG, StatusTag, TypeTag, wantedSummary } from '@/components/listing-bits';
import { ContactSheet } from '@/components/ContactSheet';
import { EmailDraftSheet } from '@/components/EmailDraftSheet';
import { CloseListingSheet } from '@/components/CloseListingSheet';
import { InterestSheet } from '@/components/InterestSheet';
import { MatchPanel } from '@/components/MatchPanel';
import { useMe } from '@/data/session';
import { useColleagues, useReference, type Reference } from '@/data/reference';
import { useDeleteListing, useListing, useListingInterests, useMyInterest, useSetInterestStatus, useUpdateListing } from '@/data/listings';
import { formatLong, formatShort, relativeTimeHe } from '@/domain/dates';
import { isOpen } from '@/domain/matching';
import { composeWhatsAppMessage, NO_SHIFT, type TransferEmail } from '@/domain/messages';
import { OPTION_LABEL, TYPE_TITLE } from '@/domain/labels';
import type { Interest, Listing, MiniProfile } from '@/domain/types';
import { cn } from '@/lib/cn';

export function ListingDetailsPage() {
  const { id } = useParams();
  const q = useListing(id);
  const { ref: r, error: refError, refetch } = useReference();

  if (refError) return <ErrorState error={refError} onRetry={refetch} />;
  if (q.isLoading || !r) return <ListSkeleton rows={2} />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) {
    return (
      <>
        <PageHeader title="מודעה" back="/market" />
        <Panel>
          <EmptyState title="המודעה כבר לא זמינה" body="ייתכן שהיא נסגרה, פג תוקפה או הוסרה." action={<ButtonLink to="/market" variant="secondary">חזרה ללוח</ButtonLink>} />
        </Panel>
      </>
    );
  }
  return <Details listing={q.data} reference={r} />;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3 sm:px-5">
      <dt className="shrink-0 text-sm text-muted">{label}</dt>
      <dd className="text-end font-medium text-ink">{children}</dd>
    </div>
  );
}

function Details({ listing: l, reference: r }: { listing: Listing; reference: Reference }) {
  const [sp] = useSearchParams();
  const justPublished = sp.get('new') === '1';
  const me = useMe();
  const toast = useToast();
  const colleagues = useColleagues();
  const isOwner = l.owner_id === me.user_id;
  const open = isOpen(l);
  const locked = !isOwner && l.type !== 'seek' && !!l.position_id && !me.qualified.has(l.position_id);
  const period = l.period_id ? r.periodById.get(l.period_id) : undefined;
  const times = l.type !== 'seek' ? r.shiftTimes(l) : null;

  const [contactOpen, setContactOpen] = useState<{ userId?: string } | null>(null);
  const [interestOpen, setInterestOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [emailData, setEmailData] = useState<TransferEmail | null>(null);
  /** whose email goes in CC: null = the listing owner, string = a specific member, undefined = none */
  const [ccUser, setCcUser] = useState<string | null | undefined>(undefined);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const update = useUpdateListing();
  const del = useDeleteListing();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const interests = useListingInterests(l.id, isOwner);
  const myInterest = useMyInterest(isOwner ? undefined : l.id, me.user_id);
  const setInterest = useSetInterestStatus();

  const shiftName = l.type === 'seek' ? '' : `${r.shiftTitle(l)}${times ? ` (${times})` : ''}`;

  /**
   * Coordinator email in the organization's format. guard1 = listing owner, guard2 = the colleague.
   *  offer:    owner gives the shift          → owner: shift → none,  other: none → shift
   *  seek:     owner receives a shift          → owner: none → wanted, other: wanted → none
   *  exchange: both give and receive           → owner: shift → wanted, other: wanted → shift
   */
  const emailFor = (counterpart: MiniProfile | null | { full_name: string }): TransferEmail => {
    const ownerName = l.owner?.full_name ?? '';
    const otherName = counterpart?.full_name ?? '';
    const given = l.type === 'seek' ? '' : `${shiftName}, ${r.positionName(l.position_id)}`;
    const wanted = l.type === 'offer' ? '' : wantedSummary(l, r);
    const owner =
      l.type === 'offer' ? { current: given, desired: NO_SHIFT } : l.type === 'seek' ? { current: NO_SHIFT, desired: wanted } : { current: given, desired: wanted };
    const other =
      l.type === 'offer' ? { current: NO_SHIFT, desired: given } : l.type === 'seek' ? { current: wanted, desired: NO_SHIFT } : { current: wanted, desired: given };
    return {
      date: l.shift_date ?? l.want_dates[0] ?? null,
      guard1: { name: ownerName, ...owner },
      guard2: { name: otherName, ...other },
    };
  };

  const waMessage = (name: string) =>
    composeWhatsAppMessage(
      l.type,
      name,
      { date: l.shift_date, shiftName: r.shiftTitle(l), position: l.position_id ? r.positionName(l.position_id) : null },
      l.type === 'seek' ? `משמרת ${wantedSummary(l, r)}` : undefined,
    );

  const toggleCoordination = async () => {
    try {
      await update.mutateAsync({ id: l.id, version: l.version, patch: { status: l.status === 'active' ? 'in_coordination' : 'active' } });
      toast.success(l.status === 'active' ? 'סומן כ״בתיאום״' : 'המודעה חזרה להיות פעילה');
    } catch (e) {
      toast.error(e);
    }
  };

  const takenByProfile = useMemo(() => colleagues.data?.find((c) => c.id === l.taken_by) ?? null, [colleagues.data, l.taken_by]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={TYPE_TITLE[l.type]} back />

      {!open && (
        <Notice tone={l.status === 'removed_by_admin' ? 'danger' : 'info'} className="mb-4">
          {l.status === 'closed_taken'
            ? 'המודעה נסגרה כי המשמרת נלקחה.'
            : l.status === 'closed_cancelled'
              ? 'המודעה בוטלה.'
              : l.status === 'removed_by_admin'
                ? `המודעה הוסרה על ידי ההנהלה${l.removed_reason && l.removed_reason !== 'member_inactive' ? `: ${l.removed_reason}` : '.'}`
                : 'תוקף המודעה פג כי המשמרת כבר התחילה.'}
        </Notice>
      )}

      <Panel className="relative overflow-hidden">
        <span className={cn('absolute inset-y-0 start-0 w-1', period ? PERIOD_BG[period.code] : 'bg-line-strong')} aria-hidden="true" />
        <div className="border-b border-line px-4 pb-4 pt-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <TypeTag type={l.type} />
            <StatusTag status={l.status} />
            {l.has_option && <OptionTag />}
          </div>
          <h2 className="mt-3 text-lg font-semibold leading-snug">
            {l.type === 'seek' ? `מחפשים משמרת: ${wantedSummary(l, r, { dates: false })}` : `${r.shiftTitle(l)} · ${r.positionName(l.position_id)}`}
          </h2>
          {l.shift_date && <p className="mt-1 text-ink-2">{formatLong(l.shift_date, true)}</p>}
        </div>

        <dl className="divide-y divide-line">
          {l.type !== 'seek' && (
            <>
              <Row label="משמרת">
                {l.period_id ? (
                  <>
                    {r.periodLabel(l.period_id)}
                    {l.custom_title && <span className="text-muted"> · {l.custom_title}</span>}
                  </>
                ) : (
                  <>
                    {l.custom_title} <span className="text-muted">· משמרת מיוחדת</span>
                  </>
                )}
              </Row>
              <Row label="שעות">{times ? <bdi dir="ltr" className="tabular font-mono text-sm">{times}</bdi> : <span className="text-muted">לא הוגדרו</span>}</Row>
              <Row label="עמדה">
                <span className="inline-flex items-center gap-1.5">
                  {locked && <Lock className="size-3.5 text-muted" aria-hidden="true" />}
                  {r.positionName(l.position_id)}
                </span>
              </Row>
              <Row label={OPTION_LABEL}>{l.has_option ? 'כן' : 'לא'}</Row>
            </>
          )}
          {l.type !== 'offer' && (
            <>
              <Row label={l.type === 'exchange' ? 'תאריכים בתמורה' : 'תאריכים'}>
                <span className="tabular">{l.want_dates.map(formatShort).join(', ')}</span>
              </Row>
              <Row label="משמרות">{l.want_period_ids.length ? l.want_period_ids.map((p) => r.periodLabel(p)).join(' / ') : 'כל משמרת'}</Row>
              <Row label="עמדות">{l.want_position_ids.map((p) => r.positionName(p)).join(', ')}</Row>
              <Row label="אופציה ל-12 שעות">{l.want_option_ok ? 'מתאים' : 'לא מתאים'}</Row>
            </>
          )}
        </dl>

        {l.note && (
          <div className="border-t border-line px-4 py-4 sm:px-5">
            <p className="text-sm text-muted">הערות</p>
            <p className="mt-1 whitespace-pre-line text-ink">{l.note}</p>
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-line bg-surface-2 px-4 py-3 sm:px-5">
          <Avatar name={l.owner?.full_name ?? ''} src={l.owner?.avatar_url} size={32} />
          <div className="min-w-0 text-sm">
            <p className="font-medium">{isOwner ? 'המודעה שלך' : l.owner?.full_name}</p>
            <p className="text-muted">פורסמה {relativeTimeHe(l.created_at)}</p>
          </div>
        </div>
      </Panel>

      {/* Viewer actions */}
      {!isOwner && open && (
        <div className="mt-4 space-y-3">
          {locked && (
            <Notice tone="warn">
              עמדת {r.positionName(l.position_id)} דורשת הסמכה שאין בפרופיל שלך, ולכן אי אפשר לבקש את המשמרת הזו. אם זו טעות, ההנהלה יכולה לעדכן את התגים.
            </Notice>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <Button disabled={locked} onClick={() => setContactOpen({})} icon={<MessageCircle className="size-4" aria-hidden="true" />}>
              פנייה בוואטסאפ
            </Button>
            {myInterest.data && myInterest.data.status !== 'withdrawn' ? (
              <Button variant="secondary" onClick={() => setWithdrawOpen(true)} icon={<Check className="size-4 text-accent" aria-hidden="true" />}>
                {myInterest.data.status === 'accepted' ? 'העניין התקבל' : myInterest.data.status === 'declined' ? 'העניין נדחה' : 'העניין נשלח'}
              </Button>
            ) : (
              <Button variant="secondary" disabled={locked} onClick={() => setInterestOpen(true)}>
                הבעת עניין
              </Button>
            )}
            <Button variant="ghost" disabled={locked} onClick={() => {
                setCcUser(null);
                setEmailData(emailFor({ full_name: me.full_name }));
              }} icon={<Mail className="size-4" aria-hidden="true" />}>
              מייל לרכז
            </Button>
          </div>
          <p className="text-xs text-muted">ShiftEX הוא כלי תיאום בלבד. העברה רשמית מתבצעת מול רכז השיבוץ לפי הנהלים.</p>
        </div>
      )}

      {isOwner && open && (
        <div className="mt-4">
          <MatchPanel listing={l} reference={r} justPublished={justPublished} />
        </div>
      )}

      {/* Owner actions */}
      {isOwner && (
        <div className="mt-4 space-y-3">
          {open ? (
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button onClick={() => setCloseOpen(true)} className="col-span-2 sm:col-span-1">
                סגירת המודעה
              </Button>
              <Button variant="secondary" onClick={toggleCoordination} loading={update.isPending}>
                {l.status === 'active' ? 'סימון ״בתיאום״' : 'החזרה לפעילה'}
              </Button>
              <ButtonLink to={`/listing/${l.id}/edit`} variant="secondary" icon={<Pencil className="size-4" aria-hidden="true" />}>
                עריכה
              </ButtonLink>
            </div>
          ) : (
            l.status === 'closed_taken' && (
              <Button variant="secondary" icon={<Mail className="size-4" aria-hidden="true" />} onClick={() => {
                setCcUser(l.taken_by ?? undefined);
                setEmailData(emailFor(takenByProfile));
              }}>
                הכנת מייל לרכז השיבוץ
              </Button>
            )
          )}
          {open && <p className="text-xs text-muted">״בתיאום״ מסמן לאחרים שכבר מדברים על המשמרת. המודעה נשארת גלויה עד שסוגרים אותה.</p>}
          <Button variant="danger" size="sm" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setDeleteOpen(true)}>
            מחיקת המודעה
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="למחוק את המודעה?"
        body={l.status === 'closed_taken' ? 'המשמרת כבר נלקחה. המודעה תימחק לגמרי מהרשימות.' : 'המודעה תימחק לגמרי ותוסר מהלוח. אי אפשר לשחזר.'}
        confirmLabel="מחיקה"
        tone="danger"
        onConfirm={async () => {
          try {
            await del.mutateAsync(l.id);
            toast.success('המודעה נמחקה');
            navigate('/mine', { replace: true });
          } catch (e) {
            toast.error(e);
            throw e;
          }
        }}
      />

      {isOwner && (
        <Section title="מי הביע עניין" className="mt-8">
          {interests.isLoading ? (
            <ListSkeleton rows={1} />
          ) : interests.error ? (
            <ErrorState error={interests.error} onRetry={() => interests.refetch()} />
          ) : !interests.data?.length ? (
            <Panel>
              <EmptyState compact title="עדיין אין פניות" body="כשמישהו יביע עניין, תופיע כאן התראה ואפשרות לפנות אליו." />
            </Panel>
          ) : (
            <ul className="space-y-2">
              {interests.data.map((i) => (
                <InterestRow
                  key={i.id}
                  interest={i}
                  canAct={open}
                  onContact={() => setContactOpen({ userId: i.user_id })}
                  onStatus={async (status) => {
                    try {
                      await setInterest.mutateAsync({ id: i.id, status });
                    } catch (e) {
                      toast.error(e);
                    }
                  }}
                />
              ))}
            </ul>
          )}
        </Section>
      )}

      <ContactSheet
        open={!!contactOpen}
        onOpenChange={(o) => !o && setContactOpen(null)}
        listingId={l.id}
        userId={contactOpen?.userId}
        buildMessage={(name) =>
          contactOpen?.userId
            ? `היי ${name.split(' ')[0]}, ראיתי ב-ShiftEX Market שהבעת עניין במודעה שלי (${l.shift_date ? formatShort(l.shift_date) : wantedSummary(l, r)}). מתאים לדבר?`
            : waMessage(name)
        }
        key={contactOpen?.userId ?? 'owner'}
      />
      {!isOwner && <InterestSheet open={interestOpen} onOpenChange={setInterestOpen} listing={l} />}
      {isOwner && (
        <CloseListingSheet
          open={closeOpen}
          onOpenChange={setCloseOpen}
          listing={l}
          suggested={interests.data?.find((i) => i.status === 'accepted')?.user_id ?? null}
          onClosed={(status, takenBy) => {
            if (status !== 'closed_taken') return;
            setCcUser(takenBy?.id ?? undefined);
            setEmailData(emailFor(takenBy));
          }}
        />
      )}
      {emailData && <EmailDraftSheet
          open={!!emailData}
          onOpenChange={(o) => !o && setEmailData(null)}
          data={emailData}
          cc={ccUser === undefined ? null : { listingId: l.id, userId: ccUser }}
        />}
      <ConfirmDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title="ביטול הבעת העניין?"
        body="בעל המודעה יראה שהעניין בוטל."
        confirmLabel="ביטול העניין"
        tone="danger"
        onConfirm={async () => {
          if (!myInterest.data) return;
          try {
            await setInterest.mutateAsync({ id: myInterest.data.id, status: 'withdrawn' });
            toast.success('העניין בוטל');
          } catch (e) {
            toast.error(e);
            throw e;
          }
        }}
      />
    </div>
  );
}

function InterestRow({
  interest: i,
  canAct,
  onContact,
  onStatus,
}: {
  interest: Interest;
  canAct: boolean;
  onContact: () => void;
  onStatus: (s: Interest['status']) => void;
}) {
  const withdrawn = i.status === 'withdrawn';
  return (
    <li className={cn('rounded-lg border border-line bg-surface p-4', withdrawn && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <Avatar name={i.user?.full_name ?? ''} src={i.user?.avatar_url} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{i.user?.full_name}</span>
            {i.status === 'accepted' && <Tag tone="accent">התקבל</Tag>}
            {i.status === 'declined' && <Tag>נדחה</Tag>}
            {withdrawn && <Tag>בוטל</Tag>}
            <span className="text-xs text-muted">{relativeTimeHe(i.created_at)}</span>
          </div>
          {i.offered_listing_id && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
              מציע/ה משמרת בתמורה:{' '}
              <ButtonLink to={`/listing/${i.offered_listing_id}`} variant="quiet" size="sm" className="h-7 px-1.5">
                צפייה
              </ButtonLink>
            </p>
          )}
          {i.note && <p className="mt-1 text-sm text-ink-2">{i.note}</p>}
        </div>
      </div>
      {!withdrawn && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" icon={<MessageCircle className="size-4" aria-hidden="true" />} onClick={onContact}>
            וואטסאפ
          </Button>
          {canAct && i.status !== 'accepted' && (
            <Button size="sm" variant="secondary" icon={<Check className="size-4" aria-hidden="true" />} onClick={() => onStatus('accepted')}>
              סימון כמתאים
            </Button>
          )}
          {canAct && i.status === 'open' && (
            <Button size="sm" variant="ghost" icon={<X className="size-4" aria-hidden="true" />} onClick={() => onStatus('declined')}>
              לא מתאים
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
