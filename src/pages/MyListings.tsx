import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader, Panel } from '@/components/PageHeader';
import { ListingCard } from '@/components/ListingCard';
import { ButtonLink } from '@/components/ui/button';
import { Segmented } from '@/components/ui/controls';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { useMe } from '@/data/session';
import { useReference } from '@/data/reference';
import { useMyListings } from '@/data/listings';
import { isOpen } from '@/domain/matching';

export function MyListingsPage() {
  const me = useMe();
  const { ref: r } = useReference();
  const q = useMyListings(me.user_id);
  const [tab, setTab] = useState<'open' | 'closed'>('open');

  const [openItems, closedItems] = useMemo(() => {
    const all = q.data ?? [];
    return [all.filter((l) => isOpen(l)), all.filter((l) => !isOpen(l))];
  }, [q.data]);
  const items = tab === 'open' ? openItems : closedItems;

  return (
    <>
      <PageHeader
        title="המודעות שלי"
        actions={
          <ButtonLink to="/new" size="sm" icon={<Plus className="size-4" aria-hidden="true" />}>
            מודעה חדשה
          </ButtonLink>
        }
      />
      <Segmented
        label="סינון מודעות"
        value={tab}
        onChange={setTab}
        size="sm"
        className="mb-5 max-w-xs"
        options={[
          { value: 'open', label: `פעילות (${openItems.length})` },
          { value: 'closed', label: `סגורות (${closedItems.length})` },
        ]}
      />
      {q.isLoading || !r ? (
        <ListSkeleton rows={3} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <Panel>
          <EmptyState
            title={tab === 'open' ? 'אין מודעות פעילות' : 'אין מודעות סגורות'}
            body={tab === 'open' ? 'מודעה שמפרסמים מופיעה בלוח של כל העמיתים עד שסוגרים אותה או שהמשמרת מתחילה.' : 'מודעות סגורות נשמרות כאן לתקופה מוגבלת.'}
            action={tab === 'open' ? <ButtonLink to="/new">פרסום מודעה</ButtonLink> : undefined}
          />
        </Panel>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {items.map((l) => (
            <ListingCard key={l.id} listing={l} reference={r} qualified={me.qualified} isMine showDate />
          ))}
        </div>
      )}
    </>
  );
}
