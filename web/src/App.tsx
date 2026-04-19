import { Suspense, lazy, useState, useCallback, useEffect, useMemo, useRef, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useAuth, isContractorUser } from './hooks/useAuth';
import type { WorkItem } from './lib/types';
import { useWorkItems, useClients, useSettings, useApps, useTimeEntries } from './hooks/useFirestore';
import { updateSettings, callGenerateInsights } from './services/firestore';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { TimeTrackerProvider, TimeTrackerNavButton, TimeTrackerBar } from './components/TimeTracker';
import { ToastContainer } from './components/ToastContainer';
import { ToastContext, useToastState } from './hooks/useToast';
import { useTheme } from './hooks/useTheme';
import { GlobalSearch } from './components/GlobalSearch';
import { computeNotifications, NotificationPanel, MobileNotificationBell } from './components/NotificationCenter';
import { IconSearch, IconSettings, IconUser } from './components/icons';
import { BrandWordmark } from './components/Brand';
import { auth } from './lib/firebase';
import Login from './routes/Login';

/* ── Mobile page name mapping ─────────────────────────── */

const pageNames: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/work-items': 'Work Orders',
  '/dashboard/calendar': 'Calendar',
  '/dashboard/clients': 'Clients',
  '/dashboard/apps': 'Apps',
  '/dashboard/invoices': 'Invoices',
  '/dashboard/finance': 'Finance',
  '/dashboard/finance/invoices': 'Invoices',
  '/dashboard/finance/transactions': 'Transactions',
  '/dashboard/finance/expenses': 'Expenses',
  '/dashboard/finance/receipts': 'Receipts',
  '/dashboard/finance/reports': 'Reports',
  '/dashboard/finance/accounts': 'Accounts',
  '/dashboard/finance/mileage': 'Mileage',
  '/dashboard/team': 'Team',
  '/dashboard/vault': 'Vault',
  '/dashboard/settings': 'Settings',
  '/dashboard/profile': 'Profile',
};

function getPageName(pathname: string): string {
  // Exact match first
  if (pageNames[pathname]) return pageNames[pathname];
  // Try matching detail pages (e.g. /dashboard/clients/123 -> "Clients")
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 2) {
    const parentPath = '/' + segments.slice(0, 2).join('/');
    if (pageNames[parentPath]) return pageNames[parentPath];
  }
  if (segments.length >= 3) {
    const parentPath = '/' + segments.slice(0, 3).join('/');
    if (pageNames[parentPath]) return pageNames[parentPath];
  }
  return 'Ten99';
}

// Lazy-loaded contractor routes
const Dashboard = lazy(() => import('./routes/contractor/Dashboard'));
const WorkItems = lazy(() => import('./routes/contractor/WorkItems'));
const WorkItemDetail = lazy(() => import('./routes/contractor/WorkItemDetail'));
const Calendar = lazy(() => import('./routes/contractor/Calendar'));
const Clients = lazy(() => import('./routes/contractor/Clients'));
const ClientDetail = lazy(() => import('./routes/contractor/ClientDetail'));
const FinanceOverview = lazy(() => import('./routes/contractor/FinanceOverview'));
const Invoices = lazy(() => import('./routes/contractor/Invoices'));
const Transactions = lazy(() => import('./routes/contractor/Transactions'));
const TransactionDetail = lazy(() => import('./routes/contractor/TransactionDetail'));
const Expenses = lazy(() => import('./routes/contractor/Expenses'));
const Receipts = lazy(() => import('./routes/contractor/Receipts'));
const Reports = lazy(() => import('./routes/contractor/Reports'));
const Accounts = lazy(() => import('./routes/contractor/Accounts'));
const Mileage = lazy(() => import('./routes/contractor/Mileage'));
const Team = lazy(() => import('./routes/contractor/Team'));
const Settings = lazy(() => import('./routes/contractor/Settings'));
const Profile = lazy(() => import('./routes/contractor/Profile'));
const Vault = lazy(() => import('./routes/contractor/Vault'));
const AppsList = lazy(() => import('./routes/contractor/AppsList'));
const AppDetail = lazy(() => import('./routes/contractor/AppDetail'));
const EmailComposer = lazy(() => import('./routes/contractor/EmailComposer'));
const GitHubCallback = lazy(() => import('./routes/contractor/GitHubCallback'));

// Lazy-loaded portal routes
const PortalAuth = lazy(() => import('./routes/portal/PortalAuth'));
const PortalHome = lazy(() => import('./routes/portal/PortalHome'));
const PortalDetail = lazy(() => import('./routes/portal/PortalDetail'));

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; errorInfo: ErrorInfo | null }
> {
  state: { error: Error | null; errorInfo: ErrorInfo | null } = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error.message, errorInfo.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', maxWidth: 700, margin: '0 auto' }}>
          <h1 style={{ color: '#EF4444', fontSize: 18 }}>Something went wrong</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, marginTop: 12, color: '#888' }}>
            {this.state.error.message}
          </pre>
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: '#888' }}>Component stack</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, marginTop: 8, color: '#666' }}>
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: '1px solid #444', cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Loading() {
  return (
    <div className="flex items-center justify-center h-full py-20">
      <div className="text-sm text-[var(--text-secondary)]">Loading...</div>
    </div>
  );
}

function ContractorLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const stored = localStorage.getItem('oc-sidebar-expanded');
    return stored === 'true';
  });
  const { dark, toggle } = useTheme();
  const { user } = useAuth();
  const { workItems } = useWorkItems();
  const { clients } = useClients();
  const { apps } = useApps();
  const { settings } = useSettings(user?.uid);
  const toastState = useToastState();
  const location = useLocation();
  const pendingCount = workItems.filter(
    (i) => i.status === 'draft' || i.status === 'inReview'
  ).length;

  // Notification center state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifDismissed, setNotifDismissed] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('oc-notif-dismissed');
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch { return new Set(); }
  });
  const [isMobileView, setIsMobileView] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const notifBellRef = useRef<HTMLButtonElement>(null);
  const mobileBellRef = useRef<HTMLButtonElement>(null);

  const allNotifications = useMemo(
    () => computeNotifications(workItems, clients),
    [workItems, clients]
  );
  const notifications = useMemo(
    () => allNotifications.filter((n) => !notifDismissed.has(n.id)),
    [allNotifications, notifDismissed]
  );
  const notifCount = notifications.length;

  // Apply accent color from settings to CSS variable
  useEffect(() => {
    if (settings.accentColor) {
      document.documentElement.style.setProperty('--accent', settings.accentColor);
    }
  }, [settings.accentColor]);

  // Track viewport for mobile detection
  useEffect(() => {
    function check() { setIsMobileView(window.innerWidth < 768); }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Click outside to close notification panel (desktop)
  useEffect(() => {
    if (!notifOpen || isMobileView) return;
    function handleClick(e: MouseEvent) {
      if (
        notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node) &&
        notifBellRef.current && !notifBellRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClick); };
  }, [notifOpen, isMobileView]);

  // Escape to close notification panel
  useEffect(() => {
    if (!notifOpen) return;
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') setNotifOpen(false); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [notifOpen]);

  const handleNotifDismiss = useCallback((id: string) => {
    setNotifDismissed((prev) => {
      const next = new Set(prev).add(id);
      localStorage.setItem('oc-notif-dismissed', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handleNotifDismissAll = useCallback(() => {
    const next = new Set(allNotifications.map((n) => n.id));
    localStorage.setItem('oc-notif-dismissed', JSON.stringify([...next]));
    setNotifDismissed(next);
  }, [allNotifications]);

  const handleNotifToggle = useCallback(() => {
    setNotifOpen((v) => !v);
  }, []);

  const handleUpdateSidebar = useCallback(
    (order: string[], hidden: string[]) => {
      if (!user?.uid) return;
      updateSettings(user.uid, { sidebarOrder: order, sidebarHidden: hidden });
    },
    [user?.uid]
  );

  function handleToggleExpanded() {
    setSidebarExpanded(prev => {
      const next = !prev;
      localStorage.setItem('oc-sidebar-expanded', String(next));
      return next;
    });
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ToastContext.Provider value={toastState}>
      <TimeTrackerProvider clients={clients} apps={apps}>
        <div className="flex h-screen bg-[var(--bg-page)] overflow-hidden">
          <Sidebar
            pendingCount={pendingCount}
            sidebarOrder={settings.sidebarOrder}
            sidebarHidden={settings.sidebarHidden}
            onUpdateSidebar={handleUpdateSidebar}
            dark={dark}
            onToggleTheme={toggle}
            expanded={sidebarExpanded}
            onToggleExpanded={handleToggleExpanded}
            notificationCount={notifCount}
            notificationBellRef={notifBellRef}
            onNotificationsClick={handleNotifToggle}
          />
          <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile header — fixed at top so it stays anchored while main scrolls */}
            <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[var(--bg-page)]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
              <div className="flex items-center justify-between h-12 px-4">
                <div className="flex items-center gap-0.5 min-w-[88px]">
                  <Link
                    to="/dashboard/settings"
                    className="p-2 -ml-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
                  >
                    <IconSettings size={24} />
                  </Link>
                  <button
                    onClick={() => setSearchOpen(true)}
                    className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
                  >
                    <IconSearch size={24} />
                  </button>
                </div>
                <h1 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  {getPageName(location.pathname)}
                </h1>
                <div className="flex items-center gap-0.5 min-w-[88px] justify-end">
                  <TimeTrackerNavButton />
                  <MobileNotificationBell
                    count={notifCount}
                    onClick={handleNotifToggle}
                    buttonRef={mobileBellRef}
                  />
                  <Link
                    to="/dashboard/profile"
                    className="p-2 -mr-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-input)] transition-colors"
                  >
                    <IconUser size={24} />
                  </Link>
                </div>
              </div>
            </header>
            {/* Spacer to push content below the fixed mobile header */}
            <div className="md:hidden flex-shrink-0 h-12" style={{ height: 'calc(3rem + env(safe-area-inset-top))' }} />

            <TimeTrackerBar />

            {/* Main content */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
              <Suspense fallback={<Loading />}>
                <Outlet />
              </Suspense>
            </main>
          </div>

          {/* Mobile bottom tab bar */}
          <MobileBottomNav dark={dark} onToggleTheme={toggle} />

          {notifOpen && (
            <NotificationPanel
              notifications={notifications}
              onDismiss={handleNotifDismiss}
              onDismissAll={handleNotifDismissAll}
              onClose={() => setNotifOpen(false)}
              isMobile={isMobileView}
              panelRef={notifPanelRef}
              sidebarExpanded={sidebarExpanded}
            />
          )}
          <ToastContainer />
          {searchOpen && (
            <GlobalSearch
              workItems={workItems}
              clients={clients}
              onClose={() => setSearchOpen(false)}
            />
          )}
        </div>
      </TimeTrackerProvider>
    </ToastContext.Provider>
  );
}

function ContractorRoutes() {
  const { user, logout } = useAuth();
  const { workItems } = useWorkItems();
  const { clients } = useClients();
  const { settings } = useSettings(user?.uid);
  const { apps } = useApps();
  const { entries: timeEntries } = useTimeEntries();
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        index
        element={<Dashboard workItems={workItems} clients={clients} apps={apps} />}
      />
      <Route
        path="work-items"
        element={<WorkItems workItems={workItems} clients={clients} apps={apps} settings={settings} />}
      />
      <Route
        path="work-items/:id"
        element={
          <WorkItemDetail
            workItems={workItems}
            clients={clients}
            apps={apps}
            hourlyRate={settings.hourlyRate}
            paymentTerms={settings.invoicePaymentTerms}
            taxRate={settings.invoiceTaxRate}
            pdfLogoUrl={settings.pdfLogoUrl}
            invoiceFromAddress={settings.invoiceFromAddress}
            invoiceTerms={settings.invoiceTerms}
            invoiceNotes={settings.invoiceNotes}
            timeEntries={timeEntries}
            roundTimeToQuarterHour={settings.roundTimeToQuarterHour}
          />
        }
      />
      <Route
        path="work-items/:id/email/:type"
        element={<EmailComposer workItems={workItems} clients={clients} />}
      />
      <Route
        path="calendar"
        element={<Calendar workItems={workItems} clients={clients} apps={apps} />}
      />
      <Route
        path="clients"
        element={<Clients workItems={workItems} clients={clients} />}
      />
      <Route
        path="clients/:id"
        element={<ClientDetail workItems={workItems} clients={clients} apps={apps} />}
      />
      <Route
        path="apps"
        element={<AppsList apps={apps} workItems={workItems} clients={clients} />}
      />
      <Route
        path="apps/:id"
        element={<AppDetail apps={apps} workItems={workItems} clients={clients} hourlyRate={settings.hourlyRate} />}
      />
      <Route
        path="analytics"
        element={<Navigate to="/dashboard/finance" replace />}
      />
      <Route
        path="finance"
        element={<FinanceOverview workItems={workItems} clients={clients} />}
      />
      <Route
        path="invoices"
        element={<Invoices workItems={workItems} clients={clients} settings={settings} hourlyRate={settings.hourlyRate} taxRate={settings.invoiceTaxRate} />}
      />
      <Route
        path="finance/invoices"
        element={<Invoices workItems={workItems} clients={clients} settings={settings} hourlyRate={settings.hourlyRate} taxRate={settings.invoiceTaxRate} />}
      />
      <Route path="finance/transactions" element={<Transactions />} />
      <Route path="finance/transactions/:id" element={<TransactionDetail />} />
      <Route path="finance/expenses" element={<Expenses />} />
      <Route path="finance/receipts" element={<Receipts />} />
      <Route
        path="finance/reports"
        element={<Reports workItems={workItems} clients={clients} />}
      />
      <Route path="finance/accounts" element={<Accounts />} />
      <Route path="finance/mileage" element={<Mileage clients={clients} />} />
      <Route
        path="team"
        element={user ? <Team user={user} settings={settings} /> : null}
      />
      <Route
        path="settings"
        element={user ? <Settings settings={settings} userId={user.uid} /> : null}
      />
      <Route
        path="profile"
        element={user ? <Profile user={user} onLogout={async () => { await logout(); navigate('/'); }} /> : null}
      />
      <Route
        path="vault"
        element={user ? <Vault user={user} clients={clients} /> : null}
      />
      <Route path="github/callback" element={<GitHubCallback />} />
    </Routes>
  );
}

const PORTAL_SESSION_MAX_DAYS = 7;

function PortalRoutes() {
  const { user, claims } = useAuth();

  // Sign out portal clients whose session is older than 7 days
  useEffect(() => {
    if (!user) return;
    const lastSignIn = user.metadata.lastSignInTime;
    if (lastSignIn) {
      const signInDate = new Date(lastSignIn);
      const daysSinceSignIn = (Date.now() - signInDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceSignIn > PORTAL_SESSION_MAX_DAYS) {
        signOut(auth).then(() => { window.location.href = '/portal/auth'; });
      }
    }
  }, [user]);

  // Portal users: try Firestore via claims, fall back to session-stored data
  const clientId = typeof claims.clientId === 'string'
    ? claims.clientId
    : (sessionStorage.getItem('portalClientId') ?? undefined);
  const { workItems: firestoreItems } = useWorkItems(clientId);

  // Fall back to work item data stored in session (from verifyMagicLink)
  const sessionWorkItem = useMemo(() => {
    const stored = sessionStorage.getItem('portalWorkItem');
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return [{ ...parsed, createdAt: new Date(), updatedAt: new Date() }] as WorkItem[];
    } catch { return []; }
  }, []);

  const workItems = firestoreItems.length > 0 ? firestoreItems : sessionWorkItem;
  const clientName = (user?.displayName ?? user?.email ?? sessionStorage.getItem('portalEmail') ?? 'Client');

  return (
    <Routes>
      <Route
        index
        element={<PortalHome workItems={workItems} clientName={clientName} />}
      />
      <Route
        path=":id"
        element={<PortalDetail workItems={workItems} />}
      />
    </Routes>
  );
}

export default function App() {
  const { user, loading, authError, signInWithGoogle, signInWithEmail } = useAuth();

  // Trigger AI insight generation on contractor login
  useEffect(() => {
    if (user && isContractorUser(user)) {
      callGenerateInsights().catch(console.error);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2C2417] flex items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <div className="mb-5">
            <BrandWordmark size={64} variant="light" />
          </div>
          <div className="text-sm text-white/40 mt-3">Loading...</div>
        </div>
      </div>
    );
  }

  // A user is a contractor only if they signed in with Google.
  // Portal clients authenticate via custom token and must not reach /dashboard.
  const isContractor = user != null && isContractorUser(user);
  // A portal user is any authenticated user who is NOT a Google contractor.
  const isPortalUser = user != null && !isContractorUser(user);

  return (
    <ErrorBoundary>
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Portal auth (public) */}
        <Route path="/portal/auth" element={<PortalAuth />} />

        {/* Portal routes — portal clients only.
            Contractor users attempting /portal/* are sent to /dashboard
            to prevent session confusion. */}
        <Route
          path="/portal/*"
          element={
            isPortalUser ? (
              <PortalRoutes />
            ) : isContractor ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/portal/auth" replace />
            )
          }
        />

        {/* Contractor routes — Google-authenticated contractors only.
            Portal users attempting /dashboard/* are sent back to /portal
            to prevent privilege escalation. */}
        <Route
          path="/dashboard/*"
          element={
            isContractor ? (
              <ContractorLayout />
            ) : isPortalUser ? (
              <Navigate to="/portal" replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        >
          <Route path="*" element={<ContractorRoutes />} />
        </Route>

        {/* Login — redirect authenticated users to their correct home */}
        <Route
          path="/"
          element={
            isContractor ? (
              <Navigate to="/dashboard" replace />
            ) : isPortalUser ? (
              <Navigate to="/portal" replace />
            ) : (
              <Login
                onSignIn={signInWithGoogle}
                onDevSignIn={signInWithEmail}
                error={authError}
              />
            )
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}
