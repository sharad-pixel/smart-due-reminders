import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { toast } from "sonner";
import { 
  DollarSign, Calendar, CheckCircle, Clock, XCircle, 
  Building2, ExternalLink, Mail, Loader2, ArrowLeft,
  CreditCard, FileText, AlertTriangle, ShieldCheck, UserCheck
} from "lucide-react";

interface Installment {
  id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: string;
  paid_at: string | null;
}

interface PaymentPlan {
  id: string;
  plan_name: string | null;
  total_amount: number;
  number_of_installments: number;
  installment_amount: number;
  frequency: string;
  start_date: string;
  status: string;
  public_token: string;
  notes: string | null;
  proposed_at: string | null;
  created_at: string;
  debtor_id: string;
  debtor: {
    company_name: string;
    reference_id: string;
  } | null;
  installments: Installment[];
  branding: {
    business_name: string;
    logo_url: string | null;
    primary_color: string | null;
    stripe_payment_link: string | null;
    ar_page_public_token: string | null;
    ar_page_enabled: boolean | null;
    account_name: string | null;
  } | null;
  // Dual approval fields
  requires_dual_approval?: boolean;
  debtor_approved_at?: string | null;
  debtor_approved_by_email?: string | null;
  admin_approved_at?: string | null;
  admin_approved_by?: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  amount_paid: number | null;
  due_date: string;
  status: string;
  product_description: string | null;
  po_number: string | null;
  reference_id: string | null;
  days_past_due: number;
  balance_due: number;
  debtor_id: string;
  debtor: {
    company_name: string;
    reference_id: string;
  } | null;
  branding: {
    business_name: string;
    logo_url: string | null;
    primary_color: string | null;
    stripe_payment_link: string | null;
    ar_page_public_token: string | null;
    ar_page_enabled: boolean | null;
    account_name: string | null;
  } | null;
}

const statusColors: Record<string, string> = {
  proposed: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  active: "bg-emerald-100 text-emerald-800",
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
};

const installmentStatusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-yellow-600" />,
  paid: <CheckCircle className="h-4 w-4 text-green-600" />,
  overdue: <XCircle className="h-4 w-4 text-red-600" />,
};

export default function DebtorPortalPage() {
  const [searchParams] = useSearchParams();
  // Clean and decode the token - email clients sometimes add trailing chars or encode
  const rawToken = searchParams.get("token");
  const token = rawToken ? decodeURIComponent(rawToken.trim()) : null;
  
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvingPlanId, setApprovingPlanId] = useState<string | null>(null);

  // Verify token on load
  useEffect(() => {
    if (token) {
      console.log("[DebtorPortal] Verifying token:", token.substring(0, 8) + "...");
      verifyToken(token);
    }
  }, [token]);

  const verifyToken = async (tokenValue: string) => {
    setIsVerifying(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("verify-debtor-portal-token", {
        body: { token: tokenValue },
      });

      if (error) throw error;

      if (data.valid) {
        setVerifiedEmail(data.email);
        setPaymentPlans(data.paymentPlans || []);
        setInvoices(data.invoices || []);
      } else {
        setError(data.error || "Invalid or expired link");
      }
    } catch (err: any) {
      console.error("Token verification error:", err);
      setError("Failed to verify access. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRequestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("send-debtor-portal-link", {
        body: { email },
      });

      if (error) throw error;

      setLinkSent(true);
      toast.success("Check your email for the access link");
    } catch (err: any) {
      console.error("Error requesting link:", err);
      toast.error("Failed to send link. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprovePlan = async (planId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering plan detail view
    
    if (!verifiedEmail || !token) {
      toast.error("Session expired. Please request a new link.");
      return;
    }

    setApprovingPlanId(planId);
    
    try {
      const { data, error } = await supabase.functions.invoke("debtor-approve-plan", {
        body: { planId, email: verifiedEmail, token },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message || "Payment plan approved!");
        
        // Update the local state to reflect the approval
        setPaymentPlans(prev => prev.map(plan => 
          plan.id === planId 
            ? { 
                ...plan, 
                debtor_approved_at: new Date().toISOString(),
                debtor_approved_by_email: verifiedEmail,
                status: data.activated ? "accepted" : plan.status
              }
            : plan
        ));
        
        // Also update selected plan if viewing details
        if (selectedPlan?.id === planId) {
          setSelectedPlan(prev => prev ? {
            ...prev,
            debtor_approved_at: new Date().toISOString(),
            debtor_approved_by_email: verifiedEmail,
            status: data.activated ? "accepted" : prev.status
          } : null);
        }
      } else {
        toast.error(data.error || "Failed to approve plan");
      }
    } catch (err: any) {
      console.error("Plan approval error:", err);
      toast.error("Failed to approve payment plan. Please try again.");
    } finally {
      setApprovingPlanId(null);
    }
  };

  // Helper to get vendor name (Recouply.ai customer account name) with proper fallback chain
  const getVendorName = (branding: { business_name: string; account_name?: string | null } | null): string => {
    // Priority: branding.business_name → branding.account_name (from profile) → "Vendor"
    // Note: debtor.company_name is the DEBTOR's company, not the vendor's - don't use it here
    if (branding?.business_name && branding.business_name.trim()) {
      return branding.business_name;
    }
    if (branding?.account_name && branding.account_name.trim()) {
      return branding.account_name;
    }
    return "Vendor";
  };

  // Group data by vendor and then by debtor account
  const groupByVendorAndDebtor = () => {
    // First, create a map of vendor -> debtor -> data
    const vendorDebtorMap: Record<string, Record<string, {
      debtorId: string;
      debtorName: string;
      debtorReferenceId: string | null;
      paymentPlans: PaymentPlan[];
      invoices: Invoice[];
    }>> = {};

    // Track vendor metadata
    const vendorMeta: Record<string, {
      businessName: string;
      logoUrl: string | null;
      primaryColor: string | null;
      stripePaymentLink: string | null;
      arPageUrl: string | null;
    }> = {};

    paymentPlans.forEach(plan => {
      const vendorName = getVendorName(plan.branding);
      const debtorId = plan.debtor_id;
      const debtorName = plan.debtor?.company_name || "Unknown Account";
      const debtorRefId = plan.debtor?.reference_id || null;
      const arPageUrl = plan.branding?.ar_page_enabled && plan.branding?.ar_page_public_token 
        ? `/ar/${plan.branding.ar_page_public_token}` 
        : null;

      if (!vendorMeta[vendorName]) {
        vendorMeta[vendorName] = {
          businessName: vendorName,
          logoUrl: plan.branding?.logo_url || null,
          primaryColor: plan.branding?.primary_color || "#1e3a5f",
          stripePaymentLink: plan.branding?.stripe_payment_link || null,
          arPageUrl,
        };
      }

      if (!vendorDebtorMap[vendorName]) {
        vendorDebtorMap[vendorName] = {};
      }
      if (!vendorDebtorMap[vendorName][debtorId]) {
        vendorDebtorMap[vendorName][debtorId] = {
          debtorId,
          debtorName,
          debtorReferenceId: debtorRefId,
          paymentPlans: [],
          invoices: [],
        };
      }
      vendorDebtorMap[vendorName][debtorId].paymentPlans.push(plan);
    });

    invoices.forEach(invoice => {
      const vendorName = getVendorName(invoice.branding);
      const debtorId = invoice.debtor_id;
      const debtorName = invoice.debtor?.company_name || "Unknown Account";
      const debtorRefId = invoice.debtor?.reference_id || null;
      const arPageUrl = invoice.branding?.ar_page_enabled && invoice.branding?.ar_page_public_token 
        ? `/ar/${invoice.branding.ar_page_public_token}` 
        : null;

      if (!vendorMeta[vendorName]) {
        vendorMeta[vendorName] = {
          businessName: vendorName,
          logoUrl: invoice.branding?.logo_url || null,
          primaryColor: invoice.branding?.primary_color || "#1e3a5f",
          stripePaymentLink: invoice.branding?.stripe_payment_link || null,
          arPageUrl,
        };
      }

      if (!vendorDebtorMap[vendorName]) {
        vendorDebtorMap[vendorName] = {};
      }
      if (!vendorDebtorMap[vendorName][debtorId]) {
        vendorDebtorMap[vendorName][debtorId] = {
          debtorId,
          debtorName,
          debtorReferenceId: debtorRefId,
          paymentPlans: [],
          invoices: [],
        };
      }
      vendorDebtorMap[vendorName][debtorId].invoices.push(invoice);
    });

    // Convert to array structure
    return Object.entries(vendorDebtorMap).map(([vendorName, debtors]) => ({
      ...vendorMeta[vendorName],
      debtorAccounts: Object.values(debtors),
    }));
  };

  const vendors = groupByVendorAndDebtor();

  // Email entry form (no token)
  if (!token && !verifiedEmail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Hero Section */}
        <div className="bg-primary py-12 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
              <CreditCard className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">Payment Portal</h1>
            <p className="text-white/80 text-lg max-w-xl mx-auto">
              View your invoices and payment plans, then pay securely online.
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto py-8 px-4">
          {/* Email Entry Card */}
          <Card className="max-w-md mx-auto mb-8">
            <CardHeader className="text-center">
              <CardTitle>Access Your Account</CardTitle>
              <CardDescription>
                Enter your email to receive a secure access link
              </CardDescription>
            </CardHeader>
            <CardContent>
              {linkSent ? (
                <div className="text-center py-4">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Check Your Email</h3>
                  <p className="text-muted-foreground text-sm">
                    If your email is associated with any accounts, you'll receive a secure link to access them. The link expires in 24 hours.
                  </p>
                  <Button
                    variant="link"
                    className="mt-4"
                    onClick={() => {
                      setLinkSent(false);
                      setEmail("");
                    }}
                  >
                    Use a different email
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleRequestLink} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Get Secure Access Link"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* How It Works Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-center mb-6">How It Works</h2>
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="text-center">
                <CardContent className="pt-6">
                  <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">1. Enter Your Email</h3>
                  <p className="text-sm text-muted-foreground">
                    We use your email to find all accounts associated with you across our vendor network.
                  </p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-6">
                  <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">2. Receive Secure Link</h3>
                  <p className="text-sm text-muted-foreground">
                    A one-time secure token is sent to your email. Click the link to access your portal—no password required.
                  </p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-6">
                  <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">3. View & Pay</h3>
                  <p className="text-sm text-muted-foreground">
                    See all vendors you owe, with detailed invoice breakdowns and payment plans. Pay each vendor securely via Stripe.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Features Section */}
          <Card className="bg-muted/50">
            <CardContent className="py-6">
              <h3 className="font-semibold mb-4 text-center">What You'll See in Your Portal</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Open Invoices</p>
                    <p className="text-xs text-muted-foreground">View all unpaid invoices with amounts, due dates, and overdue alerts</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Payment Plans</p>
                    <p className="text-xs text-muted-foreground">Track your installment schedules and remaining balances</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Multiple Vendors</p>
                    <p className="text-xs text-muted-foreground">If you work with multiple companies, see each one's branded section</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ExternalLink className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Secure Payments</p>
                    <p className="text-xs text-muted-foreground">Pay directly via each vendor's secure Stripe payment link</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="mt-8 text-center text-xs text-muted-foreground">
            <p>Your information is secure. Links expire after 24 hours for your protection.</p>
            <p className="mt-1">Powered by Recouply.ai</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying your access...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.href = "/debtor-portal"}>
              Request New Link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Selected plan detail view
  if (selectedPlan) {
    const paidInstallments = selectedPlan.installments.filter(i => i.status === "paid");
    const totalPaid = paidInstallments.reduce((sum, i) => sum + i.amount, 0);
    const remainingBalance = selectedPlan.total_amount - totalPaid;
    const primaryColor = selectedPlan.branding?.primary_color || "#1e3a5f";
    
    // Dual approval status for detail view
    const needsDebtorApprovalDetail = selectedPlan.requires_dual_approval && 
      !selectedPlan.debtor_approved_at && 
      (selectedPlan.status === "proposed" || selectedPlan.status === "draft");
    const hasDebtorApprovalDetail = !!selectedPlan.debtor_approved_at;
    const hasAdminApprovalDetail = !!selectedPlan.admin_approved_at;

    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="w-full py-6 px-4" style={{ backgroundColor: primaryColor }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-4">
              {selectedPlan.branding?.logo_url ? (
                <img 
                  src={selectedPlan.branding.logo_url} 
                  alt={selectedPlan.branding.business_name} 
                  className="h-10 w-auto bg-white rounded p-1"
                />
              ) : (
                <Building2 className="h-8 w-8 text-white" />
              )}
              <div>
                <h1 className="text-xl font-bold text-white">
                  {selectedPlan.branding?.business_name || "Payment Plan"}
                </h1>
                {selectedPlan.debtor && (
                  <p className="text-white/80 text-sm">
                    Account: {selectedPlan.debtor.company_name}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
          <Button
            variant="ghost"
            onClick={() => setSelectedPlan(null)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to All Plans
          </Button>

          {/* Plan Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    {selectedPlan.plan_name || "Payment Plan"}
                  </CardTitle>
                  <CardDescription>
                    {selectedPlan.number_of_installments} {selectedPlan.frequency} payments
                  </CardDescription>
                </div>
                <Badge className={statusColors[selectedPlan.status] || "bg-gray-100"}>
                  {selectedPlan.status.charAt(0).toUpperCase() + selectedPlan.status.slice(1)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">
                    ${selectedPlan.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-sm text-green-700">Amount Paid</p>
                  <p className="text-2xl font-bold text-green-700">
                    ${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-green-600">
                    {paidInstallments.length} of {selectedPlan.installments.length} payments
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <p className="text-sm text-blue-700">Remaining Balance</p>
                  <p className="text-2xl font-bold text-blue-700">
                    ${remainingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dual Approval Status & Action */}
          {selectedPlan.requires_dual_approval && (
            <Card className={needsDebtorApprovalDetail ? "border-orange-300 bg-orange-50" : "bg-muted/30"}>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      Plan Approval Status
                    </h3>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-full ${hasDebtorApprovalDetail ? 'bg-green-100' : 'bg-muted'}`}>
                          <UserCheck className={`h-4 w-4 ${hasDebtorApprovalDetail ? 'text-green-600' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Your Approval</p>
                          <p className={`text-xs ${hasDebtorApprovalDetail ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {hasDebtorApprovalDetail ? 'Approved' : 'Pending'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-full ${hasAdminApprovalDetail ? 'bg-green-100' : 'bg-muted'}`}>
                          <ShieldCheck className={`h-4 w-4 ${hasAdminApprovalDetail ? 'text-green-600' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Vendor Approval</p>
                          <p className={`text-xs ${hasAdminApprovalDetail ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {hasAdminApprovalDetail ? 'Approved' : 'Pending'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {needsDebtorApprovalDetail && (
                      <p className="text-sm text-orange-700">
                        This payment plan requires your approval before it can be activated.
                      </p>
                    )}
                  </div>
                  
                  {needsDebtorApprovalDetail && (
                    <Button 
                      size="lg" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={(e) => handleApprovePlan(selectedPlan.id, e)}
                      disabled={approvingPlanId === selectedPlan.id}
                    >
                      {approvingPlanId === selectedPlan.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve This Plan
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Payment Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPlan.installments.map((inst) => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">{inst.installment_number}</TableCell>
                      <TableCell>{format(new Date(inst.due_date), "MMMM d, yyyy")}</TableCell>
                      <TableCell className="font-mono">
                        ${inst.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {installmentStatusIcons[inst.status]}
                          <span className="capitalize">{inst.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {inst.paid_at ? format(new Date(inst.paid_at), "MMM d, yyyy") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment Link */}
          {selectedPlan.branding?.stripe_payment_link && remainingBalance > 0 && (
            <Card className="border-primary">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">Ready to make a payment?</h3>
                    <p className="text-sm text-muted-foreground">
                      Click the button to securely pay your next installment.
                    </p>
                  </div>
                  <Button asChild size="lg">
                    <a href={selectedPlan.branding.stripe_payment_link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Make a Payment
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Selected invoice detail view
  if (selectedInvoice) {
    const primaryColor = selectedInvoice.branding?.primary_color || "#1e3a5f";
    const isOverdue = selectedInvoice.days_past_due > 0;

    return (
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="w-full py-6 px-4" style={{ backgroundColor: primaryColor }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-4">
              {selectedInvoice.branding?.logo_url ? (
                <img 
                  src={selectedInvoice.branding.logo_url} 
                  alt={selectedInvoice.branding.business_name} 
                  className="h-10 w-auto bg-white rounded p-1"
                />
              ) : (
                <Building2 className="h-8 w-8 text-white" />
              )}
              <div>
                <h1 className="text-xl font-bold text-white">
                  {selectedInvoice.branding?.business_name || "Invoice Details"}
                </h1>
                {selectedInvoice.debtor && (
                  <p className="text-white/80 text-sm">
                    Account: {selectedInvoice.debtor.company_name}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
          <Button
            variant="ghost"
            onClick={() => setSelectedInvoice(null)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Overview
          </Button>

          {/* Invoice Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Invoice #{selectedInvoice.invoice_number}
                  </CardTitle>
                  {selectedInvoice.product_description && (
                    <CardDescription>{selectedInvoice.product_description}</CardDescription>
                  )}
                </div>
                <Badge className={isOverdue ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}>
                  {isOverdue ? `${selectedInvoice.days_past_due} days overdue` : selectedInvoice.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">Invoice Amount</p>
                  <p className="text-2xl font-bold">
                    ${selectedInvoice.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-sm text-green-700">Amount Paid</p>
                  <p className="text-2xl font-bold text-green-700">
                    ${(selectedInvoice.amount_paid || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`p-4 rounded-lg text-center ${isOverdue ? 'bg-red-50' : 'bg-blue-50'}`}>
                  <p className={`text-sm ${isOverdue ? 'text-red-700' : 'text-blue-700'}`}>Balance Due</p>
                  <p className={`text-2xl font-bold ${isOverdue ? 'text-red-700' : 'text-blue-700'}`}>
                    ${selectedInvoice.balance_due.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(selectedInvoice.due_date), "MMMM d, yyyy")}
                  </p>
                </div>
                {selectedInvoice.debtor && (
                  <div>
                    <p className="text-sm text-muted-foreground">Reference</p>
                    <p className="font-medium">{selectedInvoice.debtor.reference_id}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Link */}
          {selectedInvoice.branding?.stripe_payment_link && selectedInvoice.balance_due > 0 && (
            <Card className="border-primary">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">Ready to pay this invoice?</h3>
                    <p className="text-sm text-muted-foreground">
                      Click the button to securely pay your balance of ${selectedInvoice.balance_due.toLocaleString("en-US", { minimumFractionDigits: 2 })}.
                    </p>
                  </div>
                  <Button asChild size="lg">
                    <a href={selectedInvoice.branding.stripe_payment_link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Pay Now
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Main portal view - Group by vendor for multi-vendor support
  const hasMultipleVendors = vendors.length > 1;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="w-full py-6 px-4 bg-primary">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Payment Portal</h1>
              <p className="text-white/80 text-sm">{verifiedEmail}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
        
        {/* Multi-vendor notice */}
        {hasMultipleVendors && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Multiple Vendor Accounts</p>
                  <p className="text-sm text-blue-700">
                    Your email is associated with {vendors.length} different vendors. Each vendor's invoices and payment plans are shown below with their own branding and payment links.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Global Summary */}
        {(paymentPlans.length > 0 || invoices.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-slate-100">
                    <Building2 className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vendors</p>
                    <p className="text-2xl font-bold">{vendors.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-purple-500 text-white">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-purple-700">Payment Plans</p>
                    <p className="text-2xl font-bold text-purple-900">{paymentPlans.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-blue-500 text-white">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-blue-700">Open Invoices</p>
                    <p className="text-2xl font-bold text-blue-900">
                      ${invoices.reduce((sum, inv) => sum + inv.balance_due, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* No Accounts Found State */}
        {vendors.length === 0 && (
          <Card className="max-w-lg mx-auto">
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No Accounts Found</h2>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                We couldn't find any open invoices or payment plans associated with <strong>{verifiedEmail}</strong>.
              </p>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>This could mean:</p>
                <ul className="list-disc list-inside text-left max-w-xs mx-auto space-y-1">
                  <li>All invoices have been paid in full</li>
                  <li>Your email isn't linked to any active accounts</li>
                  <li>The vendor uses a different email on file</li>
                </ul>
              </div>
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  Need help? Contact your vendor directly or try a different email address.
                </p>
                <Button variant="outline" onClick={() => window.location.href = "/debtor-portal"}>
                  Try Different Email
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vendor Sections */}
        {vendors.map((vendor, vendorIndex) => {
          const vendorTotalInvoiceBalance = vendor.invoices.reduce((sum, inv) => sum + inv.balance_due, 0);
          const vendorOverdueInvoices = vendor.invoices.filter(inv => inv.days_past_due > 0);
          const vendorPlanBalance = vendor.paymentPlans.reduce((sum, plan) => {
            const totalPaid = plan.installments.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
            return sum + (plan.total_amount - totalPaid);
          }, 0);

          return (
            <Card key={vendorIndex} className="overflow-hidden">
              {/* Vendor Header */}
              <div 
                className="py-4 px-6 flex items-center gap-4"
                style={{ backgroundColor: vendor.primaryColor || "#1e3a5f" }}
              >
                {vendor.logoUrl ? (
                  <img 
                    src={vendor.logoUrl} 
                    alt={vendor.businessName} 
                    className="h-10 w-auto bg-white rounded p-1"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-white/20 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white">{vendor.businessName}</h2>
                  <p className="text-white/80 text-sm">
                    {vendor.paymentPlans.length} plan{vendor.paymentPlans.length !== 1 ? 's' : ''} • {vendor.invoices.length} invoice{vendor.invoices.length !== 1 ? 's' : ''}
                  </p>
                  {vendor.arPageUrl && (
                    <a 
                      href={vendor.arPageUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-white/90 text-xs hover:text-white hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      <FileText className="h-3 w-3" />
                      View AR Information Page
                    </a>
                  )}
                </div>
                {vendor.stripePaymentLink && (vendorTotalInvoiceBalance > 0 || vendorPlanBalance > 0) && (
                  <Button asChild variant="secondary" size="sm">
                    <a href={vendor.stripePaymentLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Pay Now
                    </a>
                  </Button>
                )}
              </div>

              <CardContent className="pt-6 space-y-6">
                {/* Vendor Summary */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {vendor.paymentPlans.length > 0 && (
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-700 mb-1">Payment Plan Balance</p>
                      <p className="text-xl font-bold text-purple-900">
                        ${vendorPlanBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  {vendor.invoices.length > 0 && (
                    <div className={`p-4 rounded-lg ${vendorOverdueInvoices.length > 0 ? 'bg-red-50' : 'bg-blue-50'}`}>
                      <p className={`text-sm mb-1 ${vendorOverdueInvoices.length > 0 ? 'text-red-700' : 'text-blue-700'}`}>
                        Invoice Balance
                        {vendorOverdueInvoices.length > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {vendorOverdueInvoices.length} overdue
                          </span>
                        )}
                      </p>
                      <p className={`text-xl font-bold ${vendorOverdueInvoices.length > 0 ? 'text-red-900' : 'text-blue-900'}`}>
                        ${vendorTotalInvoiceBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Payment Plans */}
                {vendor.paymentPlans.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-purple-600" />
                      Payment Plans
                    </h3>
                    <div className="space-y-3">
                      {vendor.paymentPlans.map((plan) => {
                        const paidCount = plan.installments.filter(i => i.status === "paid").length;
                        const totalPaid = plan.installments
                          .filter(i => i.status === "paid")
                          .reduce((sum, i) => sum + i.amount, 0);
                        const remainingBalance = plan.total_amount - totalPaid;
                        
                        // Check if debtor approval is needed
                        // Show approve button if:
                        // 1. Plan is proposed/draft AND debtor hasn't approved yet (regardless of dual_approval flag)
                        // 2. For dual approval: both approvals needed
                        // 3. For single approval: just debtor approval activates the plan
                        const isPendingPlan = plan.status === "proposed" || plan.status === "draft";
                        const needsDebtorApproval = isPendingPlan && !plan.debtor_approved_at;
                        const hasDebtorApproval = !!plan.debtor_approved_at;
                        const hasAdminApproval = !!plan.admin_approved_at;
                        const isDualApproval = plan.requires_dual_approval === true;

                        return (
                          <div 
                            key={plan.id} 
                            className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-l-4 ${needsDebtorApproval ? 'border-l-orange-500 bg-orange-50/50' : hasDebtorApproval && isPendingPlan && isDualApproval && !hasAdminApproval ? 'border-l-blue-500 bg-blue-50/50' : 'border-l-purple-500'}`}
                            onClick={() => setSelectedPlan(plan)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">
                                    {plan.plan_name || "Payment Plan"}
                                  </span>
                                  <Badge className={statusColors[plan.status] || "bg-gray-100"}>
                                    {plan.status}
                                  </Badge>
                                  {needsDebtorApproval && (
                                    <Badge className="bg-orange-100 text-orange-800">
                                      Needs Your Approval
                                    </Badge>
                                  )}
                                  {hasDebtorApproval && isPendingPlan && isDualApproval && !hasAdminApproval && (
                                    <Badge className="bg-blue-100 text-blue-800">
                                      Awaiting Vendor Approval
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {plan.number_of_installments} {plan.frequency} payments • 
                                  Started {format(new Date(plan.start_date), "MMM d, yyyy")}
                                </p>
                                
                                {/* Approval Status - show for pending plans */}
                                {isPendingPlan && (
                                  <div className="flex items-center gap-3 mt-2 text-xs">
                                    <span className={`flex items-center gap-1 ${hasDebtorApproval ? 'text-green-600' : 'text-muted-foreground'}`}>
                                      <UserCheck className="h-3 w-3" />
                                      You: {hasDebtorApproval ? 'Approved' : 'Pending'}
                                    </span>
                                    {isDualApproval && (
                                      <span className={`flex items-center gap-1 ${hasAdminApproval ? 'text-green-600' : 'text-muted-foreground'}`}>
                                        <ShieldCheck className="h-3 w-3" />
                                        Vendor: {hasAdminApproval ? 'Approved' : 'Pending'}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="text-right space-y-2">
                                <div>
                                  <p className="text-sm text-muted-foreground">Remaining</p>
                                  <p className="text-lg font-bold" style={{ color: vendor.primaryColor }}>
                                    ${remainingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {paidCount}/{plan.installments.length} paid
                                  </p>
                                </div>
                                
                                {/* Approve Button */}
                                {needsDebtorApproval && (
                                  <Button 
                                    size="sm" 
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={(e) => handleApprovePlan(plan.id, e)}
                                    disabled={approvingPlanId === plan.id}
                                  >
                                    {approvingPlanId === plan.id ? (
                                      <>
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        Approving...
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Approve Plan
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Invoices */}
                {vendor.invoices.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      Open Invoices
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendor.invoices.map((invoice) => {
                          const isOverdue = invoice.days_past_due > 0;
                          
                          return (
                            <TableRow 
                              key={invoice.id} 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedInvoice(invoice)}
                            >
                              <TableCell className="font-medium">#{invoice.invoice_number}</TableCell>
                              <TableCell>{format(new Date(invoice.due_date), "MMM d, yyyy")}</TableCell>
                              <TableCell>
                                {isOverdue ? (
                                  <Badge className="bg-red-100 text-red-800">
                                    {invoice.days_past_due}d overdue
                                  </Badge>
                                ) : (
                                  <Badge className="bg-yellow-100 text-yellow-800">
                                    {invoice.status}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                ${invoice.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right font-mono text-green-600">
                                ${(invoice.amount_paid || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className={`text-right font-mono font-bold ${isOverdue ? 'text-red-600' : ''}`}>
                                ${invoice.balance_due.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm">
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Empty State */}
        {paymentPlans.length === 0 && invoices.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">All Caught Up!</h3>
              <p className="text-muted-foreground">
                You don't have any open invoices or active payment plans at this time.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground border-t pt-6">
          <p>If you have questions, please contact your account manager directly.</p>
          <p className="mt-1">Powered by Recouply.ai</p>
        </div>
      </div>
    </div>
  );
}
