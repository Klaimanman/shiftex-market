import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { isConfigured } from './lib/supabase';
import { MeProvider, useMyContext, useSession } from './data/session';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorState, FullPageSpinner } from './components/ui/feedback';
import { PublicShell } from './components/AppShell';
import { WelcomePage } from './pages/Welcome';
import { AuthCallbackPage } from './pages/AuthCallback';
import { PrivacyPage } from './pages/Privacy';
import { ContactPage } from './pages/Contact';
import { AccessibilityPage } from './pages/Accessibility';
import { ConfigMissingPage } from './pages/ConfigMissing';
import { OnboardingPage } from './pages/Onboarding';
import { PendingPage } from './pages/Pending';
import { RestrictedPage } from './pages/Restricted';
import { NotFoundPage } from './pages/NotFound';
import { HomePage } from './pages/Home';
import { MarketplacePage } from './pages/Marketplace';
import { ListingDetailsPage } from './pages/ListingDetails';
import { ListingEditorPage } from './pages/ListingEditor';
import { MyListingsPage } from './pages/MyListings';
import { ListingSectionPage } from './pages/ListingSection';
import { SavedSearchesPage } from './pages/SavedSearches';
import { NotificationsPage } from './pages/Notifications';
import { ProfilePage } from './pages/Profile';
import { SettingsPage } from './pages/Settings';

// The admin area is a separate chunk — employees never download it.
const AdminRoutes = lazy(() => import('./pages/admin/AdminRoutes'));

export function App() {
  const { pathname } = useLocation();
  if (!isConfigured) return <ConfigMissingPage />;
  if (pathname === '/auth/callback') return <AuthCallbackPage />;
  if (pathname === '/privacy') return <PrivacyPage />;
  if (pathname === '/contact') return <ContactPage />;
  if (pathname === '/accessibility') return <AccessibilityPage />;
  return (
    <ErrorBoundary>
      <Gate />
    </ErrorBoundary>
  );
}

/** Decides what the user may see based on session + membership state (re-checked server-side on every query). */
function Gate() {
  const { session, loading } = useSession();
  const ctx = useMyContext(!!session);

  if (loading) return <FullPageSpinner />;
  if (!session) return <WelcomePage />;
  if (ctx.isLoading) return <FullPageSpinner label="טוען את החשבון…" />;
  if (ctx.error || !ctx.data) {
    return (
      <PublicShell>
        <ErrorState error={ctx.error} onRetry={() => ctx.refetch()} title="לא הצלחנו לטעון את החשבון" />
      </PublicShell>
    );
  }

  const me = ctx.data;
  const m = me.membership;
  if (!me.onboarded || !m) return <OnboardingPage me={me} />;
  if (m.status === 'pending') return <PendingPage me={me} />;
  if (m.status !== 'active') return <RestrictedPage me={me} />;

  return (
    <MeProvider value={me}>
      <AppShell>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/market" element={<MarketplacePage />} />
            <Route path="/new" element={<ListingEditorPage />} />
            <Route path="/listing/:id" element={<ListingDetailsPage />} />
            <Route path="/listing/:id/edit" element={<ListingEditorPage />} />
            <Route path="/mine" element={<MyListingsPage />} />
            <Route path="/offers" element={<ListingSectionPage kind="offers" key="offers" />} />
            <Route path="/seeks" element={<ListingSectionPage kind="seeks" key="seeks" />} />
            <Route path="/matches" element={<Navigate to="/offers" replace />} />
            <Route path="/saved" element={<SavedSearchesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route
              path="/admin/*"
              element={
                me.membership?.role === 'admin' ? (
                  <Suspense fallback={<FullPageSpinner />}>
                    <AdminRoutes />
                  </Suspense>
                ) : (
                  <NotFoundPage />
                )
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </AppShell>
    </MeProvider>
  );
}
