import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Upload, Building2, User, Mail, Phone, MapPin, Clock, DollarSign, TrendingUp, FileBarChart, MoreHorizontal, ExternalLink, CreditCard, LayoutGrid, List } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AIInsightsCard } from "@/components/AIInsightsCard";



interface Debtor {
  id: string;
  reference_id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string | null;
  type: "B2B" | "B2C" | null;
  current_balance: number | null;
  total_open_balance: number | null;
  external_customer_id: string | null;
  crm_account_id_external: string | null;
  open_invoices_count: number | null;
  max_days_past_due: number | null;
  payment_score: number | null;
  avg_days_to_pay: number | null;
  primary_contact_name: string | null;
  ar_contact_name: string | null;
  ar_contact_email: string | null;
  city: string | null;
  state: string | null;
  credit_limit: number | null;
  payment_terms_default: string | null;
  created_at: string | null;
}

const Debtors = () => {
  const navigate = useNavigate();
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [filteredDebtors, setFilteredDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [formData, setFormData] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    type: "B2C" as "B2B" | "B2C",
    address: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
    notes: "",
    external_customer_id: "",
    crm_account_id_external: "",
  });

  useEffect(() => {
    fetchDebtors();
  }, []);

  useEffect(() => {
    filterDebtors();
  }, [debtors, searchTerm, typeFilter]);

  const fetchDebtors = async () => {
    try {
      const { data, error } = await supabase
        .from("debtors")
        .select(`
          id, reference_id, name, company_name, email, phone, type,
          current_balance, total_open_balance, external_customer_id,
          crm_account_id_external, open_invoices_count, max_days_past_due,
          payment_score, avg_days_to_pay, primary_contact_name,
          ar_contact_name, ar_contact_email, city, state,
          credit_limit, payment_terms_default, created_at
        `)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDebtors(data || []);
    } catch (error: any) {
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  const filterDebtors = () => {
    let filtered = [...debtors];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.reference_id.toLowerCase().includes(term) ||
          d.name.toLowerCase().includes(term) ||
          d.company_name.toLowerCase().includes(term) ||
          d.email.toLowerCase().includes(term)
      );
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((d) => d.type === typeFilter);
    }

    setFilteredDebtors(filtered);
  };


  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("debtors").insert({
        ...formData,
        name: formData.company_name,
        user_id: user.id,
      } as any);

      if (error) throw error;
      toast.success("Account created successfully");
      setIsCreateOpen(false);
      setFormData({
        company_name: "",
        contact_name: "",
        email: "",
        phone: "",
        type: "B2C",
        address: "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        postal_code: "",
        country: "",
        notes: "",
        external_customer_id: "",
        crm_account_id_external: "",
      });
      fetchDebtors();
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">Accounts</h1>
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Manage your customer accounts</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/data-center')}>
              <Upload className="h-4 w-4 mr-2" />
              Data Center
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Account</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company_name">Company Name *</Label>
                      <Input
                        id="company_name"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact_name">Contact Name *</Label>
                      <Input
                        id="contact_name"
                        value={formData.contact_name}
                        onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Type *</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value: "B2B" | "B2C") =>
                          setFormData({ ...formData, type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="B2B">B2B</SelectItem>
                          <SelectItem value="B2C">B2C</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address_line1">Address Line 1</Label>
                    <Input
                      id="address_line1"
                      value={formData.address_line1}
                      onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                      placeholder="Street address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="address_line2">Address Line 2</Label>
                      <Input
                        id="address_line2"
                        value={formData.address_line2}
                        onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                        placeholder="Apt, Suite, etc."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Postal Code</Label>
                      <Input
                        id="postal_code"
                        value={formData.postal_code}
                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="external_customer_id">Account ID (Billing System)</Label>
                      <Input
                        id="external_customer_id"
                        value={formData.external_customer_id}
                        onChange={(e) => setFormData({ ...formData, external_customer_id: e.target.value })}
                        placeholder="e.g., QB_123456"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="crm_account_id_external">CRM ID</Label>
                      <Input
                        id="crm_account_id_external"
                        value={formData.crm_account_id_external}
                        onChange={(e) => setFormData({ ...formData, crm_account_id_external: e.target.value })}
                        placeholder="e.g., SF_001234"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Account</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <AIInsightsCard scope="accounts" compact className="mb-4" />


        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Recouply ID, name, company, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="B2B">B2B</SelectItem>
                  <SelectItem value="B2C">B2C</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === "card" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("card")}
                  className="rounded-none"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="rounded-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredDebtors.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {debtors.length === 0
                    ? "No accounts yet. Create your first account to get started."
                    : "No accounts match your search criteria."}
                </p>
              </div>
            ) : viewMode === "card" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredDebtors.map((debtor) => (
                  <div
                    key={debtor.id}
                    className="group border rounded-lg p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer bg-card"
                    onClick={() => navigate(`/debtors/${debtor.id}`)}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          debtor.type === "B2B" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                        }`}>
                          {debtor.type === "B2B" ? <Building2 className="h-5 w-5" /> : <User className="h-5 w-5" />}
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {debtor.company_name || debtor.name}
                          </h3>
                          <p className="text-xs text-muted-foreground font-mono">{debtor.reference_id}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        debtor.type === "B2B" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                      }`}>
                        {debtor.type || "N/A"}
                      </span>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-1.5 mb-3 text-sm">
                      {debtor.primary_contact_name && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{debtor.primary_contact_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{debtor.email}</span>
                      </div>
                      {debtor.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{debtor.phone}</span>
                        </div>
                      )}
                      {(debtor.city || debtor.state) && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span>{[debtor.city, debtor.state].filter(Boolean).join(", ")}</span>
                        </div>
                      )}
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-muted/50 rounded-md p-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                          <DollarSign className="h-3 w-3" />
                          <span>Balance</span>
                        </div>
                        <p className="font-semibold text-sm tabular-nums">
                          ${(debtor.total_open_balance || debtor.current_balance || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                          <FileBarChart className="h-3 w-3" />
                          <span>Open Invoices</span>
                        </div>
                        <p className="font-semibold text-sm tabular-nums">
                          {debtor.open_invoices_count || 0}
                        </p>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                          <Clock className="h-3 w-3" />
                          <span>Max DPD</span>
                        </div>
                        <p className={`font-semibold text-sm tabular-nums ${
                          (debtor.max_days_past_due || 0) > 90 ? "text-destructive" :
                          (debtor.max_days_past_due || 0) > 30 ? "text-orange-500" : "text-foreground"
                        }`}>
                          {debtor.max_days_past_due || 0} days
                        </p>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                          <TrendingUp className="h-3 w-3" />
                          <span>Pay Score</span>
                        </div>
                        <p className={`font-semibold text-sm tabular-nums ${
                          (debtor.payment_score || 50) >= 70 ? "text-green-600" :
                          (debtor.payment_score || 50) >= 40 ? "text-orange-500" : "text-destructive"
                        }`}>
                          {debtor.payment_score || 50}/100
                        </p>
                      </div>
                    </div>

                    {/* Footer with IDs and Terms */}
                    <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        {debtor.external_customer_id && (
                          <div className="flex items-center gap-1" title="Billing System ID">
                            <ExternalLink className="h-3 w-3" />
                            <span className="font-mono">{debtor.external_customer_id}</span>
                          </div>
                        )}
                        {debtor.payment_terms_default && (
                          <div className="flex items-center gap-1" title="Payment Terms">
                            <CreditCard className="h-3 w-3" />
                            <span>{debtor.payment_terms_default}</span>
                          </div>
                        )}
                      </div>
                      {debtor.avg_days_to_pay && (
                        <span title="Avg Days to Pay">~{Math.round(debtor.avg_days_to_pay)}d avg</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-center">Invoices</TableHead>
                      <TableHead className="text-center">Max DPD</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                      <TableHead>External ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDebtors.map((debtor) => (
                      <TableRow
                        key={debtor.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/debtors/${debtor.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              debtor.type === "B2B" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                            }`}>
                              {debtor.type === "B2B" ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{debtor.company_name || debtor.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{debtor.reference_id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="truncate max-w-[180px]">{debtor.email}</p>
                            {debtor.phone && <p className="text-xs text-muted-foreground">{debtor.phone}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            debtor.type === "B2B" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                          }`}>
                            {debtor.type || "N/A"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          ${(debtor.total_open_balance || debtor.current_balance || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {debtor.open_invoices_count || 0}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-medium tabular-nums ${
                            (debtor.max_days_past_due || 0) > 90 ? "text-destructive" :
                            (debtor.max_days_past_due || 0) > 30 ? "text-orange-500" : ""
                          }`}>
                            {debtor.max_days_past_due || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-medium tabular-nums ${
                            (debtor.payment_score || 50) >= 70 ? "text-green-600" :
                            (debtor.payment_score || 50) >= 40 ? "text-orange-500" : "text-destructive"
                          }`}>
                            {debtor.payment_score || 50}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-muted-foreground">
                            {debtor.external_customer_id || "-"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
};

export default Debtors;
