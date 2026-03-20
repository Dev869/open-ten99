import { Suspense, lazy, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, isContractorUser } from './hooks/useAuth';
import { useWorkItems, useClients, useSettings, useApps } from './hooks/useFirestore';
import { updateSettings } from './services/firestore';
import { Sidebar } from './components/Sidebar';
import { TimeTracker } from './components/TimeTracker';
import { ToastContainer } from './components/ToastContainer';
import { ToastContext, useToastState } from './hooks/useToast';
import { useTheme } from './hooks/useTheme';
import { GlobalSearch } from './components/GlobalSearch';
import { computeNotifications, NotificationPanel, MobileNotificationBell } from './components/NotificationCenter';
import { IconMenu, IconLayers, IconSearch } from './components/icons';
import Login from './routes/Login';

// Lazy-loaded contractor routes
const Dashboard = lazy(() => import('./routes/contractor/Dashboard'));
const WorkItems = lazy(() => import('./routes/contractor/WorkItems'));
const WorkItemDetail = lazy(() => import('./routes/contractor/WorkItemDetail'));
const Calendar = lazy(() => import('./routes/contractor/Calendar'));
const Clients = lazy(() => import('./routes/contractor/Clients'));
const ClientDetail = lazy(() => import('./routes/contractor/ClientDetail'));
const FinanceOverview = lazy(() => import('./routes/contractor/FinanceOverview'));
const Invoices = lazy(() => import('./routes/contractor/Invoices'));
const Reports = lazy(() => import('./routes/contractor/Reports'));
const Team = lazy(() => import('./routes/contractor/Team'));
const Settings = lazy(() => import('./routes/contractor/Settings'));
const Profile = lazy(() => import('./routes/contractor/Profile'));
const Vault = lazy(() => import('./routes/contractor/Vault'));
const AppsList = lazy(() => import('./routes/contractor/AppsList'));
const AppDetail = lazy(() => import('./routes/contractor/AppDetail'));

// Lazy-loaded portal routes
const PortalAuth = lazy(() => import('./routes/portal/PortalAuth'));
const PortalHome = lazy(() => import('./routes/portal/PortalHome'));
const PortalDetail = lazy(() => import('./routes/portal/PortalDetail'));

function Loading() {
  return (
    <div className="flex items-center justify-center h-full py-20">
      <div className="text-sm text-[var(--text-secondary)]">Loading...</div>
    </div>
  );
}

function ContractorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const stored = localStorage.getItem('oc-sidebar-expanded');
    return stored === 'true';
  });
  const { dark, toggle } = useTheme();
  const { user } = useAuth();
  const { workItems } = useWorkItems();
  const { clients } = useClients();
  const { settings } = useSettings(user?.uid);
  const toastState = useToastState();
  const pendingCount = workItems.filter(
    (i) => i.status === 'draft' || i.status === 'inReview'
  ).length;

  // Notification center state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifDismissed, setNotifDismissed] = useState<Set<string>>(new Set());
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
    setNotifDismissed((prev) => new Set(prev).add(id));
  }, []);

  const handleNotifDismissAll = useCallback(() => {
    setNotifDismissed(new Set(allNotifications.map((n) => n.id)));
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
      <div className="flex h-screen bg-[var(--bg-page)]">
        <Sidebar
          pendingCount={pendingCount}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
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
          {/* Mobile header */}
          <header className="md:hidden flex items-center h-14 px-4 bg-[var(--bg-card)] border-b border-[var(--border)] flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-colors"
            >
              <IconMenu size={22} />
            </button>
            <div className="flex-1 flex items-center justify-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center">
                <IconLayers size={13} />
              </div>
              <span className="font-semibold text-[var(--text-primary)] text-sm tracking-tight">OpenChanges</span>
            </div>
            <div className="flex items-center gap-1">
              <MobileNotificationBell
                count={notifCount}
                onClick={handleNotifToggle}
                buttonRef={mobileBellRef}
              />
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 -mr-2 rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-input)] transition-colors"
              >
                <IconSearch size={20} />
              </button>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <Suspense fallback={<Loading />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <TimeTracker clients={clients} />
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
    </ToastContext.Provider>
  );
}

function ContractorRoutes() {
  const { user, logout } = useAuth();
  const { workItems } = useWorkItems();
  const { clients } = useClients();
  const { settings } = useSettings(user?.uid);
  const { apps } = useApps();
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
            hourlyRate={settings.hourlyRate}
          />
        }
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
        path="finance/invoices"
        element={<Invoices workItems={workItems} clients={clients} />}
      />
      <Route
        path="finance/reports"
        element={<Reports workItems={workItems} clients={clients} />}
      />
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
    </Routes>
  );
}

function PortalRoutes() {
  const { user } = useAuth();
  // Portal users have custom claims with clientId
  const clientId = (user as any)?.clientId as string | undefined;
  const { workItems } = useWorkItems(clientId);
  const clientName = (user?.displayName ?? user?.email ?? 'Client');

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
  const { user, loading, signInWithGoogle } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#2C2417] flex items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <div className="w-16 h-16 rounded-full bg-[var(--accent)] flex items-center justify-center mx-auto mb-4">
            <IconLayers size={28} />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">OpenChanges</span>
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
              <Login onSignIn={signInWithGoogle} />
            )
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
