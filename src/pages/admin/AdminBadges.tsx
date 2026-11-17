import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader, Panel } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Chip, Switch, Tag } from '@/components/ui/controls';
import { Field, FieldGroup, Input } from '@/components/ui/field';
import { EmptyState, ErrorState, ListSkeleton, Notice } from '@/components/ui/feedback';
import { ConfirmDialog, Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useBadges, usePositions } from '@/data/reference';
import { useDeleteBadge, useSaveBadge } from '@/data/admin';
import { useMe } from '@/data/session';
import type { Badge } from '@/domain/types';

export function AdminBadges() {
  const badges = useBadges();
  const positions = usePositions();
  const [editing, setEditing] = useState<Badge | 'new' | null>(null);

  const linksFor = (id: string) => (badges.data?.links ?? []).filter((l) => l.badge_id === id).map((l) => l.position_id);
  const posName = (id: string) => positions.data?.find((p) => p.id === id)?.name ?? '';
  const restricted = (positions.data ?? []).filter((p) => p.requires_qualification);

  return (
    <>
      <PageHeader
        title="תגים והסמכות"
        subtitle="תג מעניק הסמכה לעמדות שדורשות אותה. עובדים בוחרים תגים בהרשמה, וההנהלה מאשרת ומעדכנת."
        actions={<Button size="sm" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEditing('new')}>תג חדש</Button>}
      />
      {restricted.length > 0 && (
        <Notice className="mb-4">
          עמדות שדורשות הסמכה: {restricted.map((p) => p.name).join(', ')}. שאר העמדות פתוחות לכל העובדים הפעילים.
        </Notice>
      )}
      {badges.isLoading || positions.isLoading ? (
        <ListSkeleton rows={3} />
      ) : badges.error ? (
        <ErrorState error={badges.error} onRetry={() => badges.refetch()} />
      ) : !badges.data?.badges.length ? (
        <Panel><EmptyState title="אין תגים" body="למשל: סיור, מוסמך מסוף, מאבטח בכיר." action={<Button onClick={() => setEditing('new')}>יצירת תג</Button>} /></Panel>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {badges.data.badges.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => setEditing(b)} className="flex w-full flex-col gap-2 px-4 py-3.5 text-start hover:bg-surface-2 sm:flex-row sm:items-center">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-medium">
                    {b.name}
                    {!b.is_active && <Tag>מושבת</Tag>}
                  </span>
                  {b.description && <span className="block text-sm text-muted">{b.description}</span>}
                </span>
                <span className="flex flex-wrap gap-1">
                  {linksFor(b.id).map((p) => <Tag key={p} tone="outline">{posName(p)}</Tag>)}
                  {!linksFor(b.id).length && <span className="text-sm text-muted">ללא עמדות</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && <BadgeSheet badge={editing === 'new' ? null : editing} links={editing === 'new' ? [] : linksFor(editing.id)} onClose={() => setEditing(null)} />}
    </>
  );
}

function BadgeSheet({ badge, links, onClose }: { badge: Badge | null; links: string[]; onClose: () => void }) {
  const me = useMe();
  const toast = useToast();
  const positions = usePositions();
  const save = useSaveBadge();
  const del = useDeleteBadge();
  const [name, setName] = useState(badge?.name ?? '');
  const [description, setDescription] = useState(badge?.description ?? '');
  const [active, setActive] = useState(badge?.is_active ?? true);
  const [order, setOrder] = useState(String(badge?.sort_order ?? 0));
  const [posIds, setPosIds] = useState<string[]>(links);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('יש לתת שם לתג');
      return;
    }
    try {
      await save.mutateAsync({ id: badge?.id, orgId: me.orgId, name, description, is_active: active, sort_order: Number(order) || 0, positionIds: posIds, previous: links });
      toast.success('התג נשמר');
      onClose();
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={badge ? 'עריכת תג' : 'תג חדש'}
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={submit} loading={save.isPending}>שמירה</Button>
          {badge && <Button variant="danger" onClick={() => setConfirmDelete(true)}>מחיקה</Button>}
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="שם" error={error}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>
        <Field label="תיאור" optional hint="מוצג לעובדים בזמן ההרשמה.">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
        </Field>
        <FieldGroup legend="מעניק הסמכה לעמדות">
          <div className="flex flex-wrap gap-2">
            {(positions.data ?? []).map((p) => (
              <Chip key={p.id} selected={posIds.includes(p.id)} onToggle={() => setPosIds((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))}>
                {p.name}
                {!p.requires_qualification && <span className="text-xs text-muted">(פתוחה)</span>}
              </Chip>
            ))}
          </div>
        </FieldGroup>
        <Field label="סדר תצוגה">
          <Input type="number" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value)} className="w-28" />
        </Field>
        <Switch checked={active} onChange={setActive} label="תג פעיל" description="תג מושבת לא מעניק הסמכה ולא מוצג בהרשמה." />
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="למחוק את התג?"
        body="התג יוסר מכל העובדים, וההסמכות שהוא העניק יבוטלו. אפשר במקום זה להשבית אותו."
        confirmLabel="מחיקה"
        tone="danger"
        onConfirm={async () => {
          try {
            await del.mutateAsync(badge!.id);
            toast.success('התג נמחק');
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
