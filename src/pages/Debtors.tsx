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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Search, Upload, Building2, User, Mail, Phone, MapPin, Clock, DollarSign, TrendingUp, FileBarChart, MoreHorizontal, ExternalLink, CreditCard, LayoutGrid, List, Trash2, UserPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SortableTableHead, useSorting } from "@/components/ui/sortable-table-head";

import { AIInsightsCard } from "@/components/AIInsightsCard";

interface Contact {
  name: string;
  title: string;
  email: string;
  phone: string;
  outreach_enabled: boolean;
}

interface DebtorContact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  outreach_enabled: boolean;
}

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
  contacts?: DebtorContact[];
}

const ROWS_PER_PAGE = 50;

const Debtors = () => {
  const navigate = useNavigate();
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [filteredDebtors, setFilteredDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "table">("table");
  const [currentPage, setCurrentPage] = useState(1);
  const [contacts, setContacts] = useState<Contact[]>([
    { name: "", title: "", email: "", phone: "", outreach_enabled: true }
  ]);
  const [formData, setFormData] = useState({
    company_name: "",
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
    industry: "",
  });

  useEffect(() => {
    fetchDebtors();
  }, []);

  useEffect(() => {
    filterDebtors();
    setCurrentPage(1); // Reset to first page when filters change
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
          credit_limit, payment_terms_default, created_at,
          debtor_contacts (id, name, title, email, phone, is_primary, outreach_enabled)
        `)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Map contacts to debtors
      const debtorsWithContacts = (data || []).map((d: any) => ({
        ...d,
        contacts: d.debtor_contacts || []
      }));
      
      setDebtors(debtorsWithContacts);
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

  // Sorting hook for the table
  const { sortedData, sortKey, sortDirection, handleSort } = useSorting(filteredDebtors);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / ROWS_PER_PAGE);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );


  const addContact = () => {
    setContacts([...contacts, { name: "", title: "", email: "", phone: "", outreach_enabled: true }]);
  };

  const removeContact = (index: number) => {
    if (contacts.length > 1) {
      setContacts(contacts.filter((_, i) => i !== index));
    }
  };

  const updateContact = (index: number, field: keyof Contact, value: string | boolean) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };
    setContacts(updated);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const primaryContact = contacts[0];
    if (!primaryContact.name || !primaryContact.email) {
      toast.error("Primary contact name and email are required");
      return;
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: debtor, error } = await supabase.from("debtors").insert({
        ...formData,
        name: formData.company_name,
        contact_name: primaryContact.name,
        email: primaryContact.email,
        phone: primaryContact.phone,
        user_id: user.id,
      } as any).select().single();

      if (error) throw error;

      const contactsToInsert = contacts.map((contact, index) => ({
        debtor_id: debtor.id,
        user_id: user.id,
        name: contact.name,
        title: contact.title || null,
        email: contact.email || null,
        phone: contact.phone || null,
        outreach_enabled: contact.outreach_enabled,
        is_primary: index === 0,
      }));

      await supabase.from("debtor_contacts").insert(contactsToInsert);

      toast.success("Account created successfully");
      setIsCreateOpen(false);
      setFormData({
        company_name: "",
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
        industry: "",
      });
      setContacts([{ name: "", title: "", email: "", phone: "", outreach_enabled: true }]);
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
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">
              Manage your customer accounts • <span className="font-medium">{debtors.length} total accounts</span>
            </p>
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

                  {/* Contacts Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Contacts</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addContact}>
                        <UserPlus className="h-4 w-4 mr-1" />
                        Add Contact
                      </Button>
                    </div>
                    
                    {contacts.map((contact, index) => (
                      <Card key={index} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                              {index === 0 ? "Primary Contact" : `Contact ${index + 1}`}
                            </span>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`outreach-${index}`} className="text-sm">Outreach</Label>
                                <Switch
                                  id={`outreach-${index}`}
                                  checked={contact.outreach_enabled}
                                  onCheckedChange={(checked) => updateContact(index, "outreach_enabled", checked)}
                                />
                              </div>
                              {index > 0 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeContact(index)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor={`contact-name-${index}`} className="text-xs">
                                Name {index === 0 && "*"}
                              </Label>
                              <Input
                                id={`contact-name-${index}`}
                                value={contact.name}
                                onChange={(e) => updateContact(index, "name", e.target.value)}
                                placeholder="Full name"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`contact-title-${index}`} className="text-xs">Title</Label>
                              <Input
                                id={`contact-title-${index}`}
                                value={contact.title}
                                onChange={(e) => updateContact(index, "title", e.target.value)}
                                placeholder="e.g., CFO, AP Manager"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`contact-email-${index}`} className="text-xs">
                                Email {index === 0 && "*"}
                              </Label>
                              <Input
                                id={`contact-email-${index}`}
                                type="email"
                                value={contact.email}
                                onChange={(e) => updateContact(index, "email", e.target.value)}
                                placeholder="email@company.com"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`contact-phone-${index}`} className="text-xs">Phone</Label>
                              <Input
                                id={`contact-phone-${index}`}
                                type="tel"
                                value={contact.phone}
                                onChange={(e) => updateContact(index, "phone", e.target.value)}
                                placeholder="(555) 123-4567"
                              />
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
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
                  <div className="grid grid-cols-3 gap-4">
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
                    <div className="space-y-2">
                      <Label htmlFor="industry">Industry</Label>
                      <Input
                        id="industry"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        placeholder="e.g., Technology"
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
                {paginatedData.map((debtor) => (
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

                    {/* Contacts */}
                    <div className="space-y-2 mb-3">
                      <p className="text-xs font-medium text-muted-foreground">Contacts</p>
                      <div className="space-y-1.5">
                        {debtor.contacts && debtor.contacts.length > 0 ? (
                          debtor.contacts.slice(0, 3).map((contact) => (
                            <div key={contact.id} className="flex items-center gap-2 text-sm bg-muted/30 rounded px-2 py-1">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                contact.is_primary ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                              }`}>
                                <User className="h-3 w-3" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="font-medium truncate">{contact.name}</span>
                                  {contact.is_primary && (
                                    <span className="text-[10px] bg-primary/10 text-primary px-1 rounded">Primary</span>
                                  )}
                                </div>
                                {contact.email && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Mail className="h-2.5 w-2.5" />
                                    <span className="truncate">{contact.email}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{debtor.email}</span>
                          </div>
                        )}
                      </div>
                      {(debtor.city || debtor.state) && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm pt-1">
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
                      <SortableTableHead
                        sortKey="company_name"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      >
                        Account
                      </SortableTableHead>
                      <TableHead>Contacts</TableHead>
                      <SortableTableHead
                        sortKey="type"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      >
                        Type
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey="total_open_balance"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-right"
                      >
                        Balance
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey="open_invoices_count"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      >
                        Invoices
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey="max_days_past_due"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      >
                        Max DPD
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey="payment_score"
                        currentSortKey={sortKey}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      >
                        Score
                      </SortableTableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((debtor) => (
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
                              <p className="font-medium truncate">{debtor.company_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{debtor.reference_id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 max-w-xs">
                            {debtor.contacts && debtor.contacts.length > 0 ? (
                              debtor.contacts.slice(0, 3).map((contact, idx) => (
                                <div key={contact.id} className="flex items-center gap-2 text-xs">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                    contact.is_primary ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                  }`}>
                                    <User className="h-3 w-3" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="font-medium truncate block">{contact.name}</span>
                                    {contact.email && (
                                      <span className="text-muted-foreground truncate block">{contact.email}</span>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center gap-2 text-xs">
                                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
                                  <User className="h-3 w-3" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="text-muted-foreground truncate block">{debtor.email}</span>
                                </div>
                              </div>
                            )}
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * ROWS_PER_PAGE + 1} - {Math.min(currentPage * ROWS_PER_PAGE, sortedData.length)} of {sortedData.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
};

export default Debtors;
