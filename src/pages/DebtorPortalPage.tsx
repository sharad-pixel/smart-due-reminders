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
  CreditCard
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
  const token = searchParams.get("token");
  
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Verify token on load
  useEffect(() => {
    if (token) {
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

  // Email entry form (no token)
  if (!token && !verifiedEmail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Payment Plan Portal</CardTitle>
            <CardDescription>
              Enter your email to access your payment plans
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkSent ? (
              <div className="text-center py-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">Check Your Email</h3>
                <p className="text-muted-foreground text-sm">
                  If you have active payment plans, you'll receive a secure link to access them.
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
                    "Get Access Link"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
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

  // Plans list view
  const primaryColor = paymentPlans[0]?.branding?.primary_color || "#1e3a5f";
  const businessName = paymentPlans[0]?.branding?.business_name || "Payment Portal";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="w-full py-6 px-4" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {paymentPlans[0]?.branding?.logo_url ? (
              <img 
                src={paymentPlans[0].branding.logo_url} 
                alt={businessName} 
                className="h-10 w-auto bg-white rounded p-1"
              />
            ) : (
              <Building2 className="h-8 w-8 text-white" />
            )}
            <div>
              <h1 className="text-xl font-bold text-white">{businessName}</h1>
              <p className="text-white/80 text-sm">{verifiedEmail}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto py-8 px-4">
        <h2 className="text-2xl font-bold mb-6">Your Active Payment Plans</h2>
        
        {paymentPlans.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Active Payment Plans</h3>
              <p className="text-muted-foreground">
                You don't have any active payment plans at this time.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {paymentPlans.map((plan) => {
              const paidCount = plan.installments.filter(i => i.status === "paid").length;
              const totalPaid = plan.installments
                .filter(i => i.status === "paid")
                .reduce((sum, i) => sum + i.amount, 0);
              const remainingBalance = plan.total_amount - totalPaid;

              return (
                <Card 
                  key={plan.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedPlan(plan)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            {plan.plan_name || "Payment Plan"}
                          </h3>
                          <Badge className={statusColors[plan.status] || "bg-gray-100"}>
                            {plan.status}
                          </Badge>
                        </div>
                        {plan.debtor && (
                          <p className="text-sm text-muted-foreground">
                            {plan.debtor.company_name}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {plan.number_of_installments} {plan.frequency} payments • 
                          Started {format(new Date(plan.start_date), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Remaining</p>
                        <p className="text-xl font-bold text-primary">
                          ${remainingBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {paidCount}/{plan.installments.length} paid
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground border-t pt-6">
          <p>If you have questions, please contact your account manager.</p>
          <p className="mt-1">Powered by Recouply.ai</p>
        </div>
      </div>
    </div>
  );
}
