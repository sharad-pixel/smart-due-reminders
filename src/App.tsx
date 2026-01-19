import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import ScrollToTop from "./components/ScrollToTop";
import { CookieConsentProvider } from "./components/CookieConsentProvider";

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

// CRITICAL IMPORTS - Load immediately (needed for initial render)
import Home from "./pages/Home";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// LAZY LOAD ALL OTHER PAGES - Split into logical chunks
// Marketing Pages
const Features = lazy(() => import("./pages/Features"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Solutions = lazy(() => import("./pages/Solutions"));
const SmallBusinesses = lazy(() => import("./pages/solutions/SmallBusinesses"));
const SaaS = lazy(() => import("./pages/solutions/SaaS"));
const ProfessionalServices = lazy(() => import("./pages/solutions/ProfessionalServices"));
const Startups = lazy(() => import("./pages/Startups"));
const SMB = lazy(() => import("./pages/SMB"));
const Enterprise = lazy(() => import("./pages/Enterprise"));
const About = lazy(() => import("./pages/About"));
const Investors = lazy(() => import("./pages/Investors"));
const Integrations = lazy(() => import("./pages/Integrations"));
const StripeSyncDiagnostics = lazy(() => import("./pages/StripeSyncDiagnostics"));
const CollectionIntelligence = lazy(() => import("./pages/CollectionIntelligence"));
const WhyCollectionsMatter = lazy(() => import("./pages/WhyCollectionsMatter"));
const Personas = lazy(() => import("./pages/Personas"));
const AICommandCenter = lazy(() => import("./pages/AICommandCenter"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const Careers = lazy(() => import("./pages/Careers"));

// Blog Pages
const BlogIndex = lazy(() => import("./pages/blog/BlogIndex"));
const CelebrateCash = lazy(() => import("./pages/blog/CelebrateCash"));
const PowerOfOutreach = lazy(() => import("./pages/blog/PowerOfOutreach"));

// Legal Pages
const Terms = lazy(() => import("./pages/legal/Terms"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const Cookies = lazy(() => import("./pages/legal/Cookies"));
const Security = lazy(() => import("./pages/Security"));

// Auth Pages
const Signup = lazy(() => import("./pages/Signup"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const EmailVerificationRequired = lazy(() => import("./pages/EmailVerificationRequired"));

// Dashboard & Core App Pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Debtors = lazy(() => import("./pages/Debtors"));
const DebtorDetail = lazy(() => import("./pages/DebtorDetail"));
const LegacyAccountsRedirect = lazy(() => import("./pages/LegacyAccountsRedirect"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const Team = lazy(() => import("./pages/Team"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));

// Feature Pages
const AIWorkflows = lazy(() => import("./pages/AIWorkflows"));
const CollectionTasks = lazy(() => import("./pages/CollectionTasks"));
const InboundCommandCenter = lazy(() => import("./pages/InboundCommandCenter"));
const ARDataUpload = lazy(() => import("./pages/ARDataUpload"));
const Reconciliation = lazy(() => import("./pages/Reconciliation"));
const ARAging = lazy(() => import("./pages/ARAging"));
const DataCenter = lazy(() => import("./pages/DataCenter"));
const DataCenterReview = lazy(() => import("./pages/DataCenterReview"));
const DailyDigest = lazy(() => import("./pages/DailyDigest"));
const Outreach = lazy(() => import("./pages/Outreach"));
const OutreachHistory = lazy(() => import("./pages/OutreachHistory"));
const Documents = lazy(() => import("./pages/Documents"));
const SecurityDashboard = lazy(() => import("./pages/SecurityDashboard"));
const Branding = lazy(() => import("./pages/Branding"));
const PublicARPage = lazy(() => import("./pages/PublicARPage"));
const Alerts = lazy(() => import("./pages/Alerts"));
const EmailDeliveryReport = lazy(() => import("./pages/EmailDeliveryReport"));

// Payment & Billing
const Checkout = lazy(() => import("./pages/Checkout"));
const Billing = lazy(() => import("./pages/Billing"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const PaymentsActivity = lazy(() => import("./pages/PaymentsActivity"));

// Contact
const ContactUs = lazy(() => import("./pages/ContactUs"));

// Admin Pages (heavy - definitely lazy load)
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUserManagement = lazy(() => import("./pages/admin/AdminUserManagement"));
const AdminActivityLogs = lazy(() => import("./pages/admin/AdminActivityLogs"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminWaitlist = lazy(() => import("./pages/admin/AdminWaitlist"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminEdgeFunctions = lazy(() => import("./pages/admin/AdminEdgeFunctions"));
const AdminDatabase = lazy(() => import("./pages/admin/AdminDatabase"));
const AdminSecurity = lazy(() => import("./pages/admin/AdminSecurity"));
const AdminSystem = lazy(() => import("./pages/admin/AdminSystem"));
const AdminEmailTemplates = lazy(() => import("./pages/admin/AdminEmailTemplates"));
const AdminUserDetail = lazy(() => import("./pages/admin/AdminUserDetail"));

// Optimized QueryClient configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - reduce unnecessary refetches
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false, // Prevent refetch on tab switch (can be re-enabled per query)
      retry: 1, // Reduce from default 3 retries
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <CookieConsentProvider>
        <ScrollToTop />
        <Toaster />
        <Sonner />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Main app entry point */}
            <Route path="/" element={<Index />} />
            <Route path="/coming-soon" element={<ComingSoon />} />

            {/* Marketing & Info Pages */}
            <Route path="/design-partners" element={<ComingSoon />} />
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
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/integrations/stripe-sync" element={<StripeSyncDiagnostics />} />
            <Route path="/investors" element={<Investors />} />
            <Route path="/careers" element={<Careers />} />

            {/* Blog Pages */}
            <Route path="/blog" element={<BlogIndex />} />
            <Route path="/blog/celebrate-cash" element={<CelebrateCash />} />
            <Route path="/blog/power-of-outreach" element={<PowerOfOutreach />} />

            {/* Legal Pages */}
            <Route path="/legal/terms" element={<Terms />} />
            <Route path="/legal/privacy" element={<Privacy />} />
            <Route path="/legal/cookies" element={<Cookies />} />
            <Route path="/security-public" element={<Security />} />

            {/* Auth Pages */}
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/email-verification-required" element={<EmailVerificationRequired />} />

            {/* Payment & Contact */}
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/contact-us" element={<ContactUs />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/upgrade" element={<Upgrade />} />
            <Route path="/billing" element={<Billing />} />

            {/* Dashboard & Core App */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/payments" element={<PaymentsActivity />} />
            {/* Legacy route support (older alerts/emails) */}
            <Route path="/accounts" element={<LegacyAccountsRedirect />} />
            <Route path="/accounts/:id" element={<LegacyAccountsRedirect />} />

            <Route path="/debtors" element={<Debtors />} />
            <Route path="/debtors/:id" element={<DebtorDetail />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/settings" element={<Settings />} />

            {/* Feature Pages */}
            <Route path="/ai-workflows" element={<AIWorkflows />} />
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
            <Route path="/outreach-history" element={<OutreachHistory />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/reports/email-delivery" element={<EmailDeliveryReport />} />

            {/* Admin Pages */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/user-management" element={<AdminUserManagement />} />
            <Route path="/admin/users/:userId" element={<AdminUserDetail />} />
            <Route path="/admin/activity" element={<AdminActivityLogs />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/waitlist" element={<AdminWaitlist />} />
            <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
            <Route path="/admin/edge-functions" element={<AdminEdgeFunctions />} />
            <Route path="/admin/database" element={<AdminDatabase />} />
            <Route path="/admin/security" element={<AdminSecurity />} />
            <Route path="/admin/system" element={<AdminSystem />} />
            <Route path="/admin/email-templates" element={<AdminEmailTemplates />} />

            {/* 404 - Keep at bottom */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </CookieConsentProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
