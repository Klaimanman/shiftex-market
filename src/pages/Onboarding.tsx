import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, LogOut } from 'lucide-react';
import { PublicShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Notice } from '@/components/ui/feedback';
import { Ltr } from '@/components/ui/controls';
import { supabase } from '@/lib/supabase';
import { errorMessage, unwrap } from '@/lib/errors';
import { profileSchema } from '@/domain/validation';
import { signOut } from '@/data/session';
import type { MyContext } from '@/domain/types';
import { cn } from '@/lib/cn';

const STEPS = ['פרטים אישיים', 'קוד הזמנה', 'תגים'];

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="שלבי ההרשמה">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === step ? 'step' : undefined}>
          <div className={cn('h-1 rounded-full', i <= step ? 'bg-accent' : 'bg-line')} />
          <span className={cn('mt-2 flex items-center gap-1 text-xs', i === step ? 'font-medium text-ink' : 'text-muted')}>
            {i < step && <Check className="size-3 text-accent" aria-hidden="true" />}
            {s}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function OnboardingPage({ me }: { me: MyContext }) {
  const step = !me.onboarded ? 0 : 1;
  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-md py-6 sm:py-12">
        {step === 0 ? <ProfileStep me={me} /> : <JoinFlow />}
        <button type="button" onClick={() => signOut()} className="mx-auto mt-10 flex items-center gap-2 text-sm text-muted hover:text-ink">
          <LogOut className="size-4" aria-hidden="true" />
          יציאה מהחשבון
        </button>
      </div>
    </PublicShell>
  );
}

function ProfileStep({ me }: { me: MyContext }) {
  const qc = useQueryClient();
  const [fullName, setFullName] = useState(/[א-ת]/.test(me.full_name) ? me.full_name : '');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
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
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stepper step={0} />
      <h1 className="text-xl font-semibold">נעים להכיר</h1>
      <p className="mt-1 text-sm text-muted">הפרטים משמשים את העמיתים כדי לפנות אליך בוואטסאפ בנוגע למשמרות.</p>
      <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
        <Field label="שם תצוגה בעברית" hint="השם שיופיע לעמיתים ובמיילים לאחראי הסידור. לדוגמה: ישראל ישראלי" error={errors.fullName}>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" maxLength={80} />
        </Field>
        <Field label="טלפון נייד" hint="מספר ישראלי, לשימוש בוואטסאפ. לא מוצג ברשימות." error={errors.phone}>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder="050-1234567"
            className="text-right"
          />
        </Field>
        <Field label="מייל" hint="מחשבון Google שאיתו נכנסת.">
          <Input value={me.email} readOnly disabled dir="ltr" className="text-right" />
        </Field>
        {serverError && <Notice tone="danger">{serverError}</Notice>}
        <Button type="submit" className="w-full" loading={busy}>
          המשך
        </Button>
      </form>
    </>
  );
}

interface InvitePreview { ok: boolean; error?: string; org_name?: string; badges?: { id: string; name: string; description: string | null }[] }

/** Invite code -> badge selection -> join (pending approval). Also used to re-apply after a rejection. */
export function JoinFlow({ reapply = false }: { reapply?: boolean }) {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (code.replace(/[^A-Za-z0-9]/g, '').length < 6) {
      setError('יש להזין את הקוד המלא');
      return;
    }
    setBusy(true);
    try {
      const res = unwrap(await supabase.rpc('validate_invite', { p_code: code })) as InvitePreview;
      if (!res.ok) setError(errorMessage({ message: res.error }));
      else setPreview(res);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = unwrap(await supabase.rpc('join_organization', { p_code: code, p_badge_ids: selected })) as InvitePreview;
      if (!res.ok) {
        setError(errorMessage({ message: res.error }));
        setPreview(null);
      } else {
        await qc.invalidateQueries({ queryKey: ['ctx'] });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!preview) {
    return (
      <>
        {!reapply && <Stepper step={1} />}
        <h1 className="text-xl font-semibold">{reapply ? 'הגשת בקשה חדשה' : 'קוד הזמנה'}</h1>
        <p className="mt-1 text-sm text-muted">הקוד מתקבל מההנהלה. הוא מצרף אותך לארגון, הגישה נפתחת אחרי אישור.</p>
        <form onSubmit={check} className="mt-6 space-y-5" noValidate>
          <Field label="קוד" error={error}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              dir="ltr"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXXX-XXXXX"
              className="text-center font-mono tracking-[0.2em]"
              maxLength={16}
            />
          </Field>
          <Button type="submit" className="w-full" loading={busy}>
            בדיקת הקוד
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      {!reapply && <Stepper step={2} />}
      <h1 className="text-xl font-semibold">התגים שלך</h1>
      <p className="mt-1 text-sm text-muted">
        הצטרפות אל <span className="font-medium text-ink">{preview.org_name}</span>. יש לבחור את התגים וההסמכות שלך, ההנהלה תאשר אותם יחד עם החשבון.
      </p>
      <div className="mt-6 space-y-2" role="group" aria-label="תגים">
        {(preview.badges ?? []).length === 0 && <Notice>עדיין לא הוגדרו תגים בארגון. אפשר להמשיך, ההנהלה תוסיף אותם בהמשך.</Notice>}
        {(preview.badges ?? []).map((b) => {
          const on = selected.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              aria-pressed={on}
              onClick={() => setSelected((s) => (on ? s.filter((x) => x !== b.id) : [...s, b.id].slice(0, 5)))}
              className={cn(
                'flex w-full items-start gap-3 rounded-lg border p-4 text-start transition-colors',
                on ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-sm border', on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong')}>
                {on && <Check className="size-3.5" aria-hidden="true" />}
              </span>
              <span>
                <span className="block font-medium text-ink">{b.name}</span>
                {b.description && <span className="mt-0.5 block text-sm text-muted">{b.description}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {error && <Notice tone="danger" className="mt-4">{error}</Notice>}
      <div className="mt-6 flex gap-2">
        <Button className="flex-1" onClick={join} loading={busy}>
          שליחת בקשה להצטרפות
        </Button>
        <Button variant="secondary" onClick={() => setPreview(null)} disabled={busy}>
          חזרה
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted">
        קוד: <Ltr className="font-mono">{code}</Ltr>
      </p>
    </>
  );
}
