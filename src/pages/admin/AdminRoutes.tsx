import { NavLink, Route, Routes } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { AdminDashboard } from './AdminDashboard';
import { AdminMembers } from './AdminMembers';
import { AdminBadges } from './AdminBadges';
import { AdminPositions } from './AdminPositions';
import { AdminShifts } from './AdminShifts';
import { AdminSettings } from './AdminSettings';
import { AdminInvites } from './AdminInvites';
import { AdminListings } from './AdminListings';
import { AdminAudit } from './AdminAudit';
import { NotFoundPage } from '../NotFound';

const TABS = [
  { to: '/admin', label: 'סקירה', end: true },
  { to: '/admin/members', label: 'עובדים' },
  { to: '/admin/badges', label: 'תגים והסמכות' },
  { to: '/admin/positions', label: 'עמדות' },
  { to: '/admin/shifts', label: 'משמרות' },
  { to: '/admin/invites', label: 'קודי הזמנה' },
  { to: '/admin/listings', label: 'מודעות' },
  { to: '/admin/settings', label: 'הגדרות ארגון' },
  { to: '/admin/audit', label: 'יומן פעולות' },
];

export default function AdminRoutes() {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-accent">ניהול</div>
      <nav aria-label="ניווט ניהול" className="scrollbar-none -mx-4 mb-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink',
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="members" element={<AdminMembers />} />
        <Route path="badges" element={<AdminBadges />} />
        <Route path="positions" element={<AdminPositions />} />
        <Route path="shifts" element={<AdminShifts />} />
        <Route path="invites" element={<AdminInvites />} />
        <Route path="listings" element={<AdminListings />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="audit" element={<AdminAudit />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}
