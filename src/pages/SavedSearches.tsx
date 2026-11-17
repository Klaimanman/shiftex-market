import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, Pencil, Trash2 } from 'lucide-react';
import { PageHeader, Panel } from '@/components/PageHeader';
import { SaveSearchSheet } from '@/components/SaveSearchSheet';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useMe } from '@/data/session';
import { useReference } from '@/data/reference';
import { useDeleteSavedSearch, useSaveSearch, useSavedSearches } from '@/data/notifications';
import { filtersToSearch } from '@/lib/filters';
import { TYPE_LABEL } from '@/domain/labels';
import type { SavedSearch } from '@/domain/types';

export function SavedSearchesPage() {
  const me = useMe();
  const navigate = useNavigate();
  const toast = useToast();
  const { ref: r } = useReference();
  const q = useSavedSearches(me.user_id);
  const save = useSaveSearch(me.user_id);
  const del = useDeleteSavedSearch(me.user_id);
  const [editing, setEditing] = useState<SavedSearch | null>(null);
  const [deleting, setDeleting] = useState<SavedSearch | null>(null);

  const describe = (s: SavedSearch) => {
    const f = s.filters;
    const parts = [
      ...(f.types ?? []).map((t) => TYPE_LABEL[t]),
      ...(f.periods ?? []).map((p) => r?.periodLabel(p) ?? ''),
      ...(f.positions ?? []).map((p) => r?.positionName(p) ?? ''),
      ...(f.option === true ? ['עם אופציה'] : f.option === false ? ['בלי אופציה'] : []),
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'כל המודעות';
  };

  return (
    <>
      <PageHeader title="חיפושים שמורים" subtitle="חזרה מהירה לסינון קבוע, והתראה כשעולה משמרת מתאימה." />
      {q.isLoading ? (
        <ListSkeleton rows={2} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <Panel>
          <EmptyState
            title="אין חיפושים שמורים"
            body="בלוח השבועי בוחרים סינון ולוחצים ״שמירת החיפוש״."
            action={<ButtonLink to="/market" variant="secondary">ללוח השבועי</ButtonLink>}
          />
        </Panel>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {q.data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
              <button type="button" onClick={() => navigate(`/market?${filtersToSearch(s.filters)}`)} className="min-w-0 flex-1 text-start">
                <span className="block font-medium hover:underline">{s.name}</span>
                <span className="mt-0.5 block truncate text-sm text-muted">{describe(s)}</span>
              </button>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={s.notify ? 'כיבוי התראות לחיפוש' : 'הפעלת התראות לחיפוש'}
                  aria-pressed={s.notify}
                  onClick={async () => {
                    try {
                      await save.mutateAsync({ id: s.id, name: s.name, filters: s.filters, notify: !s.notify, orgId: me.orgId });
                    } catch (e) {
                      toast.error(e);
                    }
                  }}
                >
                  {s.notify ? <Bell className="size-[18px] text-accent" aria-hidden="true" /> : <BellOff className="size-[18px]" aria-hidden="true" />}
                </Button>
                <Button variant="ghost" size="icon" aria-label="עריכה" onClick={() => setEditing(s)}>
                  <Pencil className="size-[18px]" aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="מחיקה" onClick={() => setDeleting(s)}>
                  <Trash2 className="size-[18px]" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <SaveSearchSheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} filters={editing.filters} existing={editing} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`למחוק את ״${deleting?.name ?? ''}״?`}
        confirmLabel="מחיקה"
        tone="danger"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await del.mutateAsync(deleting.id);
            toast.success('החיפוש נמחק');
          } catch (e) {
            toast.error(e);
            throw e;
          }
        }}
      />
    </>
  );
}
