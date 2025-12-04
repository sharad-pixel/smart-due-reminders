import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface Debtor {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  primary_contact_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  external_customer_id: string | null;
  crm_account_id_external: string | null;
}

interface DebtorsListProps {
  onUpdate: () => void;
}

const DebtorsList = ({ onUpdate }: DebtorsListProps) => {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    address: "",
    external_customer_id: "",
    crm_account_id_external: "",
  });

  useEffect(() => {
    fetchDebtors();
  }, []);

  const fetchDebtors = async () => {
    try {
      const { data, error } = await supabase
        .from("debtors")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDebtors(data || []);
    } catch (error: any) {
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("debtors").insert([{
        ...formData,
        name: formData.contact_name || formData.company_name,
        primary_contact_name: formData.contact_name,
        primary_email: formData.email,
        primary_phone: formData.phone,
        user_id: user.id,
      } as any]);
      
      if (error) throw error;
      
      toast.success("Account added successfully");
      setOpen(false);
      setFormData({
        company_name: "",
        contact_name: "",
        email: "",
        phone: "",
        address: "",
        external_customer_id: "",
        crm_account_id_external: "",
      });
      fetchDebtors();
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Failed to add account");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("debtors").delete().eq("id", id);
      
      if (error) throw error;
      
      toast.success("Account deleted");
      fetchDebtors();
      onUpdate();
    } catch (error: any) {
      toast.error("Failed to delete account");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Accounts</CardTitle>
            <CardDescription>Manage your accounts and their contact information</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Account</DialogTitle>
                <DialogDescription>
                  Enter the account's information to track their invoices
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
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
                <Button type="submit" className="w-full">Add Account</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {debtors.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No accounts yet. Add your first account to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Account ID</TableHead>
                <TableHead>CRM ID</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debtors.map((debtor) => (
                <TableRow key={debtor.id}>
                  <TableCell className="font-medium">{debtor.company_name}</TableCell>
                  <TableCell>{debtor.primary_contact_name || debtor.contact_name}</TableCell>
                  <TableCell>{debtor.primary_email || debtor.email}</TableCell>
                  <TableCell>{debtor.primary_phone || debtor.phone || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{debtor.external_customer_id || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{debtor.crm_account_id_external || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(debtor.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default DebtorsList;
