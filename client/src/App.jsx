import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import PublicLayout from './layouts/PublicLayout';
import AppLayout from './layouts/AppLayout';
import { WarehouseRouteGuard } from './components/WarehouseRouteGuard';
import SeoHead from './components/SeoHead';

const Home = lazy(() => import('./pages/public/Home'));
const About = lazy(() => import('./pages/public/About'));
const Services = lazy(() => import('./pages/public/Services'));
const Contact = lazy(() => import('./pages/public/Contact'));
const Login = lazy(() => import('./pages/public/Login'));
const NotFound = lazy(() => import('./pages/public/NotFound'));

const Dashboard = lazy(() => import('./pages/app/Dashboard'));
const CrmPage = lazy(() => import('./pages/app/CrmPage'));
const ProposalPage = lazy(() => import('./pages/app/ProposalPage'));
const ProjectsPage = lazy(() => import('./pages/app/ProjectsPage'));
const FinancePage = lazy(() => import('./pages/app/FinancePage'));
const WarehousePage = lazy(() => import('./pages/app/WarehousePage'));
const PricingPage = lazy(() => import('./pages/app/PricingPage'));
const UsersPage = lazy(() => import('./pages/app/UsersPage'));
const ProfilePage = lazy(() => import('./pages/app/ProfilePage'));
const ClientPortal = lazy(() => import('./pages/app/ClientPortal'));
const SupplyPage = lazy(() => import('./pages/app/SupplyPage'));
const WhatsAppPage = lazy(() => import('./pages/app/WhatsAppPage'));
const ConstructorPage = lazy(() => import('./pages/app/ConstructorPage'));
const AnalyticsPage = lazy(() => import('./pages/app/AnalyticsPage'));
const ContractorPage = lazy(() => import('./pages/app/ContractorPage'));
const AuctionsRoute = lazy(() => import('./pages/app/AuctionsRoute'));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container" style={{ padding: 40 }}>Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppSeoGate() {
  const { pathname } = useLocation();
  const isPrivate = pathname.startsWith('/app') || pathname === '/login';
  if (!isPrivate) return null;
  return (
    <SeoHead
      title={pathname === '/login' ? 'Вход' : 'Кабинет'}
      description="Закрытый раздел Solar Galaxy."
      path={pathname}
      noindex
    />
  );
}

function RouteFallback() {
  return <div className="container" style={{ padding: 40 }}>Загрузка…</div>;
}

export default function App() {
  return (
    <>
      <AppSeoGate />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="services" element={<Services />} />
            <Route path="contact" element={<Contact />} />
            <Route path="login" element={<Login />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="/app" element={<ProtectedRoute><WarehouseRouteGuard><AppLayout /></WarehouseRouteGuard></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="crm" element={<CrmPage />} />
            <Route path="proposals" element={<ProposalPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="warehouse" element={<WarehousePage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="supply" element={<SupplyPage />} />
            <Route path="auctions" element={<AuctionsRoute mode="open" />} />
            <Route path="auction-results" element={<AuctionsRoute mode="results" />} />
            <Route path="my-bids" element={<ContractorPage tab="bids" />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="whatsapp" element={<WhatsAppPage />} />
            <Route path="constructor" element={<ConstructorPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="portal" element={<ClientPortal />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
