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
import { Plus, Search, Eye, Upload, FileSpreadsheet, FileText, HelpCircle, ChevronDown, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as XLSX from 'xlsx';

interface Debtor {
  id: string;
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
      'debtor_name',
      'debtor_email',
      'debtor_phone',
      'debtor_company_name',
      'debtor_type',
      'notes',
      'crm_account_name',
      'crm_account_external_id',
      'tags'
    ];
    
    const exampleRows = [
      [
        'John Smith',
        'john.smith@acmecorp.com',
        '+1-555-0123',
        'Acme Corporation',
        'B2B',
        'High-value client, preferred payment terms',
        'Acme Corp',
        'SF_ACC_001234',
        'VIP,Overdue'
      ],
      [
        'Jane Doe',
        'jane.doe@techstart.io',
        '+1-555-0456',
        'TechStart Inc',
        'B2B',
        'Net 30 payment terms',
        'TechStart',
        'SF_ACC_005678',
        'New,Priority'
      ]
    ];
    
    if (format === 'csv') {
      let csvContent = headers.join(',') + '\n';
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
      toast.success('CSV template downloaded');
    } else {
      // Generate Excel file
      const wsData = [headers, ...exampleRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Debtors Template');
      XLSX.writeFile(wb, 'debtors_template.xlsx');
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

      // Normalize header names
      const headerMap: any = {};
      headers.forEach((header: string, index: number) => {
        const normalized = header.toLowerCase().trim();
        headerMap[normalized] = index;
      });

      // Validate required columns
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!headerMap['debtor_name'] && !headerMap['name']) {
        errors.push('Missing required column: debtor_name');
      }
      
      const hasEmail = headerMap['debtor_email'] || headerMap['email'];
      const hasPhone = headerMap['debtor_phone'] || headerMap['phone'];
      
      if (!hasEmail && !hasPhone) {
        errors.push('Missing required contact method: must have debtor_email OR debtor_phone');
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
          debtor_email: row[headerMap['debtor_email'] || headerMap['email']]?.toString().trim() || '',
          debtor_phone: row[headerMap['debtor_phone'] || headerMap['phone']]?.toString().trim() || '',
          debtor_company_name: row[headerMap['debtor_company_name'] || headerMap['company_name']]?.toString().trim() || '',
          debtor_type: row[headerMap['debtor_type'] || headerMap['type']]?.toString().trim() || '',
          notes: row[headerMap['notes']]?.toString().trim() || '',
          crm_account_name: row[headerMap['crm_account_name']]?.toString().trim() || '',
          crm_account_external_id: row[headerMap['crm_account_external_id']]?.toString().trim() || '',
          tags: row[headerMap['tags']]?.toString().trim() || '',
        };

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
        const normalized = header.toLowerCase().trim();
        headerMap[normalized] = index;
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get existing debtors for this user
      const { data: existingDebtors } = await supabase
        .from('debtors')
        .select('id, email')
        .eq('user_id', user.id);

      const existingDebtorsMap = new Map(
        existingDebtors?.map(d => [d.email.toLowerCase(), d.id]) || []
      );

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
          const debtorData: any = {
            name: row[headerMap['debtor_name'] || headerMap['name']]?.toString().trim() || '',
            email: row[headerMap['debtor_email'] || headerMap['email']]?.toString().trim() || '',
            phone: row[headerMap['debtor_phone'] || headerMap['phone']]?.toString().trim() || null,
            company_name: row[headerMap['debtor_company_name'] || headerMap['company_name']]?.toString().trim() || '',
            contact_name: row[headerMap['debtor_name'] || headerMap['name']]?.toString().trim() || '',
            type: (row[headerMap['debtor_type'] || headerMap['type']]?.toString().trim().toUpperCase() || 'B2C') as 'B2B' | 'B2C',
            notes: row[headerMap['notes']]?.toString().trim() || null,
            address: null,
            tags: row[headerMap['tags']]?.toString().trim() ? row[headerMap['tags']].split(',').map((t: string) => t.trim()) : null,
          };

          // Validate required fields
          if (!debtorData.name || (!debtorData.email && !debtorData.phone)) {
            skipped++;
            continue;
          }

          // Validate type
          if (!['B2B', 'B2C'].includes(debtorData.type)) {
            debtorData.type = 'B2C';
          }

          // Try to link CRM account
          const crmExternalId = row[headerMap['crm_account_external_id']]?.toString().trim();
          const crmName = row[headerMap['crm_account_name']]?.toString().trim();

          if (crmExternalId && crmAccounts) {
            const matchingAccount = crmAccounts.find(acc => acc.crm_account_id === crmExternalId);
            if (matchingAccount) {
              debtorData.crm_account_id = matchingAccount.id;
            }
          } else if (crmName && crmAccounts) {
            const matchingAccounts = crmAccounts.filter(acc => 
              acc.name.toLowerCase() === crmName.toLowerCase()
            );
            if (matchingAccounts.length === 1) {
              debtorData.crm_account_id = matchingAccounts[0].id;
            }
          }

          // Check if debtor exists
          const existingId = debtorData.email ? existingDebtorsMap.get(debtorData.email.toLowerCase()) : null;

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
              .insert({ ...debtorData, user_id: user.id });

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
      });

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
                <DialogTitle>Create New Debtor</DialogTitle>
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
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{row._rowIndex}</TableCell>
                            <TableCell>{row.debtor_name}</TableCell>
                            <TableCell>{row.debtor_email || '-'}</TableCell>
                            <TableCell>{row.debtor_phone || '-'}</TableCell>
                            <TableCell>{row.debtor_company_name}</TableCell>
                            <TableCell>{row.debtor_type || 'B2C'}</TableCell>
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
                  placeholder="Search by name, company, or email..."
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
      </div>
    </Layout>
  );
};

export default Debtors;
