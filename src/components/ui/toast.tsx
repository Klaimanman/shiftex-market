import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/errors';

interface ToastItem { id: number; tone: 'success' | 'error' | 'info'; message: string }
interface ToastApi {
  success: (m: string) => void;
  error: (e: unknown) => void;
  info: (m: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const remove = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (tone: ToastItem['tone'], message: string) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-2), { id, tone, message }]);
      window.setTimeout(() => remove(id), tone === 'error' ? 6000 : 3500);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      info: (m) => push('info', m),
      error: (e) => push('error', typeof e === 'string' ? e : errorMessage(e)),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border bg-surface px-4 py-3 text-sm shadow-pop animate-sheet-up',
              t.tone === 'error' ? 'border-danger/30' : 'border-line',
            )}
          >
            {t.tone === 'error' ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            )}
            <p className="min-w-0 flex-1 text-ink">{t.message}</p>
            <button type="button" onClick={() => remove(t.id)} className="-m-1 rounded p-1 text-muted hover:text-ink" aria-label="סגירת הודעה">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast outside ToastProvider');
  return v;
}
