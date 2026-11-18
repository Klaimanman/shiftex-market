import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Bell, Bookmark, CalendarRange, Home, LayoutList, Moon, Plus, Search, Send, Settings, ShieldCheck, Sun,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTheme } from '@/lib/theme';
import { useMe } from '@/data/session';
import { useUnreadCount } from '@/data/notifications';
import { useRealtimeSync } from '@/data/realtime';
import { Logo } from './Logo';
import { Avatar } from './ui/controls';

const NAV = [
  { to: '/', label: 'בית', icon: Home, end: true },
  { to: '/market', label: 'לוח שבועי', icon: CalendarRange },
  { to: '/offers', label: 'מסירות משמרת', icon: Send },
  { to: '/seeks', label: 'חיפושי משמרת', icon: Search },
  { to: '/mine', label: 'המודעות שלי', icon: LayoutList },
  { to: '/saved', label: 'חיפושים שמורים', icon: Bookmark },
  { to: '/notifications', label: 'התראות', icon: Bell },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const dark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn('grid size-10 place-items-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink', className)}
      aria-label={dark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'}
      title={dark ? 'מצב בהיר' : 'מצב כהה'}
    >
      {dark ? <Sun className="size-[18px]" aria-hidden="true" /> : <Moon className="size-[18px]" aria-hidden="true" />}
    </button>
  );
}

function UnreadDot({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="tabular absolute -top-1 -end-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-2xs font-semibold leading-none text-white">
      {count > 9 ? '9+' : count}
      <span className="sr-only"> התראות שלא נקראו</span>
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const unread = useUnreadCount(me.user_id).data ?? 0;
  const { pathname } = useLocation();
  useRealtimeSync(me.orgId, me.user_id);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        דילוג לתוכן
      </a>

      {/* Desktop side rail */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-e border-line bg-surface-2 px-3 py-5 lg:flex">
        <Link to="/" className="mb-6 px-2">
          <Logo />
        </Link>
        <Link
          to="/new"
          className="mb-5 flex h-11 items-center justify-center gap-2 rounded-md bg-accent text-base font-medium text-accent-ink hover:bg-accent-hover"
        >
          <Plus className="size-4" aria-hidden="true" />
          פרסום מודעה
        </Link>
        <nav aria-label="ניווט ראשי" className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'relative flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors',
                  isActive ? 'bg-surface text-ink ring-1 ring-line' : 'text-ink-2 hover:bg-sunken hover:text-ink',
                )
              }
            >
              <span className="relative">
                <Icon className="size-[18px]" aria-hidden="true" />
                {to === '/notifications' && <UnreadDot count={unread} />}
              </span>
              {label}
            </NavLink>
          ))}
          {me.isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  'mt-3 flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium',
                  isActive || pathname.startsWith('/admin') ? 'bg-surface text-ink ring-1 ring-line' : 'text-ink-2 hover:bg-sunken hover:text-ink',
                )
              }
            >
              <ShieldCheck className="size-[18px]" aria-hidden="true" />
              ניהול
            </NavLink>
          )}
        </nav>
        <div className="mt-auto flex items-center gap-1 border-t border-line pt-4">
          <Link to="/profile" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1.5 hover:bg-sunken">
            <Avatar name={me.full_name} src={me.avatar_url} size={32} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{me.full_name}</span>
              <span className="block truncate text-xs text-muted">{me.membership?.org_name}</span>
            </span>
          </Link>
          <Link to="/settings" className="grid size-10 place-items-center rounded-md text-ink-2 hover:bg-sunken" aria-label="הגדרות">
            <Settings className="size-[18px]" aria-hidden="true" />
          </Link>
          <ThemeToggle />
        </div>
      </aside>

      <div className="min-w-0">
        {/* Mobile top bar */}
        <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link to="/" aria-label="ShiftEX Market — בית">
              <Logo withMarket={false} />
            </Link>
            <div className="flex items-center gap-0.5">
              {me.isAdmin && (
                <Link to="/admin" className="grid size-10 place-items-center rounded-md text-ink-2 hover:bg-sunken" aria-label="ניהול">
                  <ShieldCheck className="size-[18px]" aria-hidden="true" />
                </Link>
              )}
              <ThemeToggle />
              <Link to="/profile" className="ms-1 grid size-10 place-items-center rounded-full" aria-label="פרופיל">
                <Avatar name={me.full_name} src={me.avatar_url} size={30} />
              </Link>
            </div>
          </div>
        </header>

        <main id="main" className="pb-nav mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <nav aria-label="ניווט ראשי" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden">
          <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-stretch">
            <BottomItem to="/" end icon={Home} label="בית" />
            <BottomItem to="/market" icon={CalendarRange} label="לוח" />
            <div className="grid place-items-center">
              <Link
                to="/new"
                className="grid size-12 place-items-center rounded-full bg-accent text-accent-ink shadow-pop transition-transform active:scale-95"
                aria-label="פרסום מודעה"
              >
                <Plus className="size-6" aria-hidden="true" />
              </Link>
            </div>
            <BottomItem to="/mine" icon={LayoutList} label="שלי" />
            <BottomItem to="/notifications" icon={Bell} label="התראות" badge={unread} />
          </div>
        </nav>
      </div>
    </div>
  );
}

function BottomItem({ to, icon: Icon, label, end, badge }: { to: string; icon: typeof Home; label: string; end?: boolean; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn('flex flex-col items-center justify-center gap-1 text-2xs font-medium', isActive ? 'text-accent' : 'text-muted hover:text-ink')
      }
    >
      <span className="relative">
        <Icon className="size-[22px]" aria-hidden="true" />
        {badge ? <UnreadDot count={badge} /> : null}
      </span>
      {label}
    </NavLink>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="pt-safe">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <ThemeToggle />
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}
