import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, Eye, Upload, FileSpreadsheet, FileText, HelpCircle, ChevronDown, AlertCircle, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AIPromptCreationModal } from "@/components/AIPromptCreationModal";
import * as XLSX from 'xlsx';

interface Invoice {
  id: string;
  reference_id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: string;
  last_contact_date: string | null;
  debtor_id: string;
  debtors?: { name: string };
  ai_workflows?: Array<{
    id: string;
    is_active: boolean;
  }>;
}

interface Debtor {
  id: string;
  name: string;
}

const Invoices = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ageBucketFilter, setAgeBucketFilter] = useState<string>("all");
  const [debtorFilter, setDebtorFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [importSummary, setImportSummary] = useState<{ 
    total: number; 
    errors: string[]; 
    warnings: string[];
    validMatches?: number;
    noMatches?: number;
    multipleMatches?: number;
  } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isGoogleSheetsOpen, setIsGoogleSheetsOpen] = useState(false);
  const [isAIPromptOpen, setIsAIPromptOpen] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
  const [selectedAgingBucket, setSelectedAgingBucket] = useState<string>("");
  const [formData, setFormData] = useState({
    debtor_id: "",
    invoice_number: "",
    amount: "",
    issue_date: new Date().toISOString().split("T")[0],
    due_date: "",
    notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterInvoices();
  }, [invoices, searchTerm, statusFilter, ageBucketFilter, debtorFilter]);

  const fetchData = async () => {
    try {
      const [invoicesRes, debtorsRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("*, debtors(name), ai_workflows(id, is_active)")
          .order("due_date", { ascending: false }),
        supabase.from("debtors").select("id, name").order("name"),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (debtorsRes.error) throw debtorsRes.error;

      setInvoices(invoicesRes.data || []);
      setDebtors(debtorsRes.data || []);
    } catch (error: any) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const getDaysPastDue = (dueDate: string): number => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getAgeBucket = (daysPastDue: number): string => {
    if (daysPastDue === 0) return "current";
    if (daysPastDue <= 30) return "0-30";
    if (daysPastDue <= 60) return "31-60";
    if (daysPastDue <= 90) return "61-90";
    return "90+";
  };

  const handleRemoveFromWorkflow = async (invoiceId: string, workflowId: string) => {
    try {
      const { error } = await supabase
        .from("ai_workflows")
        .update({ is_active: false })
        .eq("id", workflowId);

      if (error) throw error;

      toast.success("Invoice removed from workflow");
      fetchData();
    } catch (error: any) {
      toast.error("Failed to remove from workflow");
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedAgingBucket) {
      toast.error("Please select an aging bucket");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('bulk-assign-workflows', {
        body: {
          invoice_ids: selectedInvoices,
          action: 'assign',
          aging_bucket: selectedAgingBucket,
        },
      });

      if (error) throw error;

      // Check if it's a user-friendly error from the edge function
      if (data?.error && data?.user_friendly) {
        toast.error(data.error, {
          duration: 6000,
          action: {
            label: "Set up workflows",
            onClick: () => navigate("/settings/ai-workflows"),
          },
        });
        return;
      }

      if (data?.error) throw new Error(data.error);

      toast.success(data.message || "Invoices assigned to workflow");
      setSelectedInvoices([]);
      setShowBulkAssignDialog(false);
      setSelectedAgingBucket("");
      fetchData();
    } catch (error: any) {
      console.error('Bulk assign error:', error);
      toast.error(error.message || "Failed to assign invoices to workflow");
    }
  };

  const handleBulkUnassign = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('bulk-assign-workflows', {
        body: {
          invoice_ids: selectedInvoices,
          action: 'unassign',
        },
      });

      if (error) throw error;

      toast.success(data.message || "Invoices removed from workflows");
      setSelectedInvoices([]);
      fetchData();
    } catch (error: any) {
      toast.error("Failed to remove invoices from workflows");
      console.error(error);
    }
  };

  const filterInvoices = () => {
    let filtered = [...invoices];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.reference_id.toLowerCase().includes(term) ||
          inv.invoice_number.toLowerCase().includes(term) ||
          inv.debtors?.name.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((inv) => inv.status === statusFilter);
    }

    if (ageBucketFilter !== "all") {
      filtered = filtered.filter((inv) => {
        const daysPastDue = getDaysPastDue(inv.due_date);
        return getAgeBucket(daysPastDue) === ageBucketFilter;
      });
    }

    if (debtorFilter !== "all") {
      filtered = filtered.filter((inv) => inv.debtor_id === debtorFilter);
    }

    setFilteredInvoices(filtered);
  };

  const downloadInvoicesTemplate = (format: 'csv' | 'excel') => {
    // Headers with asterisks indicating required fields
    const headers = [
      'invoice_number*',
      'debtor_reference_id (RECOMMENDED)',
      'debtor_email',
      'debtor_company_name',
      'amount*',
      'issue_date* (YYYY-MM-DD)',
      'due_date* (YYYY-MM-DD)',
      'currency',
      'status',
      'external_link',
      'notes',
      'crm_account_external_id'
    ];
    
    const instructionRow = [
      'REQUIRED - Unique invoice number',
      'RECOMMENDED - Best match: Use debtor ref ID (e.g., DEB-001)',
      'Alternative: Email to match debtor',
      'Alternative: Company name to match debtor',
      'REQUIRED - Numeric value',
      'REQUIRED - Format: YYYY-MM-DD',
      'REQUIRED - Format: YYYY-MM-DD',
      'Optional - Default: USD',
      'Optional - Open/Paid/Disputed/Settled/InPaymentPlan/Canceled',
      'Optional - URL to invoice document',
      'Optional - Additional notes',
      'Optional - External CRM account ID for linking'
    ];
    
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 30);
    
    const exampleRows = [
      [
        'INV-2025-001',
        'DEB-001',
        'john.smith@acmecorp.com',
        'Acme Corporation',
        '15000.00',
        today.toISOString().split('T')[0],
        dueDate.toISOString().split('T')[0],
        'USD',
        'Open',
        'https://example.com/invoices/INV-2025-001.pdf',
        'Q1 2025 services',
        'SF_ACC_001234'
      ],
      [
        'INV-2025-002',
        'DEB-002',
        'jane.doe@example.com',
        '',
        '8500.50',
        today.toISOString().split('T')[0],
        dueDate.toISOString().split('T')[0],
        'USD',
        'Open',
        '',
        'Q1 consulting',
        ''
      ]
    ];
    
    if (format === 'csv') {
      let csvContent = '# INVOICE IMPORT TEMPLATE - Fields marked with * are REQUIRED\n';
      csvContent += '# Debtor matching: Use debtor_reference_id (RECOMMENDED), OR debtor_email, OR debtor_company_name\n';
      csvContent += '# Invoice reference_id will be auto-generated\n';
      csvContent += headers.join(',') + '\n';
      csvContent += instructionRow.map(cell => `"${cell}"`).join(',') + '\n';
      exampleRows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoices_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV template downloaded');
    } else {
      // Generate Excel file with instructions
      const wsData = [
        ['INVOICE IMPORT TEMPLATE - Fields marked with * are REQUIRED'],
        ['Debtor matching: Use debtor_reference_id (RECOMMENDED), OR debtor_email, OR debtor_company_name'],
        ['Invoice reference_id will be auto-generated'],
        [],
        headers,
        instructionRow,
        ...exampleRows
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Style the header rows
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      ws['!cols'] = [
        { wch: 20 }, { wch: 30 }, { wch: 25 }, { wch: 12 }, 
        { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 20 },
        { wch: 30 }, { wch: 20 }, { wch: 25 }
      ];
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Invoices Template');
      XLSX.writeFile(wb, 'invoices_template.xlsx');
      toast.success('Excel template downloaded');
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
            const text = data as string;
            const lines = text.split('\n').filter(line => line.trim());
            rows = lines.map(line => {
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

  const previewInvoicesImport = async () => {
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

      const headerMap: any = {};
      headers.forEach((header: string, index: number) => {
        // Normalize by removing asterisks, parentheses content, and trimming
        const normalized = header
          .toLowerCase()
          .replace(/\*/g, '')
          .replace(/\s*\([^)]*\)/g, '')
          .trim()
          .replace(/\s+/g, '_');
        headerMap[normalized] = index;
      });

      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate required columns
      if (!headerMap['invoice_number']) {
        errors.push('Missing required column: invoice_number* - The unique invoice identifier');
      }
      if (!headerMap['debtor_reference_id'] && !headerMap['debtor_email'] && !headerMap['debtor_company_name']) {
        errors.push('Missing required columns: You must include debtor_reference_id (RECOMMENDED) OR debtor_email OR debtor_company_name to match existing debtors');
      }
      if (!headerMap['amount']) {
        errors.push('Missing required column: amount* - The invoice total amount (numeric)');
      }
      if (!headerMap['issue_date']) {
        errors.push('Missing required column: issue_date* - Date format: YYYY-MM-DD');
      }
      if (!headerMap['due_date']) {
        errors.push('Missing required column: due_date* - Date format: YYYY-MM-DD');
      }

      if (errors.length > 0) {
        setImportSummary({ total: dataRows.length, errors, warnings, validMatches: 0, noMatches: 0, multipleMatches: 0 });
        setPreviewData(null);
        setIsPreviewLoading(false);
        return;
      }

      // Fetch all debtors for matching
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: debtors } = await supabase
        .from('debtors')
        .select('id, reference_id, name, email, company_name, primary_email, external_customer_id')
        .eq('user_id', user.id);

      const debtorsList = debtors || [];

      // Parse and validate rows with debtor matching
      let validMatches = 0;
      let noMatches = 0;
      let multipleMatches = 0;

      const parsedRows = dataRows.slice(0, 20).map((row: any[], rowIndex: number) => {
        const parsed: any = {
          _rowIndex: rowIndex + (hasHeaderRow ? 2 : 1),
          invoice_number: row[headerMap['invoice_number']]?.toString().trim() || '',
          debtor_reference_id: row[headerMap['debtor_reference_id']]?.toString().trim() || '',
          debtor_email: row[headerMap['debtor_email']]?.toString().trim() || '',
          debtor_company_name: row[headerMap['debtor_company_name']]?.toString().trim() || '',
          amount: row[headerMap['amount']]?.toString().trim() || '',
          currency: row[headerMap['currency']]?.toString().trim() || 'USD',
          issue_date: row[headerMap['issue_date']]?.toString().trim() || '',
          due_date: row[headerMap['due_date']]?.toString().trim() || '',
          status: row[headerMap['status']]?.toString().trim() || 'Open',
          external_link: row[headerMap['external_link']]?.toString().trim() || '',
          notes: row[headerMap['notes']]?.toString().trim() || '',
          crm_account_external_id: row[headerMap['crm_account_external_id']]?.toString().trim() || '',
        };

        // Validate amount
        if (isNaN(parseFloat(parsed.amount))) {
          warnings.push(`Row ${parsed._rowIndex}: Invalid amount "${parsed.amount}"`);
        }

        // Validate dates
        if (parsed.issue_date && isNaN(Date.parse(parsed.issue_date))) {
          warnings.push(`Row ${parsed._rowIndex}: Invalid issue_date "${parsed.issue_date}"`);
        }
        if (parsed.due_date && isNaN(Date.parse(parsed.due_date))) {
          warnings.push(`Row ${parsed._rowIndex}: Invalid due_date "${parsed.due_date}"`);
        }

        // Validate status
        const validStatuses = ['Open', 'Paid', 'Disputed', 'Settled', 'InPaymentPlan', 'Canceled'];
        if (parsed.status && !validStatuses.includes(parsed.status)) {
          warnings.push(`Row ${parsed._rowIndex}: Invalid status "${parsed.status}"`);
        }

        // Find matching debtors - prioritize reference_id > external_customer_id > primary_email > email > company_name
        let matches = [];
        
        // First try reference_id match (most reliable)
        if (parsed.debtor_reference_id) {
          matches = debtorsList.filter(d => d.reference_id === parsed.debtor_reference_id);
        }

        // If no reference_id match, try external_customer_id
        if (matches.length === 0 && parsed.debtor_external_customer_id) {
          matches = debtorsList.filter(d => d.external_customer_id === parsed.debtor_external_customer_id);
        }

        // If no match yet, try email (primary_email or email)
        if (matches.length === 0 && parsed.debtor_email) {
          matches = debtorsList.filter(d => 
            d.primary_email?.toLowerCase() === parsed.debtor_email.toLowerCase() ||
            d.email?.toLowerCase() === parsed.debtor_email.toLowerCase()
          );
        }
        if (matches.length === 0 && parsed.debtor_email) {
          const emailLower = parsed.debtor_email.toLowerCase();
          matches = debtorsList.filter(d => d.email?.toLowerCase() === emailLower);
        }

        // If no email match, try company name
        if (matches.length === 0 && parsed.debtor_company_name) {
          const companyLower = parsed.debtor_company_name.toLowerCase();
          matches = debtorsList.filter(d => d.company_name?.toLowerCase() === companyLower);
        }

        // Set match status
        if (matches.length === 0) {
          parsed.match_status = 'None';
          parsed.matched_debtor_name = '-';
          parsed.matched_debtor_ref_id = '-';
          noMatches++;
        } else if (matches.length === 1) {
          parsed.match_status = 'Unique';
          parsed.matched_debtor_name = matches[0].name;
          parsed.matched_debtor_ref_id = matches[0].reference_id;
          validMatches++;
        } else {
          parsed.match_status = 'Multiple';
          parsed.matched_debtor_name = `${matches.length} matches found`;
          parsed.matched_debtor_ref_id = '-';
          multipleMatches++;
        }

        return parsed;
      });

      setPreviewData(parsedRows);
      setImportSummary({ 
        total: dataRows.length, 
        errors, 
        warnings,
        validMatches,
        noMatches,
        multipleMatches
      });
      toast.success(`Preview loaded: ${validMatches} valid matches, ${noMatches} no matches, ${multipleMatches} multiple matches`);
    } catch (error: any) {
      toast.error(`Failed to parse file: ${error.message}`);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const importInvoicesFromFile = async () => {
    if (!importFile) return;

    setIsImporting(true);
    try {
      const rows = await parseImportFile(importFile, hasHeaderRow);
      const headers = hasHeaderRow ? rows[0] : [];
      const dataRows = hasHeaderRow ? rows.slice(1) : rows;

      const headerMap: any = {};
      headers.forEach((header: string, index: number) => {
        // Normalize by removing asterisks, parentheses content, and trimming
        const normalized = header
          .toLowerCase()
          .replace(/\*/g, '')
          .replace(/\s*\([^)]*\)/g, '')
          .trim()
          .replace(/\s+/g, '_');
        headerMap[normalized] = index;
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get all debtors and CRM accounts for this user
      const [debtorsRes, crmAccountsRes] = await Promise.all([
        supabase
          .from('debtors')
          .select('id, reference_id, name, email, primary_email, external_customer_id, company_name, crm_account_id')
          .eq('user_id', user.id),
        supabase
          .from('crm_accounts')
          .select('id, crm_account_id, name')
          .eq('user_id', user.id)
      ]);

      if (!debtorsRes.data || debtorsRes.data.length === 0) {
        toast.error('No debtors found. Please create debtors first before importing invoices.');
        setIsImporting(false);
        return;
      }

      const debtors = debtorsRes.data;
      const crmAccounts = crmAccountsRes.data || [];

      let inserted = 0;
      let skippedNoMatch = 0;
      let skippedValidation = 0;

      for (const row of dataRows) {
        try {
          const invoiceData: any = {
            invoice_number: row[headerMap['invoice_number']]?.toString().trim() || '',
            amount: parseFloat(row[headerMap['amount']]?.toString().trim() || '0'),
            currency: row[headerMap['currency']]?.toString().trim() || 'USD',
            issue_date: row[headerMap['issue_date']]?.toString().trim() || '',
            due_date: row[headerMap['due_date']]?.toString().trim() || '',
            status: row[headerMap['status']]?.toString().trim() || 'Open',
            external_link: row[headerMap['external_link']]?.toString().trim() || null,
            notes: row[headerMap['notes']]?.toString().trim() || null,
          };

          // Validate required fields
          if (!invoiceData.invoice_number || isNaN(invoiceData.amount) || !invoiceData.issue_date || !invoiceData.due_date) {
            skippedValidation++;
            continue;
          }

          // Validate dates
          if (isNaN(Date.parse(invoiceData.issue_date)) || isNaN(Date.parse(invoiceData.due_date))) {
            skippedValidation++;
            continue;
          }

          // Find matching debtor - prioritize reference_id > external_customer_id > primary_email > email > company_name
          const debtorRefId = row[headerMap['debtor_reference_id']]?.toString().trim();
          const debtorExternalId = row[headerMap['debtor_external_customer_id']]?.toString().trim();
          const debtorEmail = row[headerMap['debtor_email']]?.toString().trim().toLowerCase();
          const debtorCompany = row[headerMap['debtor_company_name']]?.toString().trim().toLowerCase();

          let matches = [];
          
          // First try reference_id match (most reliable)
          if (debtorRefId) {
            matches = debtors.filter(d => d.reference_id === debtorRefId);
          }
          
          // If no reference_id match, try external_customer_id
          if (matches.length === 0 && debtorExternalId) {
            matches = debtors.filter(d => d.external_customer_id === debtorExternalId);
          }
          
          // If no match yet, try email (primary_email or email)
          if (matches.length === 0 && debtorEmail) {
            matches = debtors.filter(d => 
              d.primary_email?.toLowerCase() === debtorEmail ||
              d.email?.toLowerCase() === debtorEmail
            );
          }
          
          // If no email match, try company name
          if (matches.length === 0 && debtorCompany) {
            matches = debtors.filter(d => d.company_name?.toLowerCase() === debtorCompany);
          }

          // Only proceed if we have exactly one match
          if (matches.length !== 1) {
            skippedNoMatch++;
            continue;
          }

          const matchedDebtor = matches[0];
          invoiceData.debtor_id = matchedDebtor.id;

          // Validate status
          const validStatuses = ['Open', 'Paid', 'Disputed', 'Settled', 'InPaymentPlan', 'Canceled'];
          if (!validStatuses.includes(invoiceData.status)) {
            invoiceData.status = 'Open';
          }

          // Insert invoice
          const { error } = await supabase
            .from('invoices')
            .insert({ ...invoiceData, user_id: user.id } as any);

          if (error) throw error;
          inserted++;

          // Handle CRM account linking if crm_account_external_id is present
          const crmExternalId = row[headerMap['crm_account_external_id']]?.toString().trim();
          if (crmExternalId && !matchedDebtor.crm_account_id) {
            const matchedCrmAccount = crmAccounts.find(
              acc => acc.crm_account_id === crmExternalId
            );
            
            if (matchedCrmAccount) {
              // Update debtor with CRM account link
              await supabase
                .from('debtors')
                .update({ crm_account_id: matchedCrmAccount.id })
                .eq('id', matchedDebtor.id);
            }
          }
        } catch (error) {
          console.error('Error processing invoice row:', error);
          skippedValidation++;
        }
      }

      toast.success(`Import complete: ${inserted} created, ${skippedNoMatch} skipped (no unique match), ${skippedValidation} skipped (validation errors)`);
      setIsImportOpen(false);
      setImportFile(null);
      setPreviewData(null);
      setImportSummary(null);
      fetchData();
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

      const { error } = await supabase.from("invoices").insert({
        user_id: user.id,
        debtor_id: formData.debtor_id,
        invoice_number: formData.invoice_number,
        amount: parseFloat(formData.amount),
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        notes: formData.notes || null,
        status: "Open",
      } as any);

      if (error) throw error;
      toast.success("Invoice created successfully");
      setIsCreateOpen(false);
      setFormData({
        debtor_id: "",
        invoice_number: "",
        amount: "",
        issue_date: new Date().toISOString().split("T")[0],
        due_date: "",
        notes: "",
      });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to create invoice");
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Open: "bg-yellow-100 text-yellow-800",
      Paid: "bg-green-100 text-green-800",
      Disputed: "bg-red-100 text-red-800",
      Settled: "bg-blue-100 text-blue-800",
      InPaymentPlan: "bg-purple-100 text-purple-800",
      Canceled: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
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
            <h1 className="text-4xl font-bold text-primary">Invoices</h1>
            <p className="text-muted-foreground mt-2">Track and manage outstanding invoices</p>
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
                  Import Invoices
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsImportOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import from File
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadInvoicesTemplate('csv')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Download Invoices Template (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadInvoicesTemplate('excel')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download Invoices Template (Excel)
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
                  New Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Invoice</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Note:</strong> Every invoice must be linked to a debtor. If the debtor doesn't exist yet, create them first in the <a href="/debtors" className="text-primary hover:underline font-medium">Debtors page</a>.
                    </AlertDescription>
                  </Alert>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="debtor_id">Debtor * <span className="text-xs text-muted-foreground">(Required - invoices cannot exist without a debtor)</span></Label>
                      <div className="flex gap-2">
                        <Select
                          value={formData.debtor_id}
                          onValueChange={(value) =>
                            setFormData({ ...formData, debtor_id: value })
                          }
                          required
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select debtor" />
                          </SelectTrigger>
                          <SelectContent>
                            {debtors.map((debtor) => (
                              <SelectItem key={debtor.id} value={debtor.id}>
                                {debtor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => window.open('/debtors', '_blank')}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          New Debtor
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoice_number">Invoice Number *</Label>
                      <Input
                        id="invoice_number"
                        value={formData.invoice_number}
                        onChange={(e) =>
                          setFormData({ ...formData, invoice_number: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({ ...formData, amount: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="issue_date">Issue Date *</Label>
                      <Input
                        id="issue_date"
                        type="date"
                        value={formData.issue_date}
                        onChange={(e) =>
                          setFormData({ ...formData, issue_date: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="due_date">Due Date *</Label>
                      <Input
                        id="due_date"
                        type="date"
                        value={formData.due_date}
                        onChange={(e) =>
                          setFormData({ ...formData, due_date: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Invoice</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by reference ID, invoice #, or debtor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Disputed">Disputed</SelectItem>
                  <SelectItem value="Settled">Settled</SelectItem>
                  <SelectItem value="InPaymentPlan">In Payment Plan</SelectItem>
                  <SelectItem value="Canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ageBucketFilter} onValueChange={setAgeBucketFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Age" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ages</SelectItem>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="0-30">0-30 Days</SelectItem>
                  <SelectItem value="31-60">31-60 Days</SelectItem>
                  <SelectItem value="61-90">61-90 Days</SelectItem>
                  <SelectItem value="90+">90+ Days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={debtorFilter} onValueChange={setDebtorFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Debtor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Debtors</SelectItem>
                  {debtors.map((debtor) => (
                    <SelectItem key={debtor.id} value={debtor.id}>
                      {debtor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedInvoices.length > 0 && (
              <div className="flex gap-2 mt-4">
                <span className="text-sm text-muted-foreground py-2">
                  {selectedInvoices.length} selected
                </span>
                <Button
                  variant="outline"
                  onClick={() => setShowBulkAssignDialog(true)}
                >
                  Assign to Workflow
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBulkUnassign}
                >
                  Remove from Workflow
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedInvoices([])}
                >
                  Clear
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {filteredInvoices.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {invoices.length === 0
                    ? "No invoices yet. Create your first invoice to get started."
                    : "No invoices match your filters."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredInvoices.length > 0 && selectedInvoices.length === filteredInvoices.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedInvoices(filteredInvoices.map(inv => inv.id));
                          } else {
                            setSelectedInvoices([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Reference ID</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Debtor</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Past Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>AI Workflow</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const daysPastDue = getDaysPastDue(invoice.due_date);
                    const ageBucket = getAgeBucket(daysPastDue);
                    const activeWorkflow = invoice.ai_workflows?.find(w => w.is_active);
                    
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedInvoices.includes(invoice.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedInvoices([...selectedInvoices, invoice.id]);
                              } else {
                                setSelectedInvoices(selectedInvoices.filter(id => id !== invoice.id));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{invoice.reference_id}</TableCell>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{invoice.debtors?.name}</TableCell>
                        <TableCell className="text-right">${invoice.amount.toLocaleString()}</TableCell>
                        <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              daysPastDue === 0
                                ? "bg-green-100 text-green-800"
                                : daysPastDue <= 30
                                ? "bg-yellow-100 text-yellow-800"
                                : daysPastDue <= 60
                                ? "bg-orange-100 text-orange-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {daysPastDue === 0 ? "Current" : `${daysPastDue} days`}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                              invoice.status
                            )}`}
                          >
                            {invoice.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {activeWorkflow ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                {ageBucket} days
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveFromWorkflow(invoice.id, activeWorkflow.id)}
                                className="h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {invoice.last_contact_date
                            ? new Date(invoice.last_contact_date).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/invoices/${invoice.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Google Sheets Instructions Modal */}
        <Dialog open={isGoogleSheetsOpen} onOpenChange={setIsGoogleSheetsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Google Sheets Template Instructions</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Follow these steps to use Google Sheets with the Invoices import template:
              </p>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Required Fields (marked with *):</strong>
                  <ul className="list-disc list-inside mt-2 text-sm">
                    <li><strong>invoice_number*</strong> - Unique invoice identifier</li>
                    <li><strong>debtor_email*</strong> OR <strong>debtor_company_name*</strong> - Must match an existing debtor in your system</li>
                    <li><strong>amount*</strong> - Invoice total (numeric, e.g., 15000.00)</li>
                    <li><strong>issue_date*</strong> - Format: YYYY-MM-DD (e.g., 2025-01-15)</li>
                    <li><strong>due_date*</strong> - Format: YYYY-MM-DD (e.g., 2025-02-15)</li>
                  </ul>
                  <p className="mt-2 text-xs">Note: Reference ID is auto-generated and should not be included in import.</p>
                </AlertDescription>
              </Alert>
              
              <ol className="list-decimal list-inside space-y-3 text-sm">
                <li>
                  <strong>Download the template:</strong> Click the button below to download the Invoices template as a CSV file with instructions.
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
                  <strong>Fill in your data:</strong> Delete the instruction rows and add your invoice information. Ensure all required fields (marked with *) are filled. Debtor email or company name must match existing debtors.
                </li>
                <li>
                  <strong>Export as CSV:</strong> When you're done, go to "File" → "Download" → "Comma-separated values (.csv)" to export your sheet.
                </li>
                <li>
                  <strong>Import to the app:</strong> Use the "Import Invoices" → "Import from File" option and select your exported CSV file. Preview will show which rows match existing debtors.
                </li>
              </ol>
              <div className="flex gap-2 pt-4">
                <Button onClick={() => {
                  downloadInvoicesTemplate('csv');
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

        {/* Import Invoices Modal */}
        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Import Invoices</DialogTitle>
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
                onClick={previewInvoicesImport}
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

              {/* Summary Stats */}
              {importSummary && importSummary.validMatches !== undefined && (
                <Alert>
                  <AlertDescription>
                    <div className="font-semibold mb-1">Match Summary:</div>
                    <div className="text-sm">
                      <div>✓ {importSummary.validMatches} rows with unique debtor matches (will be imported)</div>
                      <div>⚠ {importSummary.noMatches} rows with no debtor match (will be skipped)</div>
                      <div>⚠ {importSummary.multipleMatches} rows with multiple matches (will be skipped)</div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Note: Only rows with a unique debtor match and valid data will be imported. Others will be skipped.
                    </div>
                  </AlertDescription>
                </Alert>
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
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Debtor Email</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Issue Date</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Match Status</TableHead>
                          <TableHead>Matched Debtor</TableHead>
                          <TableHead>Debtor Ref ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row, idx) => (
                          <TableRow key={idx} className={row.match_status !== 'Unique' ? 'bg-muted/50' : ''}>
                            <TableCell>{row._rowIndex}</TableCell>
                            <TableCell>{row.invoice_number}</TableCell>
                            <TableCell>{row.debtor_email || '-'}</TableCell>
                            <TableCell>{row.debtor_company_name || '-'}</TableCell>
                            <TableCell>{row.currency} {row.amount}</TableCell>
                            <TableCell>{row.issue_date}</TableCell>
                            <TableCell>{row.due_date}</TableCell>
                            <TableCell>{row.status}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                row.match_status === 'Unique' ? 'bg-green-100 text-green-800' :
                                row.match_status === 'Multiple' ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {row.match_status}
                              </span>
                            </TableCell>
                            <TableCell>{row.matched_debtor_name}</TableCell>
                            <TableCell className="font-mono text-xs">{row.matched_debtor_ref_id || '-'}</TableCell>
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
                        onClick={importInvoicesFromFile}
                        disabled={isImporting || (importSummary.validMatches === 0)}
                      >
                        {isImporting ? 'Importing...' : `Import ${importSummary.validMatches} Valid Row${importSummary.validMatches !== 1 ? 's' : ''}`}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <AIPromptCreationModal
          open={isAIPromptOpen}
          onOpenChange={setIsAIPromptOpen}
          onSuccess={fetchData}
        />

        <Dialog open={showBulkAssignDialog} onOpenChange={setShowBulkAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign to Workflow</DialogTitle>
              <DialogDescription>
                Select which aging bucket workflow to assign the {selectedInvoices.length} selected invoice(s) to.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="aging-bucket">Aging Bucket</Label>
              <Select value={selectedAgingBucket} onValueChange={setSelectedAgingBucket}>
                <SelectTrigger id="aging-bucket">
                  <SelectValue placeholder="Select aging bucket" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current (Not Past Due)</SelectItem>
                  <SelectItem value="dpd_1_30">1-30 Days Past Due</SelectItem>
                  <SelectItem value="dpd_31_60">31-60 Days Past Due</SelectItem>
                  <SelectItem value="dpd_61_90">61-90 Days Past Due</SelectItem>
                  <SelectItem value="dpd_91_120">91-120 Days Past Due</SelectItem>
                  <SelectItem value="dpd_121_plus">121+ Days Past Due</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkAssignDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkAssign}>
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Invoices;
