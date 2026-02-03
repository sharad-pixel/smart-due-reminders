import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { DollarSign, Calendar, CheckCircle, Clock, XCircle, Building2, FileText, ExternalLink } from "lucide-react";

interface PaymentPlan {
  id: string;
  plan_name: string | null;
  total_amount: number;
  number_of_installments: number;
  installment_amount: number;
  frequency: string;
  start_date: string;
  status: string;
  proposed_at: string | null;
  accepted_at: string | null;
  notes: string | null;
  created_at: string;
}

interface Installment {
  id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: string;
  paid_at: string | null;
}

interface DebtorInfo {
  company_name: string;
  reference_id: string;
}

interface BrandingInfo {
  business_name: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  stripe_payment_link: string | null;
  footer_disclaimer: string | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  proposed: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  active: "bg-emerald-100 text-emerald-800",
  completed: "bg-green-200 text-green-900",
  cancelled: "bg-red-100 text-red-800",
  defaulted: "bg-red-200 text-red-900",
};

const installmentStatusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-yellow-600" />,
  paid: <CheckCircle className="h-4 w-4 text-green-600" />,
  overdue: <XCircle className="h-4 w-4 text-red-600" />,
  cancelled: <XCircle className="h-4 w-4 text-gray-400" />,
};

export default function PublicPaymentPlanPage() {
  const { token } = useParams<{ token: string }>();
  const [plan, setPlan] = useState<PaymentPlan | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [debtor, setDebtor] = useState<DebtorInfo | null>(null);
  const [branding, setBranding] = useState<BrandingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchPaymentPlan();
    }
  }, [token]);

  const fetchPaymentPlan = async () => {
    try {
      // Fetch payment plan by public token
      const { data: planData, error: planError } = await supabase
        .from("payment_plans")
        .select(`
          *,
          debtors:debtor_id (
            company_name,
            reference_id,
            user_id
          )
        `)
        .eq("public_token", token)
        .single();

      if (planError || !planData) {
        setError("Payment plan not found or has expired.");
        setLoading(false);
        return;
      }

      setPlan(planData);
      setDebtor(planData.debtors);

      // Fetch installments
      const { data: installmentsData, error: installmentsError } = await supabase
        .from("payment_plan_installments")
        .select("*")
        .eq("payment_plan_id", planData.id)
        .order("installment_number");

      if (!installmentsError) {
        setInstallments(installmentsData || []);
      }

      // Fetch branding from the plan owner
      if (planData.debtors?.user_id) {
        const { data: brandingData } = await supabase
          .from("branding_settings")
          .select("business_name, logo_url, primary_color, accent_color, stripe_payment_link, footer_disclaimer")
          .eq("user_id", planData.debtors.user_id)
          .single();

        if (brandingData) {
          setBranding(brandingData);
        }
      }
    } catch (err: any) {
      console.error("Error fetching payment plan:", err);
      setError("An error occurred while loading the payment plan.");
    } finally {
      setLoading(false);
    }
  };

  const paidCount = installments.filter((i) => i.status === "paid").length;
  const totalPaid = installments
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const remainingBalance = (plan?.total_amount || 0) - totalPaid;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Payment Plan Not Found</h2>
            <p className="text-muted-foreground">
              {error || "This payment plan may have expired or been removed."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryColor = branding?.primary_color || "#1e3a5f";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div 
        className="w-full py-6 px-4"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {branding?.logo_url ? (
              <img 
                src={branding.logo_url} 
                alt={branding.business_name} 
                className="h-10 w-auto bg-white rounded p-1"
              />
            ) : (
              <Building2 className="h-8 w-8 text-white" />
            )}
            <div>
              <h1 className="text-xl font-bold text-white">
                {branding?.business_name || "Payment Plan"}
              </h1>
              {debtor && (
                <p className="text-white/80 text-sm">
                  Account: {debtor.company_name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        {/* Plan Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  {plan.plan_name || "Payment Plan"}
                </CardTitle>
                <CardDescription>
                  {plan.number_of_installments} {plan.frequency} payments
                </CardDescription>
              </div>
              <Badge className={statusColors[plan.status] || statusColors.draft}>
                {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">
                  ${plan.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-sm text-green-700">Amount Paid</p>
                <p className="text-2xl font-bold text-green-700">
                  ${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-green-600">{paidCount} of {installments.length} payments</p>
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
                {installments.map((inst) => (
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
        {branding?.stripe_payment_link && remainingBalance > 0 && (
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
                  <a href={branding.stripe_payment_link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Make a Payment
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {plan.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{plan.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 border-t">
          {branding?.footer_disclaimer && (
            <p className="mb-2">{branding.footer_disclaimer}</p>
          )}
          <p>
            This payment plan was proposed on {plan.proposed_at ? format(new Date(plan.proposed_at), "MMMM d, yyyy") : format(new Date(plan.created_at), "MMMM d, yyyy")}.
          </p>
          <p className="mt-1">
            If you have questions, please reply to the email you received or contact your account manager.
          </p>
        </div>
      </div>
    </div>
  );
}
