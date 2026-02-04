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
  CreditCard, FileText, AlertTriangle
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
  } | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  amount_paid: number | null;
  due_date: string;
  status: string;
  description: string | null;
  days_past_due: number;
  balance_due: number;
  debtor: {
    company_name: string;
    reference_id: string;
  } | null;
  branding: {
    business_name: string;
    logo_url: string | null;
    primary_color: string | null;
    stripe_payment_link: string | null;
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

  // Group data by vendor (branding business_name)
  const groupByVendor = () => {
    const vendorMap: Record<string, {
      businessName: string;
      logoUrl: string | null;
      primaryColor: string | null;
      stripePaymentLink: string | null;
      paymentPlans: PaymentPlan[];
      invoices: Invoice[];
    }> = {};

    paymentPlans.forEach(plan => {
      const vendorKey = plan.branding?.business_name || "Unknown Vendor";
      if (!vendorMap[vendorKey]) {
        vendorMap[vendorKey] = {
          businessName: plan.branding?.business_name || "Unknown Vendor",
          logoUrl: plan.branding?.logo_url || null,
          primaryColor: plan.branding?.primary_color || "#1e3a5f",
          stripePaymentLink: plan.branding?.stripe_payment_link || null,
          paymentPlans: [],
          invoices: [],
        };
      }
      vendorMap[vendorKey].paymentPlans.push(plan);
    });

    invoices.forEach(invoice => {
      const vendorKey = invoice.branding?.business_name || "Unknown Vendor";
      if (!vendorMap[vendorKey]) {
        vendorMap[vendorKey] = {
          businessName: invoice.branding?.business_name || "Unknown Vendor",
          logoUrl: invoice.branding?.logo_url || null,
          primaryColor: invoice.branding?.primary_color || "#1e3a5f",
          stripePaymentLink: invoice.branding?.stripe_payment_link || null,
          paymentPlans: [],
          invoices: [],
        };
      }
      vendorMap[vendorKey].invoices.push(invoice);
    });

    return Object.values(vendorMap);
  };

  const vendors = groupByVendor();

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
                  {selectedInvoice.description && (
                    <CardDescription>{selectedInvoice.description}</CardDescription>
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

                        return (
                          <div 
                            key={plan.id} 
                            className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-l-4 border-l-purple-500"
                            onClick={() => setSelectedPlan(plan)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {plan.plan_name || "Payment Plan"}
                                  </span>
                                  <Badge className={statusColors[plan.status] || "bg-gray-100"}>
                                    {plan.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {plan.number_of_installments} {plan.frequency} payments • 
                                  Started {format(new Date(plan.start_date), "MMM d, yyyy")}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">Remaining</p>
                                <p className="text-lg font-bold" style={{ color: vendor.primaryColor }}>
                                  ${remainingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {paidCount}/{plan.installments.length} paid
                                </p>
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
