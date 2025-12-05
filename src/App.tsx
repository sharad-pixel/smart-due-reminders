import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import Solutions from "./pages/Solutions";
import SmallBusinesses from "./pages/solutions/SmallBusinesses";
import SaaS from "./pages/solutions/SaaS";
import ProfessionalServices from "./pages/solutions/ProfessionalServices";
import FinalInternalCollections from "./pages/solutions/FinalInternalCollections";
import Terms from "./pages/legal/Terms";
import Privacy from "./pages/legal/Privacy";
import Security from "./pages/Security";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Debtors from "./pages/Debtors";
import DebtorDetail from "./pages/DebtorDetail";
import Invoices from "./pages/Invoices";
import InvoiceDetail from "./pages/InvoiceDetail";
import Settings from "./pages/Settings";
import TeamMembersSettings from "./pages/TeamMembersSettings";
import Checkout from "./pages/Checkout";
import ContactUs from "./pages/ContactUs";
import Upgrade from "./pages/Upgrade";
import Team from "./pages/Team";
import Profile from "./pages/Profile";
import SecurityDashboard from "./pages/SecurityDashboard";
import SecuritySettings from "./pages/SecuritySettings";
import AIWorkflows from "./pages/AIWorkflows";
import CollectionTasks from "./pages/CollectionTasks";
import AddressAutocompleteSettings from "./pages/AddressAutocompleteSettings";
import Personas from "./pages/Personas";
import AICommandCenter from "./pages/AICommandCenter";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";
import DebtorDashboard from "./pages/DebtorDashboard";
import WhyCollectionsMatter from "./pages/WhyCollectionsMatter";
import Documents from "./pages/Documents";
import BringYourOwnEmail from "./pages/BringYourOwnEmail";
import Startups from "./pages/Startups";
import SMB from "./pages/SMB";
import Enterprise from "./pages/Enterprise";
import Billing from "./pages/Billing";

import InboundCommandCenter from "./pages/InboundCommandCenter";
import ARDataUpload from "./pages/ARDataUpload";
import Reconciliation from "./pages/Reconciliation";
import ARAging from "./pages/ARAging";
import DataCenter from "./pages/DataCenter";
import DataCenterReview from "./pages/DataCenterReview";
import DailyDigest from "./pages/DailyDigest";
import About from "./pages/About";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        {/* HOMEPAGE: Coming Soon page for public visitors */}
        <Route path="/" element={<ComingSoon />} />
        
        {/* Full marketing site accessible at /home */}
        <Route path="/home" element={<Home />} />
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/personas" element={<Personas />} />
        <Route path="/ai-command-center" element={<AICommandCenter />} />
        <Route path="/why-collections-matter" element={<WhyCollectionsMatter />} />
        <Route path="/solutions" element={<Solutions />} />
        <Route path="/solutions/small-businesses" element={<SmallBusinesses />} />
        <Route path="/solutions/saas" element={<SaaS />} />
        <Route path="/solutions/professional-services" element={<ProfessionalServices />} />
        <Route path="/solutions/final-internal-collections" element={<FinalInternalCollections />} />
        <Route path="/startups" element={<Startups />} />
        <Route path="/smb" element={<SMB />} />
        <Route path="/enterprise" element={<Enterprise />} />
        <Route path="/about" element={<About />} />
        <Route path="/legal/terms" element={<Terms />} />
        <Route path="/legal/privacy" element={<Privacy />} />
        <Route path="/security-public" element={<Security />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/contact-us" element={<ContactUs />} />
        <Route path="/upgrade" element={<Upgrade />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/debtors" element={<DebtorDashboard />} />
        <Route path="/debtors" element={<Debtors />} />
        <Route path="/debtors/:id" element={<DebtorDetail />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/team-members" element={<TeamMembersSettings />} />
        <Route path="/settings/ai-workflows" element={<AIWorkflows />} />
        <Route path="/settings/integrations/address-autocomplete" element={<AddressAutocompleteSettings />} />
        <Route path="/settings/email-accounts" element={<BringYourOwnEmail />} />
        <Route path="/collections/tasks" element={<CollectionTasks />} />
        <Route path="/tasks" element={<CollectionTasks />} />
        <Route path="/inbound" element={<InboundCommandCenter />} />
        <Route path="/team" element={<Team />} />
        <Route path="/security" element={<SecurityDashboard />} />
        <Route path="/security-settings" element={<SecuritySettings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/ar-upload" element={<ARDataUpload />} />
        <Route path="/reconciliation" element={<Reconciliation />} />
        <Route path="/ar-aging" element={<ARAging />} />
        <Route path="/data-center" element={<DataCenter />} />
        <Route path="/data-center/review/:uploadId" element={<DataCenterReview />} />
        <Route path="/daily-digest" element={<DailyDigest />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
