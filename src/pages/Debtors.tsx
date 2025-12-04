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
import { Plus, Search, Upload, FileSpreadsheet, FileText, HelpCircle, ChevronDown, AlertCircle, Sparkles, Loader2, Download, Building2, User, Mail, Phone, MapPin, Clock, DollarSign, TrendingUp, FileBarChart, MoreHorizontal, ExternalLink, CreditCard, LayoutGrid, List } from "lucide-react";
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
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [formData, setFormData] = useState({
    name: "",
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

  const exportAllAccounts = (format: 'csv' | 'excel') => {
    if (debtors.length === 0) {
      toast.error('No accounts to export');
      return;
    }

    const headers = [
      'recouply_account_id',
      'name',
      'company_name',
      'email',
      'phone',
      'type',
      'current_balance',
      'external_customer_id',
      'crm_account_id_external'
    ];

    const rows = debtors.map(debtor => [
      debtor.reference_id,
      debtor.name,
      debtor.company_name,
      debtor.email,
      debtor.phone || '',
      debtor.type || '',
      debtor.current_balance?.toString() || '0',
      debtor.external_customer_id || '',
      debtor.crm_account_id_external || ''
    ]);

    if (format === 'csv') {
      let csvContent = headers.join(',') + '\n';
      rows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recouply_accounts_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`Exported ${debtors.length} accounts to CSV`);
    } else {
      const wsData = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Accounts');
      XLSX.writeFile(wb, `recouply_accounts_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`Exported ${debtors.length} accounts to Excel`);
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
      toast.success("Account created successfully");
      setIsCreateOpen(false);
      setFormData({
        name: "",
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
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">Accounts</h1>
            <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base">Manage your customer accounts</p>
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
                  Import / Export
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onClick={() => exportAllAccounts('csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export All Accounts (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAllAccounts('excel')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export All Accounts (Excel)
                </DropdownMenuItem>
                <div className="border-t my-1" />
                <DropdownMenuItem onClick={() => setIsImportOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import from File
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadDebtorsTemplate('csv')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Download Import Template (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadDebtorsTemplate('excel')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download Import Template (Excel)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={showGoogleSheetsInstructions}>
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Google Sheets Instructions
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Account
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>Create New Account</DialogTitle>
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

        {/* Google Sheets Instructions Modal */}
        <Dialog open={isGoogleSheetsOpen} onOpenChange={setIsGoogleSheetsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Google Sheets Template Instructions</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Follow these steps to use Google Sheets with the Accounts import template:
              </p>
              <ol className="list-decimal list-inside space-y-3 text-sm">
                <li>
                  <strong>Download the template:</strong> Click the button below to download the Accounts template as a CSV file.
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
                  <strong>Fill in your data:</strong> Add your account information following the column structure in the template. Make sure to include all required fields.
                </li>
                <li>
                  <strong>Export as CSV:</strong> When you're done, go to "File" → "Download" → "Comma-separated values (.csv)" to export your sheet.
                </li>
                <li>
                  <strong>Import to the app:</strong> Use the "Import Accounts" → "Import from File" option and select your exported CSV file.
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
              <DialogTitle>Import Accounts</DialogTitle>
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
