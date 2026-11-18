import { Link } from 'react-router-dom';
import { ChevronLeft, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { PageHeader, Panel, Section } from '@/components/PageHeader';
import { ButtonLink, Button } from '@/components/ui/button';
import { Avatar, Ltr, Tag } from '@/components/ui/controls';
import { useMe, signOut } from '@/data/session';
import { useReference } from '@/data/reference';
import { formatILMobile } from '@/domain/phone';

export function ProfilePage() {
  const me = useMe();
  const { ref: r } = useReference();
  const qualified = r ? r.positions.filter((p) => p.is_active && me.qualified.has(p.id)) : [];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="פרופיל"
        actions={
          <ButtonLink to="/settings" variant="secondary" size="sm" icon={<Settings className="size-4" aria-hidden="true" />}>
            עריכה והגדרות
          </ButtonLink>
        }
      />

      <Panel className="flex items-center gap-4 p-5">
        <Avatar name={me.full_name} src={me.avatar_url} size={64} />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{me.full_name}</h2>
          <p className="text-sm text-muted">
            {me.membership?.org_name}
            {me.isAdmin && (
              <span className="ms-2 inline-flex items-center gap-1 text-accent">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                מנהל מערכת
              </span>
            )}
          </p>
        </div>
      </Panel>

      <Section title="פרטי קשר" className="mt-6">
        <Panel>
          <dl className="divide-y divide-line text-sm">
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-muted">טלפון נייד</dt>
              <dd>{me.phone ? <Ltr className="tabular font-mono">{formatILMobile(me.phone)}</Ltr> : '—'}</dd>
            </div>
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-muted">מייל</dt>
              <dd className="truncate"><Ltr>{me.email}</Ltr></dd>
            </div>
          </dl>
        </Panel>
        <p className="mt-2 text-xs text-muted">הטלפון לא מוצג ברשימות. עמית רואה אותו רק כשהוא פונה אליך בנוגע למודעה פעילה.</p>
      </Section>

      <Section title="תגים והסמכות">
        <Panel className="space-y-4 p-4">
          <div>
            <p className="mb-2 text-sm text-muted">תגים</p>
            <div className="flex flex-wrap gap-1.5">
              {me.badge_names.length ? me.badge_names.map((b) => <Tag key={b} tone="solid">{b}</Tag>) : <span className="text-sm text-muted">אין תגים</span>}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted">עמדות שאפשר לקחת</p>
            <div className="flex flex-wrap gap-1.5">
              {qualified.length ? qualified.map((p) => <Tag key={p.id} tone="outline">{p.name}</Tag>) : <span className="text-sm text-muted">אין</span>}
            </div>
          </div>
        </Panel>
        <p className="mt-2 text-xs text-muted">התגים מנוהלים על ידי ההנהלה. לעדכון יש לפנות למנהל המערכת.</p>
      </Section>

      <Section>
        <Panel className="divide-y divide-line">
          <Link to="/saved" className="flex items-center justify-between px-4 py-3.5 hover:bg-surface-2">
            חיפושים שמורים <ChevronLeft className="size-4 text-muted" aria-hidden="true" />
          </Link>
          <Link to="/privacy" className="flex items-center justify-between px-4 py-3.5 hover:bg-surface-2">
            פרטיות ושימוש במידע <ChevronLeft className="size-4 text-muted" aria-hidden="true" />
          </Link>
          <Link to="/accessibility" className="flex items-center justify-between px-4 py-3.5 hover:bg-surface-2">
            הצהרת נגישות <ChevronLeft className="size-4 text-muted" aria-hidden="true" />
          </Link>
          <Link to="/contact" className="flex items-center justify-between px-4 py-3.5 hover:bg-surface-2">
            יצירת קשר עם המפתחים <ChevronLeft className="size-4 text-muted" aria-hidden="true" />
          </Link>
        </Panel>
        <Button variant="secondary" className="mt-4 w-full sm:w-auto" icon={<LogOut className="size-4" aria-hidden="true" />} onClick={() => signOut()}>
          יציאה מהחשבון
        </Button>
      </Section>
    </div>
  );
}
