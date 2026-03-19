import { Suspense, lazy, useState } from 'react';
import { Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useWorkItems, useClients, useSettings } from './hooks/useFirestore';
import { Sidebar } from './components/Sidebar';
import Login from './routes/Login';

// Lazy-loaded contractor routes
const Dashboard = lazy(() => import('./routes/contractor/Dashboard'));
const WorkItems = lazy(() => import('./routes/contractor/WorkItems'));
const WorkItemDetail = lazy(() => import('./routes/contractor/WorkItemDetail'));
const Calendar = lazy(() => import('./routes/contractor/Calendar'));
const Clients = lazy(() => import('./routes/contractor/Clients'));
const ClientDetail = lazy(() => import('./routes/contractor/ClientDetail'));
const Analytics = lazy(() => import('./routes/contractor/Analytics'));
const Settings = lazy(() => import('./routes/contractor/Settings'));
const Profile = lazy(() => import('./routes/contractor/Profile'));
const Vault = lazy(() => import('./routes/contractor/Vault'));

// Lazy-loaded portal routes
const PortalAuth = lazy(() => import('./routes/portal/PortalAuth'));
const PortalHome = lazy(() => import('./routes/portal/PortalHome'));
const PortalDetail = lazy(() => import('./routes/portal/PortalDetail'));

function Loading() {
  return (
    <div className="flex items-center justify-center h-full py-20">
      <div className="text-sm text-[#86868B]">Loading...</div>
    </div>
  );
}

function ContractorLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { workItems } = useWorkItems();
  const pendingCount = workItems.filter(
    (i) => i.status === 'draft' || i.status === 'inReview'
  ).length;

  return (
    <div className="flex h-screen bg-[#F5F5F7]">
      <Sidebar
        pendingCount={pendingCount}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center h-14 px-4 bg-white border-b border-[#E5E5EA] flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg text-[#1A1A2E] hover:bg-[#F2F2F7] transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="flex-1 flex items-center justify-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#1A1A2E] flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-semibold text-[#1A1A2E] text-sm tracking-tight">OpenChanges</span>
          </div>
          <div className="w-10" />
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function ContractorRoutes() {
  const { user, logout } = useAuth();
  const { workItems } = useWorkItems();
  const { clients } = useClients();
  const { settings } = useSettings(user?.uid);
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        index
        element={<Dashboard workItems={workItems} clients={clients} />}
      />
      <Route
        path="work-items"
        element={<WorkItems workItems={workItems} clients={clients} settings={settings} />}
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
        element={<Calendar workItems={workItems} clients={clients} />}
      />
      <Route
        path="clients"
        element={<Clients workItems={workItems} clients={clients} />}
      />
      <Route
        path="clients/:id"
        element={<ClientDetail workItems={workItems} clients={clients} />}
      />
      <Route
        path="analytics"
        element={<Analytics workItems={workItems} clients={clients} />}
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
      <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <div className="w-16 h-16 rounded-full bg-[#4BA8A8] flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">OpenChanges</span>
          <div className="text-sm text-white/40 mt-3">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Portal auth (public) */}
        <Route path="/portal/auth" element={<PortalAuth />} />

        {/* Portal routes (authenticated clients) */}
        <Route
          path="/portal/*"
          element={user ? <PortalRoutes /> : <Navigate to="/portal/auth" />}
        />

        {/* Contractor routes (authenticated) */}
        <Route
          path="/dashboard/*"
          element={
            user ? (
              <ContractorLayout />
            ) : (
              <Navigate to="/" />
            )
          }
        >
          <Route path="*" element={<ContractorRoutes />} />
        </Route>

        {/* Login */}
        <Route
          path="/"
          element={
            user ? (
              <Navigate to="/dashboard" />
            ) : (
              <Login onSignIn={signInWithGoogle} />
            )
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}
