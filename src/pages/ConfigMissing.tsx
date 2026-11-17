import { PublicShell } from '@/components/AppShell';
import { Notice } from '@/components/ui/feedback';

export function ConfigMissingPage() {
  return (
    <PublicShell>
      <div className="mx-auto mt-16 max-w-lg space-y-4">
        <h1 className="text-xl font-semibold">האפליקציה עוד לא מחוברת לשרת</h1>
        <Notice tone="warn">
          חסרים משתני הסביבה <bdi dir="ltr" className="font-mono">VITE_SUPABASE_URL</bdi> ו־
          <bdi dir="ltr" className="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</bdi>. יש להגדיר אותם בהגדרות ה־Build ולפרסם מחדש.
        </Notice>
        <p className="text-sm text-muted">ההוראות המלאות נמצאות בקובץ docs/DEPLOYMENT.he.md במאגר.</p>
      </div>
    </PublicShell>
  );
}
