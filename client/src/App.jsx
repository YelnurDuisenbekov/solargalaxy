import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import PublicLayout from './layouts/PublicLayout';
import AppLayout from './layouts/AppLayout';
import Home from './pages/public/Home';
import About from './pages/public/About';
import Services from './pages/public/Services';
import Contact from './pages/public/Contact';
import Login from './pages/public/Login';
import Dashboard from './pages/app/Dashboard';
import CrmPage from './pages/app/CrmPage';
import ProposalPage from './pages/app/ProposalPage';
import ProjectsPage from './pages/app/ProjectsPage';
import FinancePage from './pages/app/FinancePage';
import WarehousePage from './pages/app/WarehousePage';
import PricingPage from './pages/app/PricingPage';
import UsersPage from './pages/app/UsersPage';
import ProfilePage from './pages/app/ProfilePage';
import ClientPortal from './pages/app/ClientPortal';
import SupplyPage from './pages/app/SupplyPage';
import WhatsAppPage from './pages/app/WhatsAppPage';
import ConstructorPage from './pages/app/ConstructorPage';
import AnalyticsPage from './pages/app/AnalyticsPage';
import ContractorPage from './pages/app/ContractorPage';
import AuctionsRoute from './pages/app/AuctionsRoute';
import { WarehouseRouteGuard } from './components/WarehouseRouteGuard';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container" style={{ padding: 40 }}>Загрузка…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="services" element={<Services />} />
        <Route path="contact" element={<Contact />} />
        <Route path="login" element={<Login />} />
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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
