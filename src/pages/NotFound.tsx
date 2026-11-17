import { ButtonLink } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-mono text-sm tracking-[0.2em] text-muted" dir="ltr">
        404
      </p>
      <h1 className="mt-3 text-xl font-semibold">העמוד לא נמצא</h1>
      <p className="mt-2 text-sm text-muted">ייתכן שהקישור שגוי או שהעמוד הוסר.</p>
      <ButtonLink to="/" className="mt-6">
        חזרה לדף הבית
      </ButtonLink>
    </div>
  );
}
