import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
import Solutions from "./pages/Solutions";
import HomeServices from "./pages/solutions/HomeServices";
import SaaS from "./pages/solutions/SaaS";
import ProfessionalServices from "./pages/solutions/ProfessionalServices";
import Terms from "./pages/legal/Terms";
import Privacy from "./pages/legal/Privacy";
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
import Checkout from "./pages/Checkout";
import ContactUs from "./pages/ContactUs";
import Upgrade from "./pages/Upgrade";
import Team from "./pages/Team";
import Profile from "./pages/Profile";
import AIWorkflows from "./pages/AIWorkflows";
import CollectionDrafts from "./pages/CollectionDrafts";
import AddressAutocompleteSettings from "./pages/AddressAutocompleteSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/solutions" element={<Solutions />} />
        <Route path="/solutions/home-services" element={<HomeServices />} />
        <Route path="/solutions/saas" element={<SaaS />} />
        <Route path="/solutions/professional-services" element={<ProfessionalServices />} />
        <Route path="/legal/terms" element={<Terms />} />
        <Route path="/legal/privacy" element={<Privacy />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/contact-us" element={<ContactUs />} />
        <Route path="/upgrade" element={<Upgrade />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/debtors" element={<Debtors />} />
        <Route path="/debtors/:id" element={<DebtorDetail />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/ai-workflows" element={<AIWorkflows />} />
        <Route path="/settings/integrations/address-autocomplete" element={<AddressAutocompleteSettings />} />
        <Route path="/collections/drafts" element={<CollectionDrafts />} />
        <Route path="/team" element={<Team />} />
        <Route path="/profile" element={<Profile />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
