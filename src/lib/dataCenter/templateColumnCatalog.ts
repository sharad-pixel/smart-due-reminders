/**
 * Catalog of columns and sub-sheets available per Data Center sheet template.
 * Used by TemplateColumnsDialog (UI) and the push edge function (filtering).
 *
 * Column keys MUST match the header strings emitted by
 * `supabase/functions/google-sheets-push-template/index.ts`.
 */

export interface TemplateColumnDef {
  key: string;        // Exact header string from the push function
  label: string;      // Friendly label shown in UI
  group?: string;     // Optional grouping for the UI
  required?: boolean; // Cannot be unchecked
}

export interface TemplateObjectDef {
  key: string;          // Sub-sheet key e.g. 'master','risks'
  label: string;        // Friendly label shown in UI
  sheetTitle: string;   // Google Sheet tab title used in push function
  description?: string;
  required?: boolean;
  columns: TemplateColumnDef[];
}

export interface TemplateCatalogEntry {
  type: 'accounts' | 'invoices' | 'payments' | 'contracts';
  label: string;
  description: string;
  objects: TemplateObjectDef[];
}

const ACCOUNT_COLS: TemplateColumnDef[] = [
  { key: 'RAID', label: 'RAID', required: true },
  { key: 'Company Name', label: 'Company Name', required: true },
  { key: 'Type (B2B/B2C)', label: 'Type (B2B/B2C)' },
  { key: 'Contact Name', label: 'Contact Name' },
  { key: 'Contact Email', label: 'Contact Email' },
  { key: 'Contact Phone', label: 'Contact Phone' },
  { key: 'Address Line 1', label: 'Address Line 1' },
  { key: 'Address Line 2', label: 'Address Line 2' },
  { key: 'City', label: 'City' },
  { key: 'State', label: 'State' },
  { key: 'Postal Code', label: 'Postal Code' },
  { key: 'Country', label: 'Country' },
  { key: 'Industry', label: 'Industry' },
  { key: 'External Customer ID', label: 'External Customer ID' },
  { key: 'CRM ID', label: 'CRM ID' },
  { key: 'Default Payment Terms', label: 'Default Payment Terms' },
  { key: 'Notes', label: 'Notes' },
  { key: 'Current Balance', label: 'Current Balance' },
  { key: 'Source', label: 'Source' },
  { key: 'Risk Score', label: 'Risk Score' },
  { key: 'Risk Tier', label: 'Risk Tier' },
];

const INVOICE_COLS: TemplateColumnDef[] = [
  { key: 'Account RAID', label: 'Account RAID', required: true },
  { key: 'Account Name', label: 'Account Name', required: true },
  { key: 'SS Invoice #', label: 'SS Invoice #', required: true },
  { key: 'Original Amount', label: 'Original Amount' },
  { key: 'Amount Outstanding', label: 'Amount Outstanding' },
  { key: 'Currency', label: 'Currency' },
  { key: 'Issue Date', label: 'Issue Date' },
  { key: 'Due Date', label: 'Due Date' },
  { key: 'Status', label: 'Status' },
  { key: 'PO Number', label: 'PO Number' },
  { key: 'Product/Description', label: 'Product / Description' },
  { key: 'Payment Terms', label: 'Payment Terms' },
  { key: 'Paid Date', label: 'Paid Date' },
  { key: 'Notes', label: 'Notes' },
  { key: 'Recouply Invoice Ref (DO NOT EDIT)', label: 'Recouply Invoice Ref', required: true },
  { key: 'Source', label: 'Source' },
];

const PAYMENT_TEMPLATE_COLS: TemplateColumnDef[] = [
  { key: 'Account RAID', label: 'Account RAID', required: true },
  { key: 'Account Name', label: 'Account Name', required: true },
  { key: 'SS Invoice #', label: 'SS Invoice #' },
  { key: 'Recouply Invoice Ref (DO NOT EDIT)', label: 'Recouply Invoice Ref', required: true },
  { key: 'Line #', label: 'Line #' },
  { key: 'Line Type', label: 'Line Type' },
  { key: 'Line Description', label: 'Line Description' },
  { key: 'Line Amount', label: 'Line Amount' },
  { key: 'Invoice Total Outstanding', label: 'Invoice Total Outstanding' },
  { key: 'Currency', label: 'Currency' },
  { key: 'Payment Amount', label: 'Payment Amount', required: true },
  { key: 'Payment Reference', label: 'Payment Reference' },
  { key: 'Payment Date', label: 'Payment Date', required: true },
  { key: 'Recouply Payment Ref (DO NOT EDIT)', label: 'Recouply Payment Ref' },
  { key: 'Source', label: 'Source' },
];

const CONTRACT_MASTER_COLS: TemplateColumnDef[] = [
  { key: 'Recouply Contract Ref (DO NOT EDIT)', label: 'Recouply Contract Ref', required: true, group: 'Identity' },
  { key: 'Contract Name', label: 'Contract Name', required: true, group: 'Identity' },
  { key: 'File Name', label: 'File Name', group: 'Identity' },
  { key: 'Contract Type', label: 'Contract Type', group: 'Identity' },
  { key: 'Status', label: 'Status', group: 'Identity' },
  { key: 'Staging Status', label: 'Staging Status', group: 'Identity' },
  { key: 'Account RAID', label: 'Account RAID', group: 'Customer' },
  { key: 'Account Name', label: 'Account Name', group: 'Customer' },
  { key: 'Industry', label: 'Industry', group: 'Customer' },
  { key: 'Counterparty', label: 'Counterparty', group: 'Customer' },
  { key: 'Contract Value', label: 'Contract Value', group: 'Commercial' },
  { key: 'Currency', label: 'Currency', group: 'Commercial' },
  { key: 'Effective Date', label: 'Effective Date', group: 'Term' },
  { key: 'Term End Date', label: 'Term End Date', group: 'Term' },
  { key: 'Term (Months)', label: 'Term (Months)', group: 'Term' },
  { key: 'MRR', label: 'MRR', group: 'Metrics' },
  { key: 'ARR', label: 'ARR', group: 'Metrics' },
  { key: 'ACV', label: 'ACV', group: 'Metrics' },
  { key: 'TCV', label: 'TCV', group: 'Metrics' },
  { key: 'Recurring TCV', label: 'Recurring TCV', group: 'Metrics' },
  { key: 'Services TCV', label: 'Services TCV', group: 'Metrics' },
  { key: 'One-time TCV', label: 'One-time TCV', group: 'Metrics' },
  { key: 'Payment Terms', label: 'Payment Terms', group: 'Billing' },
  { key: 'Billing Frequency', label: 'Billing Frequency', group: 'Billing' },
  { key: 'Auto Renewal', label: 'Auto Renewal', group: 'Renewal' },
  { key: 'Renewal Term', label: 'Renewal Term', group: 'Renewal' },
  { key: 'Notice Period', label: 'Notice Period', group: 'Renewal' },
  { key: 'Primary Contract Ref', label: 'Primary Contract Ref', group: 'Hierarchy' },
  { key: 'Link Type to Primary', label: 'Link Type to Primary', group: 'Hierarchy' },
  { key: 'High/Critical Risks', label: 'High/Critical Risks', group: 'Risk' },
  { key: 'Medium Risks', label: 'Medium Risks', group: 'Risk' },
  { key: 'Total Risks', label: 'Total Risks', group: 'Risk' },
  { key: 'Readiness: Fully Executed', label: 'Readiness: Fully Executed', group: 'Readiness' },
  { key: 'Readiness: Terms', label: 'Readiness: Terms', group: 'Readiness' },
  { key: 'Readiness: Performance Obligations', label: 'Readiness: Performance Obligations', group: 'Readiness' },
  { key: 'Readiness: Term Dates', label: 'Readiness: Term Dates', group: 'Readiness' },
  { key: 'Readiness: Risk Factors', label: 'Readiness: Risk Factors', group: 'Readiness' },
  { key: 'Readiness %', label: 'Readiness %', group: 'Readiness' },
  { key: 'Schedule Lines Count', label: 'Schedule Lines Count', group: 'Rollups' },
  { key: 'Critical Dates Count', label: 'Critical Dates Count', group: 'Rollups' },
  { key: 'AI Confidence', label: 'AI Confidence', group: 'Meta' },
  { key: 'Product/Description', label: 'Product / Description', group: 'Meta' },
  { key: 'Created At', label: 'Created At', group: 'Meta' },
  { key: 'Updated At', label: 'Updated At', group: 'Meta' },
  { key: 'Published At', label: 'Published At', group: 'Meta' },
];

const CONTRACT_SCHEDULE_COLS: TemplateColumnDef[] = [
  { key: 'Recouply Contract Ref', label: 'Contract Ref', required: true },
  { key: 'Contract Name', label: 'Contract Name' },
  { key: 'Account Name', label: 'Account Name' },
  { key: 'Line #', label: 'Line #' },
  { key: 'Scheduled Date', label: 'Scheduled Date' },
  { key: 'Expected Due Date', label: 'Expected Due Date' },
  { key: 'Service Start', label: 'Service Start' },
  { key: 'Service End', label: 'Service End' },
  { key: 'Amount', label: 'Amount' },
  { key: 'Currency', label: 'Currency' },
  { key: 'Billing Type', label: 'Billing Type' },
  { key: 'Description', label: 'Description' },
  { key: 'Payment Terms', label: 'Payment Terms' },
  { key: 'Status', label: 'Status' },
];

const CONTRACT_RISK_COLS: TemplateColumnDef[] = [
  { key: 'Recouply Contract Ref', label: 'Contract Ref', required: true },
  { key: 'Contract Name', label: 'Contract Name' },
  { key: 'Account Name', label: 'Account Name' },
  { key: 'Flag Type', label: 'Flag Type' },
  { key: 'Severity', label: 'Severity' },
  { key: 'Resolved', label: 'Resolved' },
  { key: 'Description', label: 'Description' },
  { key: 'Source', label: 'Source' },
  { key: 'Created At', label: 'Created At' },
];

const CONTRACT_DATE_COLS: TemplateColumnDef[] = [
  { key: 'Recouply Contract Ref', label: 'Contract Ref', required: true },
  { key: 'Contract Name', label: 'Contract Name' },
  { key: 'Account Name', label: 'Account Name' },
  { key: 'Date Type', label: 'Date Type' },
  { key: 'Due Date', label: 'Due Date' },
  { key: 'Status', label: 'Status' },
  { key: 'Risk Level', label: 'Risk Level' },
  { key: 'Notice Days', label: 'Notice Days' },
  { key: 'Alert Enabled', label: 'Alert Enabled' },
  { key: 'Alert Lead Days', label: 'Alert Lead Days' },
];

const CONTRACT_LINK_COLS: TemplateColumnDef[] = [
  { key: 'Primary Contract Ref', label: 'Primary Contract Ref', required: true },
  { key: 'Primary Contract Name', label: 'Primary Contract Name' },
  { key: 'Linked Contract Ref', label: 'Linked Contract Ref', required: true },
  { key: 'Linked Contract Name', label: 'Linked Contract Name' },
  { key: 'Link Type', label: 'Link Type' },
  { key: 'Notes', label: 'Notes' },
  { key: 'Created At', label: 'Created At' },
];

export const TEMPLATE_CATALOG: TemplateCatalogEntry[] = [
  {
    type: 'accounts',
    label: 'Accounts',
    description: 'Customer accounts with RAID, contacts, and balances.',
    objects: [
      { key: 'master', label: 'Accounts', sheetTitle: 'Accounts', required: true, columns: ACCOUNT_COLS },
    ],
  },
  {
    type: 'invoices',
    label: 'Invoices',
    description: 'Open + Paid invoices across two tabs.',
    objects: [
      { key: 'open', label: 'Open Invoices', sheetTitle: 'Open Invoices', required: true, columns: INVOICE_COLS },
      { key: 'paid', label: 'Paid Invoices', sheetTitle: 'Paid Invoices', columns: INVOICE_COLS },
    ],
  },
  {
    type: 'payments',
    label: 'Payments',
    description: 'Pre-populated reconciliation template + recorded payments log.',
    objects: [
      { key: 'template', label: 'Payment Template', sheetTitle: 'Payment Template', required: true, columns: PAYMENT_TEMPLATE_COLS },
      { key: 'recorded', label: 'Recorded Payments', sheetTitle: 'Recorded Payments', columns: [
        { key: 'Account RAID', label: 'Account RAID', required: true },
        { key: 'Account Name', label: 'Account Name' },
        { key: 'SS Invoice #', label: 'SS Invoice #' },
        { key: 'Recouply Invoice Ref (DO NOT EDIT)', label: 'Recouply Invoice Ref' },
        { key: 'Payment Amount', label: 'Payment Amount' },
        { key: 'Payment Reference', label: 'Payment Reference' },
        { key: 'Payment Date', label: 'Payment Date' },
        { key: 'Source', label: 'Source' },
      ]},
    ],
  },
  {
    type: 'contracts',
    label: 'Contracts',
    description: 'Master contract data plus performance obligations, risks, key dates, and link hierarchy.',
    objects: [
      { key: 'master', label: 'Contracts Master', sheetTitle: 'Contracts', required: true, columns: CONTRACT_MASTER_COLS, description: 'One row per contract with metrics, readiness checklist, and rollups.' },
      { key: 'schedules', label: 'Performance Obligations', sheetTitle: 'Performance Obligations', columns: CONTRACT_SCHEDULE_COLS, description: 'AI-extracted billing schedule and obligation lines.' },
      { key: 'risks', label: 'Risk Flags', sheetTitle: 'Risk Flags', columns: CONTRACT_RISK_COLS, description: 'Detected risk factors with severity.' },
      { key: 'dates', label: 'Key Dates', sheetTitle: 'Key Dates', columns: CONTRACT_DATE_COLS, description: 'Renewal, termination, milestones.' },
      { key: 'links', label: 'Linked Contracts', sheetTitle: 'Linked Contracts', columns: CONTRACT_LINK_COLS, description: 'Primary / supplemental / supersession relationships.' },
    ],
  },
];

export const getCatalogEntry = (type: string): TemplateCatalogEntry | undefined =>
  TEMPLATE_CATALOG.find((e) => e.type === type);

/**
 * Column-config shape persisted in `google_sheet_templates.column_config`.
 * Empty object means "include everything" (default behavior).
 */
export interface TemplateColumnConfig {
  /** Sub-sheet keys to include. If omitted, all required + all defaults are included. */
  objects?: string[];
  /** Per-sub-sheet column whitelist. If omitted for a key, all columns are included. */
  columns?: Record<string, string[]>;
}
