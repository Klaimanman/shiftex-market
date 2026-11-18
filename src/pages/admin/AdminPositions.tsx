import { useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import { PageHeader, Panel } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Switch, Tag } from '@/components/ui/controls';
import { Field, Input } from '@/components/ui/field';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/feedback';
import { ConfirmDialog, Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { usePositions } from '@/data/reference';
import { useDeletePosition, useSavePosition } from '@/data/admin';
import { useMe } from '@/data/session';
import type { Position } from '@/domain/types';

export function AdminPositions() {
  const q = usePositions();
  const [editing, setEditing] = useState<Position | 'new' | null>(null);

  return (
    <>
      <PageHeader
        title="עמדות"
        subtitle="העמדות שאפשר לפרסם בהן משמרות. עמדה מושבתת לא זמינה למודעות חדשות."
        actions={<Button size="sm" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEditing('new')}>עמדה חדשה</Button>}
      />
      {q.isLoading ? (
        <ListSkeleton rows={4} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <Panel><EmptyState title="אין עמדות" action={<Button onClick={() => setEditing('new')}>הוספת עמדה</Button>} /></Panel>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {q.data.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setEditing(p)} className="flex w-full items-center gap-3 px-4 py-3.5 text-start hover:bg-surface-2">
                <span className="tabular w-6 text-sm text-muted">{p.sort_order}</span>
                <span className="flex-1 font-medium">{p.name}</span>
                {p.requires_qualification && (
                  <Tag tone="outline">
                    <Lock className="size-3" aria-hidden="true" /> דורשת הסמכה
                  </Tag>
                )}
                {!p.is_active && <Tag>מושבתת</Tag>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && <PositionSheet position={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function PositionSheet({ position, onClose }: { position: Position | null; onClose: () => void }) {
  const me = useMe();
  const toast = useToast();
  const save = useSavePosition();
  const del = useDeletePosition();
  const [name, setName] = useState(position?.name ?? '');
  const [requires, setRequires] = useState(position?.requires_qualification ?? false);
  const [active, setActive] = useState(position?.is_active ?? true);
  const [order, setOrder] = useState(String(position?.sort_order ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setError('יש לתת שם לעמדה');
      return;
    }
    try {
      await save.mutateAsync({ id: position?.id, orgId: me.orgId, name, requires_qualification: requires, is_active: active, sort_order: Number(order) || 0 });
      toast.success('העמדה נשמרה');
      onClose();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={position ? 'עריכת עמדה' : 'עמדה חדשה'}
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={submit} loading={save.isPending}>שמירה</Button>
          {position && <Button variant="danger" onClick={() => setConfirmDelete(true)}>מחיקה</Button>}
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="שם העמדה" error={error}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>
        <Field label="סדר תצוגה">
          <Input type="number" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value)} className="w-28" />
        </Field>
        <div className="divide-y divide-line rounded-md border border-line px-3">
          <Switch checked={requires} onChange={setRequires} label="דורשת הסמכה" description="רק עובדים עם תג שמעניק את העמדה יוכלו לפרסם או לבקש משמרות בה." />
          <Switch checked={active} onChange={setActive} label="עמדה פעילה" />
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="למחוק את העמדה?"
        body="אם קיימות מודעות בעמדה הזו, המחיקה תיחסם, אפשר להשבית אותה במקום."
        confirmLabel="מחיקה"
        tone="danger"
        onConfirm={async () => {
          try {
            await del.mutateAsync(position!.id);
            toast.success('העמדה נמחקה');
            onClose();
          } catch (e) {
            toast.error(e);
            throw e;
          }
        }}
      />
    </Sheet>
  );
}
