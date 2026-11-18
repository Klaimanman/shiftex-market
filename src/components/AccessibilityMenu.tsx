import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Accessibility } from 'lucide-react';
import { Sheet } from './ui/sheet';
import { Button } from './ui/button';
import { Segmented, Switch } from './ui/controls';
import { useTheme, type ThemePref } from '@/lib/theme';
import { cn } from '@/lib/cn';

interface A11yPrefs { scale: 100 | 112.5 | 125; contrast: boolean; links: boolean; motion: boolean }
const KEY = 'shiftex-a11y';
const DEFAULTS: A11yPrefs = { scale: 100, contrast: false, links: false, motion: false };

function read(): A11yPrefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

function apply(p: A11yPrefs) {
  const root = document.documentElement;
  root.style.fontSize = p.scale === 100 ? '' : `${p.scale}%`;
  p.contrast ? root.setAttribute('data-contrast', 'high') : root.removeAttribute('data-contrast');
  p.links ? root.setAttribute('data-links', 'underline') : root.removeAttribute('data-links');
  p.motion ? root.setAttribute('data-motion', 'reduce') : root.removeAttribute('data-motion');
}

/**
 * Floating accessibility button + menu: text size, high contrast, underlined links,
 * stop animations, light/dark. Preferences are kept on this device and applied before
 * first paint (public/theme-init.js).
 */
export function AccessibilityMenu({ withBottomNav }: { withBottomNav: boolean }) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<A11yPrefs>(read);
  const { pref: theme, setPref: setTheme } = useTheme();

  useEffect(() => {
    apply(prefs);
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* not persisted */
    }
  }, [prefs]);

  const set = <K extends keyof A11yPrefs>(k: K, v: A11yPrefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));
  const active = prefs.scale !== 100 || prefs.contrast || prefs.links || prefs.motion;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="תפריט נגישות"
        aria-haspopup="dialog"
        title="נגישות"
        className={cn(
          'fixed left-3 z-40 grid size-11 place-items-center rounded-full border shadow-pop transition-transform active:scale-95',
          'border-accent bg-accent text-accent-ink hover:bg-accent-hover',
          withBottomNav ? 'bottom-[calc(80px+env(safe-area-inset-bottom))] lg:bottom-5' : 'bottom-5',
        )}
      >
        <Accessibility className="size-6" aria-hidden="true" />
        {active && <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-bg bg-warn" aria-hidden="true" />}
      </button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="נגישות"
        description="ההגדרות נשמרות במכשיר הזה."
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="secondary" onClick={() => setPrefs(DEFAULTS)}>
              איפוס
            </Button>
            <Link to="/accessibility" onClick={() => setOpen(false)} className="text-sm font-medium text-accent underline underline-offset-2">
              הצהרת נגישות
            </Link>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium">גודל טקסט</p>
            <Segmented
              label="גודל טקסט"
              value={String(prefs.scale)}
              onChange={(v) => set('scale', Number(v) as A11yPrefs['scale'])}
              options={[
                { value: '100', label: 'רגיל' },
                { value: '112.5', label: 'גדול' },
                { value: '125', label: 'גדול מאוד' },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">תצוגה</p>
            <Segmented<ThemePref>
              label="ערכת צבעים"
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'dark', label: 'כהה' },
                { value: 'light', label: 'בהיר' },
                { value: 'system', label: 'לפי המכשיר' },
              ]}
            />
          </div>
          <div className="divide-y divide-line rounded-md border border-line px-3">
            <Switch checked={prefs.contrast} onChange={(v) => set('contrast', v)} label="ניגודיות גבוהה" description="טקסט וקווי מסגרת בולטים יותר." />
            <Switch checked={prefs.links} onChange={(v) => set('links', v)} label="הדגשת קישורים" description="קו תחתון לכל הקישורים." />
            <Switch checked={prefs.motion} onChange={(v) => set('motion', v)} label="עצירת אנימציות" />
          </div>
        </div>
      </Sheet>
    </>
  );
}
