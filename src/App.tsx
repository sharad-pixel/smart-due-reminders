import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import ScrollToTop from "./components/layout/ScrollToTop";
import { CookieConsentProvider } from "./components/cookies/CookieConsentProvider";
import { AccessProvider } from "./contexts/AccessContext";
import { DemoProvider } from "./contexts/DemoContext";
import { MaintenanceGuard } from "./components/layout/MaintenanceGuard";
import { SessionSecurityProvider } from "./components/security/SessionSecurityProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Handle chunk load errors (stale deployments) by reloading
const handleChunkError = () => {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('Failed to fetch dynamically imported module') ||
        event.reason?.message?.includes('Loading chunk')) {
      // Avoid infinite reload loops
      const lastReload = sessionStorage.getItem('chunk_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload) > 10000) {
        sessionStorage.setItem('chunk_reload', now.toString());
        window.location.reload();
      }
    }
  });
};

// Loading component for Suspense fallback
const PageLoader = () => {
  useEffect(() => { handleChunkError(); }, []);
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
};

// CRITICAL IMPORTS - Load immediately (needed for initial render)
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
const ProfessionalServicesData = lazy(() => import("./pages/ProfessionalServicesData"));
const StripeCollections = lazy(() => import("./pages/StripeCollections"));
const SoloPro = lazy(() => import("./pages/solutions/SoloPro"));
const Startups = lazy(() => import("./pages/Startups"));
const SMB = lazy(() => import("./pages/SMB"));
const Enterprise = lazy(() => import("./pages/Enterprise"));
const About = lazy(() => import("./pages/About"));
const Investors = lazy(() => import("./pages/Investors"));
const Integrations = lazy(() => import("./pages/Integrations"));
const StripeSyncDiagnostics = lazy(() => import("./pages/StripeSyncDiagnostics"));
const CollectionIntelligence = lazy(() => import("./pages/CollectionIntelligence"));
const CollectionsAssessment = lazy(() => import("./pages/CollectionsAssessment"));
const WhyCollectionsMatter = lazy(() => import("./pages/WhyCollectionsMatter"));
const Personas = lazy(() => import("./pages/Personas"));
const AICommandCenter = lazy(() => import("./pages/AICommandCenter"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const DesignPartners = lazy(() => import("./pages/DesignPartners"));
const Careers = lazy(() => import("./pages/Careers"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const RevenueRiskFeature = lazy(() => import("./pages/features/RevenueRiskFeature"));
const AutomationPage = lazy(() => import("./pages/AutomationPage"));

const CollectionsCRM = lazy(() => import("./pages/pillar/CollectionsCRM"));
const AICollectionsPlatform = lazy(() => import("./pages/pillar/AICollectionsPlatform"));
const RevenueRiskIntelligence = lazy(() => import("./pages/pillar/RevenueRiskIntelligence"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
// Blog Pages
const BlogIndex = lazy(() => import("./pages/blog/BlogIndex"));
const CelebrateCash = lazy(() => import("./pages/blog/CelebrateCash"));
const PowerOfOutreach = lazy(() => import("./pages/blog/PowerOfOutreach"));
const CashLeakage = lazy(() => import("./pages/blog/CashLeakage"));
const FutureOfAiInCollections = lazy(() => import("./pages/blog/FutureOfAiInCollections"));
const RevenueNotCashFlow = lazy(() => import("./pages/blog/RevenueNotCashFlow"));
const RiseOfCollectionsIntelligence = lazy(() => import("./pages/blog/RiseOfCollectionsIntelligence"));
const TimingMattersMoreThanTone = lazy(() => import("./pages/blog/TimingMattersMoreThanTone"));
const EngagementAsCreditSignal = lazy(() => import("./pages/blog/EngagementAsCreditSignal"));
const HiddenCostDelayedPayments = lazy(() => import("./pages/blog/HiddenCostDelayedPayments"));
const DataTrustInArAutomation = lazy(() => import("./pages/blog/DataTrustInArAutomation"));
const SpreadsheetsToSystems = lazy(() => import("./pages/blog/SpreadsheetsToSystems"));
const PredictiveCollections = lazy(() => import("./pages/blog/PredictiveCollections"));
const NextGenerationArTeams = lazy(() => import("./pages/blog/NextGenerationArTeams"));
const DeathOfTraditionalCollections = lazy(() => import("./pages/blog/DeathOfTraditionalCollections"));
const SetItAndForgetItAutomation = lazy(() => import("./pages/blog/SetItAndForgetItAutomation"));
const RiskAsRealtimeSystem = lazy(() => import("./pages/blog/RiskAsRealtimeSystem"));
const WhyCollectionsNeedsCrm = lazy(() => import("./pages/blog/WhyCollectionsNeedsCrm"));

// Legal Pages
const Terms = lazy(() => import("./pages/legal/Terms"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const Cookies = lazy(() => import("./pages/legal/Cookies"));
const Security = lazy(() => import("./pages/Security"));

// Trust Center Pages
const TrustCenter = lazy(() => import("./pages/trust/TrustCenter"));
const TrustSecurityOverview = lazy(() => import("./pages/trust/SecurityOverview"));
const TrustAccessControl = lazy(() => import("./pages/trust/AccessControl"));
const TrustDataProtection = lazy(() => import("./pages/trust/DataProtection"));
const TrustIncidentResponse = lazy(() => import("./pages/trust/IncidentResponse"));
const TrustBusinessContinuity = lazy(() => import("./pages/trust/BusinessContinuity"));
const TrustApplicationSecurity = lazy(() => import("./pages/trust/ApplicationSecurity"));
const TrustVendorSecurity = lazy(() => import("./pages/trust/VendorSecurity"));
const TrustPrivacyDataHandling = lazy(() => import("./pages/trust/PrivacyDataHandling"));
const TrustSecurityReviewResources = lazy(() => import("./pages/trust/SecurityReviewResources"));

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
const PublicPaymentPlanPage = lazy(() => import("./pages/PublicPaymentPlanPage"));
const DebtorPortalPage = lazy(() => import("./pages/DebtorPortalPage"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

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
const PublicInvoicePage = lazy(() => import("./pages/PublicInvoicePage"));
const Alerts = lazy(() => import("./pages/Alerts"));
const EmailDeliveryReport = lazy(() => import("./pages/EmailDeliveryReport"));
const RevenueRisk = lazy(() => import("./pages/RevenueRisk"));


// Payment & Billing
const Checkout = lazy(() => import("./pages/Checkout"));
const Billing = lazy(() => import("./pages/Billing"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const PaymentsActivity = lazy(() => import("./pages/PaymentsActivity"));
const ARIntroduction = lazy(() => import("./pages/ARIntroduction"));

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
const AdminLeadOutreach = lazy(() => import("./pages/admin/AdminLeadOutreach"));
const AdminStaleUsers = lazy(() => import("./pages/admin/AdminStaleUsers"));
const AdminSupportAccess = lazy(() => import("./pages/admin/AdminSupportAccess"));
const AdminSupportUsers = lazy(() => import("./pages/admin/AdminSupportUsers"));
const SupportLogin = lazy(() => import("./pages/SupportLogin"));
const SupportVerify = lazy(() => import("./pages/SupportVerify"));
const SupportCallback = lazy(() => import("./pages/SupportCallback"));
const DemoMode = lazy(() => import("./pages/DemoMode"));

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
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AccessProvider>
          <DemoProvider>
          <SessionSecurityProvider>
          <CookieConsentProvider>
            <MaintenanceGuard>
              <ScrollToTop />
              <Toaster />
              <Sonner />
              <Suspense fallback={<PageLoader />}>
                <Routes>
              {/* Main app entry point */}
              <Route path="/" element={<Index />} />
              <Route path="/coming-soon" element={<ComingSoon />} />
              <Route path="/demo" element={<DemoMode />} />

              {/* Marketing & Info Pages */}
              <Route path="/design-partners" element={<DesignPartners />} />
              <Route path="/features" element={<Features />} />
              <Route path="/collection-intelligence" element={<CollectionIntelligence />} />
              <Route path="/collections-assessment" element={<CollectionsAssessment />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/personas" element={<Personas />} />
              <Route path="/ai-command-center" element={<AICommandCenter />} />
              <Route path="/why-collections-matter" element={<WhyCollectionsMatter />} />
              <Route path="/solutions" element={<Solutions />} />
              <Route path="/solutions/solo-pro" element={<SoloPro />} />
              <Route path="/solutions/small-businesses" element={<SmallBusinesses />} />
              <Route path="/solutions/saas" element={<SaaS />} />
              <Route path="/solutions/professional-services" element={<ProfessionalServices />} />
              <Route path="/professional-services" element={<ProfessionalServicesData />} />
              <Route path="/stripe-collections" element={<StripeCollections />} />
              <Route path="/startups" element={<Startups />} />
              <Route path="/smb" element={<SMB />} />
              <Route path="/enterprise" element={<Enterprise />} />
              <Route path="/about" element={<About />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/integrations/stripe-sync" element={<StripeSyncDiagnostics />} />
              <Route path="/investors" element={<Investors />} />
              <Route path="/careers" element={<Careers />} />
              <Route path="/knowledge-base" element={<KnowledgeBase />} />
              <Route path="/faq" element={<KnowledgeBase />} />
              <Route path="/help" element={<KnowledgeBase />} />
              <Route path="/features/revenue-risk" element={<RevenueRiskFeature />} />
              <Route path="/automation" element={<AutomationPage />} />
              
              <Route path="/analytics" element={<AnalyticsPage />} />

              {/* Pillar Pages */}
              <Route path="/collections-crm" element={<CollectionsCRM />} />
              <Route path="/ai-collections-platform" element={<AICollectionsPlatform />} />
              <Route path="/revenue-risk-intelligence" element={<RevenueRiskIntelligence />} />

              {/* Blog Pages */}
              <Route path="/blog" element={<BlogIndex />} />
              <Route path="/blog/celebrate-cash" element={<CelebrateCash />} />
              <Route path="/blog/power-of-outreach" element={<PowerOfOutreach />} />
              <Route path="/blog/cash-leakage" element={<CashLeakage />} />
              <Route path="/blog/future-of-ai-in-collections" element={<FutureOfAiInCollections />} />
              <Route path="/blog/revenue-does-not-equal-cash-flow" element={<RevenueNotCashFlow />} />
              <Route path="/blog/rise-of-collections-intelligence" element={<RiseOfCollectionsIntelligence />} />
              <Route path="/blog/timing-matters-more-than-tone" element={<TimingMattersMoreThanTone />} />
              <Route path="/blog/engagement-as-credit-signal" element={<EngagementAsCreditSignal />} />
              <Route path="/blog/hidden-cost-of-delayed-payments" element={<HiddenCostDelayedPayments />} />
              <Route path="/blog/data-trust-in-ar-automation" element={<DataTrustInArAutomation />} />
              <Route path="/blog/spreadsheets-to-systems-of-record" element={<SpreadsheetsToSystems />} />
              <Route path="/blog/predictive-collections-revenue-risk" element={<PredictiveCollections />} />
              <Route path="/blog/next-generation-ar-teams" element={<NextGenerationArTeams />} />
              <Route path="/blog/death-of-traditional-collections" element={<DeathOfTraditionalCollections />} />
              <Route path="/blog/set-it-and-forget-it-automation" element={<SetItAndForgetItAutomation />} />
              <Route path="/blog/risk-as-a-real-time-operational-system" element={<RiskAsRealtimeSystem />} />
              <Route path="/blog/why-collections-needs-a-crm" element={<WhyCollectionsNeedsCrm />} />

              {/* Legal Pages */}
              <Route path="/legal/terms" element={<Terms />} />
              <Route path="/legal/privacy" element={<Privacy />} />
              <Route path="/legal/cookies" element={<Cookies />} />
              <Route path="/security-public" element={<Security />} />

              {/* Trust Center */}
              <Route path="/trust" element={<TrustCenter />} />
              <Route path="/trust/security-overview" element={<TrustSecurityOverview />} />
              <Route path="/trust/access-control" element={<TrustAccessControl />} />
              <Route path="/trust/data-protection" element={<TrustDataProtection />} />
              <Route path="/trust/incident-response" element={<TrustIncidentResponse />} />
              <Route path="/trust/business-continuity" element={<TrustBusinessContinuity />} />
              <Route path="/trust/application-security" element={<TrustApplicationSecurity />} />
              <Route path="/trust/vendor-security" element={<TrustVendorSecurity />} />
              <Route path="/trust/privacy-data-handling" element={<TrustPrivacyDataHandling />} />
              <Route path="/trust/security-review-resources" element={<TrustSecurityReviewResources />} />

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

              {/* Onboarding */}
              <Route path="/onboarding" element={<Onboarding />} />

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
              <Route path="/invoice/:token" element={<PublicInvoicePage />} />
              <Route path="/payment-plan/:token" element={<PublicPaymentPlanPage />} />
              <Route path="/debtor-portal" element={<DebtorPortalPage />} />
              <Route path="/ar-upload" element={<ARDataUpload />} />
              <Route path="/ar-introduction" element={<ARIntroduction />} />
              <Route path="/reconciliation" element={<Reconciliation />} />
              <Route path="/ar-aging" element={<ARAging />} />
              <Route path="/data-center" element={<DataCenter />} />
              <Route path="/data-center/review/:uploadId" element={<DataCenterReview />} />
              <Route path="/daily-digest" element={<DailyDigest />} />
              <Route path="/outreach" element={<Outreach />} />
              <Route path="/outreach-history" element={<OutreachHistory />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/revenue-risk" element={<RevenueRisk />} />
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
              <Route path="/admin/leads" element={<AdminLeadOutreach />} />
              <Route path="/admin/stale-users" element={<AdminStaleUsers />} />
              <Route path="/admin/support-access" element={<AdminSupportAccess />} />
              <Route path="/admin/support-users" element={<AdminSupportUsers />} />
              <Route path="/support/login" element={<SupportLogin />} />
              <Route path="/support/verify" element={<SupportVerify />} />

                {/* 404 - Keep at bottom */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </MaintenanceGuard>
          </CookieConsentProvider>
          </SessionSecurityProvider>
          </DemoProvider>
        </AccessProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
