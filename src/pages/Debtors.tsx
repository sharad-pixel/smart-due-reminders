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
import { Plus, Search, Eye, Upload, FileSpreadsheet, FileText, HelpCircle, ChevronDown, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AIPromptCreationModal } from "@/components/AIPromptCreationModal";
import * as XLSX from 'xlsx';

interface Debtor {
  id: string;
  reference_id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string | null;
  type: "B2B" | "B2C" | null;
  current_balance: number | null;
}

const Debtors = () => {
  const navigate = useNavigate();
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [filteredDebtors, setFilteredDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [importSummary, setImportSummary] = useState<{ total: number; errors: string[]; warnings: string[] } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isGoogleSheetsOpen, setIsGoogleSheetsOpen] = useState(false);
  const [isAIPromptOpen, setIsAIPromptOpen] = useState(false);
  const [autoCompleting, setAutoCompleting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    type: "B2C" as "B2B" | "B2C",
    address: "",
    notes: "",
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
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDebtors(data || []);
    } catch (error: any) {
      toast.error("Failed to load debtors");
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

  const downloadDebtorsTemplate = (format: 'csv' | 'excel') => {
    const headers = [
      'debtor_name*',
      'company_name',
      'debtor_type',
      'primary_contact_name',
      'primary_email*',
      'primary_phone',
      'billing_address_line1',
      'billing_address_line2',
      'billing_city',
      'billing_state',
      'billing_postal_code',
      'billing_country',
      'ar_contact_name',
      'ar_contact_email',
      'ar_contact_phone',
      'external_system',
      'external_customer_id',
      'crm_system',
      'crm_account_id_external',
      'credit_limit',
      'payment_terms_default',
      'notes',
      'tags',
      'is_active'
    ];
    
    const instructionRow = [
      'Required. Name or Company Name',
      'Optional. Company name for B2B',
      'B2B or B2C',
      'Optional. Primary contact person',
      'Required. Primary email address',
      'Optional. Primary phone',
      'Optional. Billing address line 1',
      'Optional. Billing address line 2',
      'Optional. City',
      'Optional. State/Province',
      'Optional. Postal/ZIP code',
      'Optional. Country',
      'Optional. AR/AP contact name',
      'Optional. AR/AP contact email',
      'Optional. AR/AP contact phone',
      'Optional. e.g., QuickBooks, Stripe',
      'Optional. ID in external system',
      'Optional. e.g., Salesforce, HubSpot',
      'Optional. CRM account ID',
      'Optional. Credit limit amount',
      'Optional. e.g., NET30, NET15',
      'Optional. Additional notes',
      'Optional. Comma-separated',
      'Optional. true or false'
    ];
    
    const exampleRows = [
      [
        'Acme Corporation',
        'Acme Corporation',
        'B2B',
        'John Smith',
        'john.smith@acmecorp.com',
        '+1-555-0123',
        '123 Main St',
        'Suite 100',
        'New York',
        'NY',
        '10001',
        'USA',
        'Jane Accountant',
        'jane.accountant@acmecorp.com',
        '+1-555-0124',
        'QuickBooks',
        'QB_123456',
        'Salesforce',
        'SF_001234',
        '50000',
        'NET30',
        'High-value client, preferred terms',
        'VIP,B2B,HighValue',
        'true'
      ],
      [
        'Jane Doe',
        '',
        'B2C',
        'Jane Doe',
        'jane.doe@email.com',
        '+1-555-0456',
        '456 Oak Ave',
        'Apt 5',
        'Los Angeles',
        'CA',
        '90001',
        'USA',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'Due on Receipt',
        'Individual customer',
        'Retail',
        'true'
      ]
    ];
    
    if (format === 'csv') {
      let csvContent = headers.join(',') + '\n';
      csvContent += instructionRow.map(cell => `"${cell}"`).join(',') + '\n';
      exampleRows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'debtors_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV template downloaded with instructions');
    } else {
      // Generate Excel file
      const wsData = [headers, instructionRow, ...exampleRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Debtors Template');
      XLSX.writeFile(wb, 'debtors_template.xlsx');
      toast.success('Excel template downloaded with instructions');
    }
  };

  const showGoogleSheetsInstructions = () => {
    setIsGoogleSheetsOpen(true);
  };

  const parseImportFile = async (file: File, hasHeader: boolean): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          let rows: any[] = [];

          if (file.name.endsWith('.csv')) {
            // Parse CSV
            const text = data as string;
            const lines = text.split('\n').filter(line => line.trim());
            rows = lines.map(line => {
              // Simple CSV parser - handles quoted values
              const values: string[] = [];
              let current = '';
              let inQuotes = false;
              
              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                  inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                  values.push(current.trim());
                  current = '';
                } else {
                  current += char;
                }
              }
              values.push(current.trim());
              return values;
            });
          } else {
            // Parse Excel
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          }

          resolve(rows);
        } catch (error) {
          reject(error);
        }
      };
      
      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    });
  };

  const previewDebtorsImport = async () => {
    if (!importFile) {
      toast.error('Please select a file to import');
      return;
    }

    setIsPreviewLoading(true);
    try {
      const rows = await parseImportFile(importFile, hasHeaderRow);
      
      if (rows.length === 0) {
        toast.error('File is empty');
        setIsPreviewLoading(false);
        return;
      }

      const headers = hasHeaderRow ? rows[0] : [];
      const dataRows = hasHeaderRow ? rows.slice(1) : rows;

      // Normalize header names (strip asterisks and parentheses)
      const headerMap: any = {};
      headers.forEach((header: string, index: number) => {
        const normalized = header.toLowerCase().trim().replace(/[*()\s]+/g, '_').replace(/_+$/g, '');
        headerMap[normalized] = index;
      });

      // Validate required columns
      const errors: string[] = [];
      const warnings: string[] = [];

      const hasName = headerMap['debtor_name'] || headerMap['name'];
      const hasCompany = headerMap['company_name'];
      
      if (!hasName && !hasCompany) {
        errors.push('Missing required field: debtor_name* OR company_name (at least one required)');
      }
      
      const hasEmail = headerMap['primary_email'] || headerMap['debtor_email'] || headerMap['email'];
      const hasPhone = headerMap['primary_phone'] || headerMap['debtor_phone'] || headerMap['phone'];
      
      if (!hasEmail && !hasPhone) {
        errors.push('Missing required contact: primary_email* OR primary_phone (at least one required)');
      }

      if (errors.length > 0) {
        setImportSummary({ total: dataRows.length, errors, warnings });
        setPreviewData(null);
        setIsPreviewLoading(false);
        return;
      }

      // Parse and validate rows
      const parsedRows = dataRows.slice(0, 20).map((row: any[], rowIndex: number) => {
        const parsed: any = {
          _rowIndex: rowIndex + (hasHeaderRow ? 2 : 1),
          debtor_name: row[headerMap['debtor_name'] || headerMap['name']]?.toString().trim() || '',
          company_name: row[headerMap['company_name']]?.toString().trim() || '',
          debtor_type: row[headerMap['debtor_type'] || headerMap['type']]?.toString().trim() || '',
          primary_contact_name: row[headerMap['primary_contact_name']]?.toString().trim() || '',
          primary_email: row[headerMap['primary_email'] || headerMap['debtor_email'] || headerMap['email']]?.toString().trim() || '',
          primary_phone: row[headerMap['primary_phone'] || headerMap['debtor_phone'] || headerMap['phone']]?.toString().trim() || '',
          billing_address_line1: row[headerMap['billing_address_line1']]?.toString().trim() || '',
          ar_contact_name: row[headerMap['ar_contact_name']]?.toString().trim() || '',
          external_system: row[headerMap['external_system']]?.toString().trim() || '',
          external_customer_id: row[headerMap['external_customer_id']]?.toString().trim() || '',
          payment_terms_default: row[headerMap['payment_terms_default']]?.toString().trim() || '',
          notes: row[headerMap['notes']]?.toString().trim() || '',
          tags: row[headerMap['tags']]?.toString().trim() || '',
          is_active: row[headerMap['is_active']]?.toString().trim() || 'true'
        };

        // Validate required fields
        if (!parsed.debtor_name && !parsed.company_name) {
          warnings.push(`Row ${parsed._rowIndex}: Missing both debtor_name and company_name (at least one required)`);
        }
        if (!parsed.primary_email && !parsed.primary_phone) {
          warnings.push(`Row ${parsed._rowIndex}: Missing both primary_email and primary_phone (at least one required)`);
        }

        // Validate debtor_type
        if (parsed.debtor_type && !['B2B', 'B2C'].includes(parsed.debtor_type.toUpperCase())) {
          warnings.push(`Row ${parsed._rowIndex}: Invalid debtor_type "${parsed.debtor_type}" (must be B2B or B2C)`);
        }

        return parsed;
      });

      setPreviewData(parsedRows);
      setImportSummary({ total: dataRows.length, errors, warnings });
      toast.success(`Preview loaded: ${dataRows.length} rows found`);
    } catch (error: any) {
      toast.error(`Failed to parse file: ${error.message}`);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const importDebtorsFromFile = async () => {
    if (!importFile) return;

    setIsImporting(true);
    try {
      const rows = await parseImportFile(importFile, hasHeaderRow);
      const headers = hasHeaderRow ? rows[0] : [];
      const dataRows = hasHeaderRow ? rows.slice(1) : rows;

      const headerMap: any = {};
      headers.forEach((header: string, index: number) => {
        const normalized = header.toLowerCase().trim().replace(/[*()\s]+/g, '_').replace(/_+$/g, '');
        headerMap[normalized] = index;
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get existing debtors for duplicate detection
      const { data: existingDebtors } = await supabase
        .from('debtors')
        .select('id, primary_email, email, external_customer_id, company_name')
        .eq('user_id', user.id);

      const existingDebtorsMap = new Map<string, string>();
      existingDebtors?.forEach(d => {
        const email = (d.primary_email || d.email || '').toLowerCase();
        if (email) existingDebtorsMap.set(email, d.id);
        if (d.external_customer_id) existingDebtorsMap.set(`ext_${d.external_customer_id}`, d.id);
      });

      // Get CRM accounts for linking
      const { data: crmAccounts } = await supabase
        .from('crm_accounts')
        .select('id, crm_account_id, name')
        .eq('user_id', user.id);

      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of dataRows) {
        try {
          const debtorName = row[headerMap['debtor_name'] || headerMap['name']]?.toString().trim() || '';
          const companyName = row[headerMap['company_name']]?.toString().trim() || '';
          const primaryEmail = row[headerMap['primary_email'] || headerMap['debtor_email'] || headerMap['email']]?.toString().trim() || '';
          const primaryPhone = row[headerMap['primary_phone'] || headerMap['debtor_phone'] || headerMap['phone']]?.toString().trim() || '';
          
          // Validate required fields
          if (!debtorName && !companyName) {
            skipped++;
            continue;
          }
          if (!primaryEmail && !primaryPhone) {
            skipped++;
            continue;
          }

          const debtorData: any = {
            name: debtorName || companyName,
            company_name: companyName,
            contact_name: debtorName,
            primary_contact_name: row[headerMap['primary_contact_name']]?.toString().trim() || debtorName,
            primary_email: primaryEmail || null,
            primary_phone: primaryPhone || null,
            email: primaryEmail, // Keep legacy field
            phone: primaryPhone, // Keep legacy field
            type: (row[headerMap['debtor_type'] || headerMap['type']]?.toString().trim().toUpperCase() || (companyName ? 'B2B' : 'B2C')) as 'B2B' | 'B2C',
            billing_address_line1: row[headerMap['billing_address_line1']]?.toString().trim() || null,
            billing_address_line2: row[headerMap['billing_address_line2']]?.toString().trim() || null,
            billing_city: row[headerMap['billing_city']]?.toString().trim() || null,
            billing_state: row[headerMap['billing_state']]?.toString().trim() || null,
            billing_postal_code: row[headerMap['billing_postal_code']]?.toString().trim() || null,
            billing_country: row[headerMap['billing_country']]?.toString().trim() || null,
            ar_contact_name: row[headerMap['ar_contact_name']]?.toString().trim() || null,
            ar_contact_email: row[headerMap['ar_contact_email']]?.toString().trim() || null,
            ar_contact_phone: row[headerMap['ar_contact_phone']]?.toString().trim() || null,
            external_system: row[headerMap['external_system']]?.toString().trim() || null,
            external_customer_id: row[headerMap['external_customer_id']]?.toString().trim() || null,
            crm_system: row[headerMap['crm_system']]?.toString().trim() || null,
            crm_account_id_external: row[headerMap['crm_account_id_external']]?.toString().trim() || null,
            credit_limit: row[headerMap['credit_limit']]?.toString().trim() ? parseFloat(row[headerMap['credit_limit']]) : null,
            payment_terms_default: row[headerMap['payment_terms_default']]?.toString().trim() || null,
            notes: row[headerMap['notes']]?.toString().trim() || null,
            tags: row[headerMap['tags']]?.toString().trim() ? row[headerMap['tags']].split(',').map((t: string) => t.trim()) : null,
            is_active: row[headerMap['is_active']]?.toString().trim().toLowerCase() !== 'false',
          };

          // Validate type
          if (!['B2B', 'B2C'].includes(debtorData.type)) {
            debtorData.type = companyName ? 'B2B' : 'B2C';
          }

          // Check for existing debtor
          let existingId = null;
          if (debtorData.external_customer_id) {
            existingId = existingDebtorsMap.get(`ext_${debtorData.external_customer_id}`);
          }
          if (!existingId && primaryEmail) {
            existingId = existingDebtorsMap.get(primaryEmail.toLowerCase());
          }

          if (existingId) {
            // Update existing debtor (only non-null values)
            const updateData: any = {};
            Object.keys(debtorData).forEach(key => {
              if (debtorData[key] !== null && debtorData[key] !== '') {
                updateData[key] = debtorData[key];
              }
            });

            const { error } = await supabase
              .from('debtors')
              .update(updateData)
              .eq('id', existingId);

            if (error) throw error;
            updated++;
          } else {
            // Insert new debtor
            const { error } = await supabase
              .from('debtors')
              .insert({ ...debtorData, user_id: user.id } as any);

            if (error) throw error;
            inserted++;
          }
        } catch (error) {
          console.error('Error processing row:', error);
          skipped++;
        }
      }

      toast.success(`Import complete: ${inserted} created, ${updated} updated, ${skipped} skipped`);
      setIsImportOpen(false);
      setImportFile(null);
      setPreviewData(null);
      setImportSummary(null);
      fetchDebtors();
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("debtors").insert({
        ...formData,
        user_id: user.id,
      } as any);

      if (error) throw error;
      toast.success("Debtor created successfully");
      setIsCreateOpen(false);
      setFormData({
        name: "",
        company_name: "",
        contact_name: "",
        email: "",
        phone: "",
        type: "B2C",
        address: "",
        notes: "",
      });
      fetchDebtors();
    } catch (error: any) {
      toast.error(error.message || "Failed to create debtor");
    }
  };

  const handleAutoCompleteDebtor = async () => {
    const searchQuery = formData.company_name || formData.name;
    if (!searchQuery) {
      toast.error("Please enter a name or company name first");
      return;
    }

    setAutoCompleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("autocomplete-business-info", {
        body: { 
          query: searchQuery,
          type: 'debtor_info'
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.success && data.data) {
        const info = data.data;

        setFormData({
          ...formData,
          name: info.name || formData.name,
          company_name: info.company_name || formData.company_name,
          email: info.email || formData.email,
          phone: info.phone || formData.phone,
          type: info.type || formData.type,
        });

        toast.success("Customer information auto-completed from web data");
      }
    } catch (error: any) {
      console.error("Error auto-completing:", error);
      toast.error(error.message || "Failed to auto-complete customer information");
    } finally {
      setAutoCompleting(false);
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
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-primary">Debtors</h1>
            <p className="text-muted-foreground mt-2">Manage your customer accounts</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAIPromptOpen(true)}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Create with AI
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Debtors
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsImportOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import from File
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadDebtorsTemplate('csv')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Download Debtors Template (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadDebtorsTemplate('excel')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download Debtors Template (Excel)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={showGoogleSheetsInstructions}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  View Google Sheets Template Instructions
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Debtor
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>Create New Debtor</DialogTitle>
                  <Button
                    onClick={handleAutoCompleteDebtor}
                    disabled={autoCompleting || (!formData.name && !formData.company_name)}
                    variant="outline"
                    size="sm"
                    type="button"
                  >
                    {autoCompleting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {autoCompleting ? "Loading..." : "Auto Complete"}
                  </Button>
                </div>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter name/company and click Auto Complete
                    </p>
                  </div>
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
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
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
                  <Button type="submit">Create Debtor</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Google Sheets Instructions Modal */}
        <Dialog open={isGoogleSheetsOpen} onOpenChange={setIsGoogleSheetsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Google Sheets Template Instructions</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Follow these steps to use Google Sheets with the Debtors import template:
              </p>
              <ol className="list-decimal list-inside space-y-3 text-sm">
                <li>
                  <strong>Download the template:</strong> Click the button below to download the Debtors template as a CSV file.
                </li>
                <li>
                  <strong>Upload to Google Sheets:</strong> Go to{" "}
                  <a 
                    href="https://sheets.google.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google Sheets
                  </a>
                  , click "File" → "Import" → "Upload", and select your downloaded CSV file.
                </li>
                <li>
                  <strong>Fill in your data:</strong> Add your debtor information following the column structure in the template. Make sure to include all required fields.
                </li>
                <li>
                  <strong>Export as CSV:</strong> When you're done, go to "File" → "Download" → "Comma-separated values (.csv)" to export your sheet.
                </li>
                <li>
                  <strong>Import to the app:</strong> Use the "Import Debtors" → "Import from File" option and select your exported CSV file.
                </li>
              </ol>
              <div className="flex gap-2 pt-4">
                <Button onClick={() => {
                  downloadDebtorsTemplate('csv');
                  toast.success('Template downloaded! Follow the instructions to use it with Google Sheets.');
                }}>
                  <FileText className="h-4 w-4 mr-2" />
                  Download CSV Template
                </Button>
                <Button variant="outline" onClick={() => setIsGoogleSheetsOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import Debtors Modal */}
        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Import Debtors</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* File Upload Section */}
              <div className="space-y-2">
                <Label htmlFor="import-file">Select File</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setImportFile(file || null);
                    setPreviewData(null);
                    setImportSummary(null);
                  }}
                />
              </div>

              {/* Header Row Checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-header"
                  checked={hasHeaderRow}
                  onCheckedChange={(checked) => setHasHeaderRow(checked as boolean)}
                />
                <Label htmlFor="has-header" className="cursor-pointer">
                  File has header row
                </Label>
              </div>

              {/* Preview Button */}
              <Button
                onClick={previewDebtorsImport}
                disabled={!importFile || isPreviewLoading}
              >
                {isPreviewLoading ? 'Loading Preview...' : 'Preview Import'}
              </Button>

              {/* Errors and Warnings */}
              {importSummary && (
                <div className="space-y-2">
                  {importSummary.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-semibold mb-1">Errors:</div>
                        <ul className="list-disc list-inside">
                          {importSummary.errors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  {importSummary.warnings.length > 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-semibold mb-1">Warnings:</div>
                        <ul className="list-disc list-inside">
                          {importSummary.warnings.slice(0, 5).map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                          {importSummary.warnings.length > 5 && (
                            <li>... and {importSummary.warnings.length - 5} more</li>
                          )}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Preview Table */}
              {previewData && (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Showing first 20 of {importSummary?.total || 0} rows
                  </div>
                  <div className="border rounded-lg overflow-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Ext. System</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{row._rowIndex}</TableCell>
                            <TableCell>{row.debtor_name}</TableCell>
                            <TableCell>{row.company_name || '-'}</TableCell>
                            <TableCell>{row.debtor_type || 'B2C'}</TableCell>
                            <TableCell>{row.primary_email || '-'}</TableCell>
                            <TableCell>{row.primary_phone || '-'}</TableCell>
                            <TableCell>{row.external_system || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Import Button */}
                  {importSummary && importSummary.errors.length === 0 && (
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsImportOpen(false);
                          setImportFile(null);
                          setPreviewData(null);
                          setImportSummary(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={importDebtorsFromFile}
                        disabled={isImporting}
                      >
                        {isImporting ? 'Importing...' : `Import All ${importSummary.total} Valid Rows`}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by reference ID, name, company, or email..."
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
            </div>
          </CardHeader>
          <CardContent>
            {filteredDebtors.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {debtors.length === 0
                    ? "No debtors yet. Create your first debtor to get started."
                    : "No debtors match your search criteria."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDebtors.map((debtor) => (
                    <TableRow key={debtor.id}>
                      <TableCell className="font-mono text-xs">{debtor.reference_id}</TableCell>
                      <TableCell className="font-medium">{debtor.name}</TableCell>
                      <TableCell>{debtor.company_name}</TableCell>
                      <TableCell>{debtor.email}</TableCell>
                      <TableCell>{debtor.phone || "-"}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            debtor.type === "B2B"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {debtor.type || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        ${(debtor.current_balance || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/debtors/${debtor.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <AIPromptCreationModal
          open={isAIPromptOpen}
          onOpenChange={setIsAIPromptOpen}
          onSuccess={fetchDebtors}
        />
      </div>
    </Layout>
  );
};

export default Debtors;
