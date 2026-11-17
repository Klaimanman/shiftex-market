import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImageUp, Trash2 } from 'lucide-react';
import { PageHeader, Panel, Section } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Avatar, Segmented, Switch } from '@/components/ui/controls';
import { Field, Input } from '@/components/ui/field';
import { Notice } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { signOut, useMe } from '@/data/session';
import { useNotificationPrefs, useSaveNotificationPrefs } from '@/data/notifications';
import { useTheme, type ThemePref } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { errorMessage, unwrap } from '@/lib/errors';
import { clearAvatar, uploadAvatar } from '@/lib/avatar';
import { profileSchema } from '@/domain/validation';
import { formatILMobile } from '@/domain/phone';

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="הגדרות" back="/profile" />
      <ProfileForm />
      <AppearanceSection />
      <NotificationSection />
      <DangerZone />
    </div>
  );
}

function ProfileForm() {
  const me = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(me.full_name);
  const [phone, setPhone] = useState(formatILMobile(me.phone));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = profileSchema.safeParse({ fullName, phone });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      unwrap(await supabase.rpc('save_my_profile', { p_full_name: parsed.data.fullName, p_phone: parsed.data.phone }));
      await qc.invalidateQueries({ queryKey: ['ctx'] });
      toast.success('הפרטים נשמרו');
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setAvatarBusy(true);
    try {
      await uploadAvatar(me.user_id, file, me.avatar_url);
      await qc.invalidateQueries({ queryKey: ['ctx'] });
      toast.success('התמונה עודכנה');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Section title="פרטים אישיים">
      <Panel className="p-4 sm:p-5">
        <div className="mb-6 flex items-center gap-4">
          <Avatar name={me.full_name} src={me.avatar_url} size={56} />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" id="avatar-input" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="secondary" size="sm" loading={avatarBusy} icon={<ImageUp className="size-4" aria-hidden="true" />} onClick={() => fileRef.current?.click()}>
              החלפת תמונה
            </Button>
            {me.avatar_url && (
              <Button
                variant="ghost"
                size="sm"
                disabled={avatarBusy}
                onClick={async () => {
                  setAvatarBusy(true);
                  try {
                    await clearAvatar(me.user_id, me.avatar_url);
                    await qc.invalidateQueries({ queryKey: ['ctx'] });
                  } catch (err) {
                    toast.error(err);
                  } finally {
                    setAvatarBusy(false);
                  }
                }}
              >
                הסרה
              </Button>
            )}
          </div>
        </div>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <Field label="שם מלא" error={errors.fullName}>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" maxLength={80} />
          </Field>
          <Field label="טלפון נייד" error={errors.phone} hint="משמש לפניות בוואטסאפ.">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" dir="ltr" className="text-right" />
          </Field>
          <Button type="submit" loading={busy}>
            שמירה
          </Button>
        </form>
      </Panel>
    </Section>
  );
}

function AppearanceSection() {
  const { pref, setPref } = useTheme();
  return (
    <Section title="תצוגה">
      <Panel className="p-4 sm:p-5">
        <Segmented<ThemePref>
          label="ערכת צבעים"
          value={pref}
          onChange={setPref}
          options={[
            { value: 'light', label: 'בהיר' },
            { value: 'dark', label: 'כהה' },
            { value: 'system', label: 'לפי המכשיר' },
          ]}
        />
      </Panel>
    </Section>
  );
}

function NotificationSection() {
  const me = useMe();
  const toast = useToast();
  const prefs = useNotificationPrefs(me.user_id);
  const save = useSaveNotificationPrefs(me.user_id);
  const [ref, setRef] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (ref && window.location.hash === '#notifications') ref.scrollIntoView({ block: 'start' });
  }, [ref]);

  const p = prefs.data;
  const update = async (patch: Partial<NonNullable<typeof p>>) => {
    if (!p) return;
    try {
      await save.mutateAsync({ ...p, ...patch });
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <section id="notifications" ref={setRef} className="mt-8 scroll-mt-20">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">התראות</h2>
      <Panel className="divide-y divide-line px-4">
        <Switch disabled={!p || save.isPending} checked={p?.matches ?? true} onChange={(v) => update({ matches: v })} label="התאמות חדשות" description="כשעולה משמרת שמתאימה למודעה שלך, או כשמחפשים משמרת כמו שלך." />
        <Switch disabled={!p || save.isPending} checked={p?.interests ?? true} onChange={(v) => update({ interests: v })} label="פניות ועדכונים" description="מישהו הביע עניין במודעה שלך, או שמודעה שהתעניינת בה נסגרה." />
        <Switch disabled={!p || save.isPending} checked={p?.saved_searches ?? true} onChange={(v) => update({ saved_searches: v })} label="חיפושים שמורים" />
      </Panel>
      <p className="mt-2 text-xs text-muted">הודעות חשובות על החשבון נשלחות תמיד. התראות מופיעות בתוך האפליקציה.</p>
    </section>
  );
}

function DangerZone() {
  const me = useMe();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');

  return (
    <Section title="חשבון">
      <Panel className="space-y-4 p-4 sm:p-5">
        <div>
          <p className="font-medium">מחיקת החשבון</p>
          <p className="mt-1 text-sm text-muted">מוחק לצמיתות את הפרטים האישיים, המודעות, החיפושים וההתראות. אי אפשר לשחזר.</p>
        </div>
        <Button variant="danger" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setOpen(true)}>
          מחיקת החשבון
        </Button>
      </Panel>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          setConfirm('');
        }}
        title="למחוק את החשבון לצמיתות?"
        body="הפעולה סופית. כל המודעות הפעילות שלך יוסרו מהלוח."
        confirmLabel="מחיקה לצמיתות"
        tone="danger"
        onConfirm={async () => {
          if (confirm.trim() !== 'מחיקה') {
            toast.error('יש להקליד ״מחיקה״ לאישור');
            throw new Error('not confirmed');
          }
          try {
            unwrap(await supabase.rpc('delete_my_account'));
            await signOut();
          } catch (e) {
            toast.error(e);
            throw e;
          }
        }}
      >
        <div className="space-y-3">
          {me.isAdmin && <Notice tone="warn">אם זה החשבון היחיד עם הרשאות מנהל, צריך קודם למנות מנהל נוסף.</Notice>}
          <Field label="לאישור יש להקליד: מחיקה">
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </Field>
        </div>
      </ConfirmDialog>
    </Section>
  );
}
