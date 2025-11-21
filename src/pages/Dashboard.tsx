import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DebtorsList from "@/components/DebtorsList";
import InvoicesList from "@/components/InvoicesList";
import MessageDrafter from "@/components/MessageDrafter";
import Layout from "@/components/Layout";
import { User } from "@supabase/supabase-js";
import { DollarSign, Users, FileText, Send } from "lucide-react";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOwed: 0,
    activeDebtors: 0,
    overdueInvoices: 0,
    messagesSent: 0,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchStats();
      }
      setLoading(false);
    });
  }, []);

  const fetchStats = async () => {
    try {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("amount, status, due_date");
      
      const { data: debtors } = await supabase
        .from("debtors")
        .select("id");
      
      const { data: messages } = await supabase
        .from("outreach_logs")
        .select("id")
        .eq("status", "sent");

      const totalOwed = invoices?.reduce((sum, inv) => {
        if (inv.status === "Open" || inv.status === "InPaymentPlan") {
          return sum + Number(inv.amount);
        }
        return sum;
      }, 0) || 0;

      const overdueCount = invoices?.filter(inv => {
        if (inv.status !== "Open") return false;
        const dueDate = new Date(inv.due_date);
        return dueDate < new Date();
      }).length || 0;

      setStats({
        totalOwed,
        activeDebtors: debtors?.length || 0,
        overdueInvoices: overdueCount,
        messagesSent: messages?.length || 0,
      });
    } catch (error: any) {
      console.error("Error fetching stats:", error);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-primary">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome back! Here's your collection overview.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Owed</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalOwed.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Outstanding invoices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Debtors</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeDebtors}</div>
              <p className="text-xs text-muted-foreground">Customers with invoices</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.overdueInvoices}</div>
              <p className="text-xs text-muted-foreground">Invoices past due</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.messagesSent}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="debtors" className="space-y-4">
          <TabsList>
            <TabsTrigger value="debtors">Debtors</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="messages">AI Messages</TabsTrigger>
          </TabsList>

          <TabsContent value="debtors">
            <DebtorsList onUpdate={fetchStats} />
          </TabsContent>

          <TabsContent value="invoices">
            <InvoicesList onUpdate={fetchStats} />
          </TabsContent>

          <TabsContent value="messages">
            <MessageDrafter />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Dashboard;
