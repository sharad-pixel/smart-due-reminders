import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import { CookieConsentProvider } from "./components/CookieConsentProvider";
import Home from "./pages/Home";
import Features from "./pages/Features";
import CollectionIntelligence from "./pages/CollectionIntelligence";
import Pricing from "./pages/Pricing";
import Solutions from "./pages/Solutions";
import SmallBusinesses from "./pages/solutions/SmallBusinesses";
import SaaS from "./pages/solutions/SaaS";
import ProfessionalServices from "./pages/solutions/ProfessionalServices";
import Terms from "./pages/legal/Terms";
import Privacy from "./pages/legal/Privacy";
import Cookies from "./pages/legal/Cookies";
import Security from "./pages/Security";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Debtors from "./pages/Debtors";
import DebtorDetail from "./pages/DebtorDetail";
import Invoices from "./pages/Invoices";
import InvoiceDetail from "./pages/InvoiceDetail";
import Settings from "./pages/Settings";

import Checkout from "./pages/Checkout";
import ContactUs from "./pages/ContactUs";
import Upgrade from "./pages/Upgrade";
import Team from "./pages/Team";
import AcceptInvite from "./pages/AcceptInvite";
import Profile from "./pages/Profile";
import SecurityDashboard from "./pages/SecurityDashboard";
import AIWorkflows from "./pages/AIWorkflows";
import CollectionTasks from "./pages/CollectionTasks";
import Personas from "./pages/Personas";
import AICommandCenter from "./pages/AICommandCenter";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";
import WhyCollectionsMatter from "./pages/WhyCollectionsMatter";
import Documents from "./pages/Documents";
import Startups from "./pages/Startups";
import SMB from "./pages/SMB";
import Enterprise from "./pages/Enterprise";
import Billing from "./pages/Billing";
import Branding from "./pages/Branding";
import PublicARPage from "./pages/PublicARPage";

import InboundCommandCenter from "./pages/InboundCommandCenter";
import ARDataUpload from "./pages/ARDataUpload";
import Reconciliation from "./pages/Reconciliation";
import ARAging from "./pages/ARAging";
import DataCenter from "./pages/DataCenter";
import DataCenterReview from "./pages/DataCenterReview";
import DailyDigest from "./pages/DailyDigest";
import Outreach from "./pages/Outreach";
import About from "./pages/About";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUserManagement from "./pages/admin/AdminUserManagement";
import AdminActivityLogs from "./pages/admin/AdminActivityLogs";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminWaitlist from "./pages/admin/AdminWaitlist";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminEdgeFunctions from "./pages/admin/AdminEdgeFunctions";
import AdminDatabase from "./pages/admin/AdminDatabase";
import AdminSecurity from "./pages/admin/AdminSecurity";
import AdminSystem from "./pages/admin/AdminSystem";
import AdminEmailTemplates from "./pages/admin/AdminEmailTemplates";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <CookieConsentProvider>
        <ScrollToTop />
        <Toaster />
        <Sonner />
        <Routes>
          {/* HOMEPAGE: Coming Soon page for public visitors */}
          <Route path="/" element={<ComingSoon />} />
          
          {/* Full marketing site accessible at /home */}
          <Route path="/home" element={<Home />} />
          <Route path="/features" element={<Features />} />
          <Route path="/collection-intelligence" element={<CollectionIntelligence />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/personas" element={<Personas />} />
          <Route path="/ai-command-center" element={<AICommandCenter />} />
          <Route path="/why-collections-matter" element={<WhyCollectionsMatter />} />
          <Route path="/solutions" element={<Solutions />} />
          <Route path="/solutions/small-businesses" element={<SmallBusinesses />} />
          <Route path="/solutions/saas" element={<SaaS />} />
          <Route path="/solutions/professional-services" element={<ProfessionalServices />} />
          <Route path="/startups" element={<Startups />} />
          <Route path="/smb" element={<SMB />} />
          <Route path="/enterprise" element={<Enterprise />} />
          <Route path="/about" element={<About />} />
          <Route path="/legal/terms" element={<Terms />} />
          <Route path="/legal/privacy" element={<Privacy />} />
          <Route path="/legal/cookies" element={<Cookies />} />
          <Route path="/security-public" element={<Security />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/contact-us" element={<ContactUs />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/upgrade" element={<Upgrade />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/debtors" element={<Debtors />} />
          <Route path="/debtors/:id" element={<DebtorDetail />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/settings" element={<Settings />} />
          
          <Route path="/settings/ai-workflows" element={<AIWorkflows />} />
          <Route path="/tasks" element={<CollectionTasks />} />
          <Route path="/inbound" element={<InboundCommandCenter />} />
          <Route path="/team" element={<Team />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/security" element={<SecurityDashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/branding" element={<Branding />} />
          <Route path="/ar/:token" element={<PublicARPage />} />
          <Route path="/ar-upload" element={<ARDataUpload />} />
          <Route path="/reconciliation" element={<Reconciliation />} />
          <Route path="/ar-aging" element={<ARAging />} />
          <Route path="/data-center" element={<DataCenter />} />
          <Route path="/data-center/review/:uploadId" element={<DataCenterReview />} />
          <Route path="/daily-digest" element={<DailyDigest />} />
          <Route path="/outreach" element={<Outreach />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/user-management" element={<AdminUserManagement />} />
          <Route path="/admin/activity" element={<AdminActivityLogs />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/waitlist" element={<AdminWaitlist />} />
          <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
          <Route path="/admin/edge-functions" element={<AdminEdgeFunctions />} />
          <Route path="/admin/database" element={<AdminDatabase />} />
          <Route path="/admin/security" element={<AdminSecurity />} />
          <Route path="/admin/system" element={<AdminSystem />} />
          <Route path="/admin/email-templates" element={<AdminEmailTemplates />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </CookieConsentProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
