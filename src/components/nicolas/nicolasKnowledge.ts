import { generateNicolasKnowledgeBase, NicolasKnowledgeEntry } from "@/lib/knowledgeBaseData";

// Generate knowledge base from centralized FAQ data
const FAQ_KNOWLEDGE_BASE = generateNicolasKnowledgeBase();

// Additional contextual knowledge base entries specific to Nicolas
const CONTEXTUAL_KNOWLEDGE_BASE: NicolasKnowledgeEntry[] = [
  // ===== DATA CENTER PROCESSES =====
  {
    keywords: ["data center", "import", "upload", "csv", "excel", "bulk import"],
    answer: "The Data Center is your central hub for importing Accounts, Invoices, and Payments. You can upload CSV or Excel files, map columns to our standard fields, and review matches before finalizing. Start by choosing what type of data you want to import.",
    confidence: 0.95,
    links: [
      { label: "Open Data Center", path: "/data-center" }
    ]
  },
  {
    keywords: ["upload accounts", "import accounts", "accounts upload", "customer upload", "bulk accounts"],
    answer: "To upload accounts: 1) Go to Data Center and click 'Accounts', 2) Download our template or upload your own file, 3) Map your columns to our standard fields (Company Name, Email, Phone are key), 4) Review the preview and submit. Each account gets a Recouply Account ID (RID) for future invoice/payment mapping.",
    confidence: 0.95,
    links: [
      { label: "Upload Accounts", path: "/data-center" }
    ]
  },
  {
    keywords: ["upload invoices", "import invoices", "invoices upload", "bulk invoices"],
    answer: "To upload invoices: 1) Go to Data Center and click 'Invoices', 2) Download our template which includes required fields, 3) Include the Recouply Account ID to link invoices to accounts, 4) Map columns like Invoice Number, Amount, Due Date, 5) Review and submit. AI workflows auto-trigger for aging invoices.",
    confidence: 0.95,
    links: [
      { label: "Upload Invoices", path: "/data-center" }
    ]
  },
  {
    keywords: ["upload payments", "import payments", "payments upload", "bulk payments", "payment import"],
    answer: "To upload payments: 1) Go to Data Center and click 'Payments', 2) Download our template, 3) Include Recouply Account ID and Recouply Invoice ID to match payments to invoices, 4) Map Payment Amount, Payment Date, and Method, 5) Review matches and reconcile. Invoices auto-update to Paid or PartiallyPaid.",
    confidence: 0.95,
    links: [
      { label: "Upload Payments", path: "/data-center" },
      { label: "Reconciliation", path: "/reconciliation" }
    ]
  },
  {
    keywords: ["template", "download template", "csv template", "excel template", "sample file"],
    answer: "Download pre-formatted templates from the Data Center's 'Sources & Templates' tab. We have templates for Accounts (with RID, company info, address), Invoices (with invoice number, amounts, dates), and Payments (with payment matching fields). Templates include all required and optional fields.",
    confidence: 0.95,
    links: [
      { label: "Get Templates", path: "/data-center" }
    ]
  },
  {
    keywords: ["column mapping", "map columns", "field mapping", "how to map"],
    answer: "Column mapping connects your file columns to Recouply fields. After uploading, you'll see a mapping screen where you select which Recouply field each of your columns represents. Our AI suggests mappings automatically. Required fields are marked - you must map these before proceeding.",
    confidence: 0.9,
    links: [
      { label: "Data Center", path: "/data-center" }
    ]
  },
  {
    keywords: ["recouply id", "rid", "account id", "recouply account id", "reference id"],
    answer: "The Recouply Account ID (RID) is auto-generated when you create accounts (format: RCPLY-ACCT-XXXX). Use this ID in invoice and payment uploads to correctly link data. You can export all accounts with their RIDs from the Accounts page for reference.",
    confidence: 0.95,
    links: [
      { label: "View Accounts", path: "/debtors" },
      { label: "Data Center", path: "/data-center" }
    ]
  },
  {
    keywords: ["recouply invoice id", "rinvd", "invoice reference", "invoice id"],
    answer: "The Recouply Invoice ID (RINVD) is auto-generated when invoices are created (format: RCPLY-INV-XXXX). Use this ID in payment uploads to match payments to specific invoices. It's the primary matching field for payment reconciliation.",
    confidence: 0.95,
    links: [
      { label: "View Invoices", path: "/invoices" }
    ]
  },
  {
    keywords: ["source", "data source", "accounting system", "quickbooks", "netsuite", "sap"],
    answer: "Data Sources represent your external accounting systems (QuickBooks, NetSuite, SAP, etc.). Create a source profile in the Data Center to save column mappings. Once saved, future uploads from that source automatically use your saved mappings.",
    confidence: 0.9,
    links: [
      { label: "Manage Sources", path: "/data-center" }
    ]
  },
  {
    keywords: ["review upload", "staging", "match status", "unmatched", "needs review"],
    answer: "After uploading, rows go to staging for review. You'll see match statuses: 'Matched' (linked to existing records), 'Pending' (needs review), or 'Unmatched' (no match found). You can manually assign matches, bulk-select rows, or delete incorrect entries before finalizing.",
    confidence: 0.9,
    links: [
      { label: "Data Center", path: "/data-center" }
    ]
  },
  {
    keywords: ["required fields", "mandatory fields", "what fields"],
    answer: "Required fields vary by type: ACCOUNTS need Company Name, Email; INVOICES need Recouply Account ID, Invoice Number, Amount, Due Date; PAYMENTS need Recouply Account ID, Recouply Invoice ID, Payment Amount, Payment Date. Check our templates for the full list.",
    confidence: 0.9,
    links: [
      { label: "Get Templates", path: "/data-center" }
    ]
  },
  {
    keywords: ["export accounts", "download accounts", "get account list"],
    answer: "Export all your accounts with their Recouply IDs from the Accounts page. Click the dropdown menu and select 'Export All Accounts'. This gives you a file with RIDs you can use for invoice and payment imports.",
    confidence: 0.9,
    links: [
      { label: "Export Accounts", path: "/debtors" }
    ]
  },
  {
    keywords: ["custom fields", "add field", "extra fields"],
    answer: "You can create custom fields when editing source mappings in the Data Center. Custom fields are saved per data source and can be reused across multiple uploads. Define the field key, label, and data type when creating.",
    confidence: 0.85,
    links: [
      { label: "Manage Sources", path: "/data-center" }
    ]
  },
  {
    keywords: ["archive upload", "delete upload", "remove upload"],
    answer: "You can archive uploads from the Data Center to hide them from your active view. Archived uploads aren't deleted - toggle 'Show archived' to view them, and restore if needed. Individual staging rows can also be deleted during review.",
    confidence: 0.85,
    links: [
      { label: "Data Center", path: "/data-center" }
    ]
  },
  // ===== TASKS & INBOUND EMAIL PROCESSING =====
  {
    keywords: ["task", "tasks", "collection task", "task list", "todo", "action items"],
    answer: "Collection tasks are action items that need attention. Tasks are created automatically from inbound customer emails, or manually by your team. View all tasks from the Collection Tasks page where you can filter by status, priority, type, and assignee.",
    confidence: 0.95,
    links: [
      { label: "View Tasks", path: "/tasks" }
    ]
  },
  {
    keywords: ["task assignment", "assign task", "assign to", "who is assigned"],
    answer: "Tasks can be assigned to team members you've added in Settings. When a task is assigned, that team member receives an email with task details and a reply-to address. Their replies are captured and can generate follow-up tasks automatically.",
    confidence: 0.95,
    links: [
      { label: "View Tasks", path: "/tasks" },
      { label: "Team Members", path: "/team" }
    ]
  },
  {
    keywords: ["automatic task", "auto task", "task created automatically", "how tasks created"],
    answer: "Tasks are created automatically when: 1) Inbound emails are received from customers - AI analyzes the email and extracts actionable items, 2) AI detects requests like W9 forms, payment plans, disputes, or invoice copies, 3) Each extracted action becomes a separate task linked to the email and account.",
    confidence: 0.95,
    links: [
      { label: "Inbound Command Center", path: "/inbound" },
      { label: "View Tasks", path: "/tasks" }
    ]
  },
  {
    keywords: ["inbound email", "customer email", "email response", "received email"],
    answer: "When customers reply to collection emails, their responses are captured in the Inbound Command Center. Each email is automatically processed by AI to extract summaries, sentiment, priority, and actionable items. You can view the full email, AI analysis, and linked account/invoice.",
    confidence: 0.95,
    links: [
      { label: "Inbound Command Center", path: "/inbound" }
    ]
  },
  {
    keywords: ["ai summary", "email summary", "summarize email", "ai analysis"],
    answer: "AI automatically summarizes every inbound email, extracting: 1) A brief summary of the customer's message, 2) Sentiment (positive/neutral/negative), 3) Priority level (high/medium/low), 4) Category (payment plan request, dispute, question, etc.), 5) Recommended actions to take.",
    confidence: 0.95,
    links: [
      { label: "Inbound Command Center", path: "/inbound" }
    ]
  },
  {
    keywords: ["ai response", "generate response", "ai reply", "draft response", "auto response"],
    answer: "From any inbound email, click 'Generate AI Response' to create an intelligent reply. The AI uses the email context, linked invoice details, and appropriate persona tone. You can review, edit, send immediately, or save as draft. Unsent responses create pending tasks so nothing is missed.",
    confidence: 0.95,
    links: [
      { label: "Inbound Command Center", path: "/inbound" }
    ]
  },
  {
    keywords: ["extracted action", "action type", "w9", "payment plan request", "dispute", "promise to pay"],
    answer: "AI extracts specific action types from emails: W9_REQUEST (tax form needed), PAYMENT_PLAN_REQUEST (wants to set up payments), DISPUTE_CHARGES (questioning charges), PROMISE_TO_PAY (commitment to pay by date), INVOICE_COPY_REQUEST (needs invoice copy), and more. Each becomes a trackable task.",
    confidence: 0.9,
    links: [
      { label: "View Tasks", path: "/tasks" },
      { label: "Inbound Command Center", path: "/inbound" }
    ]
  },
  {
    keywords: ["task status", "open task", "close task", "complete task", "in progress"],
    answer: "Tasks have statuses: Open (new/needs attention), In Progress (being worked on), Done (completed). Update task status from the task detail modal. You can also add notes and see the full history of the task including source email and related communications.",
    confidence: 0.9,
    links: [
      { label: "View Tasks", path: "/tasks" }
    ]
  },
  {
    keywords: ["task priority", "high priority", "urgent task"],
    answer: "Tasks are assigned priority levels: High (urgent action needed), Medium (standard follow-up), Low (non-urgent). AI automatically sets priority based on email content, customer sentiment, and invoice aging. You can manually adjust priority in the task detail modal.",
    confidence: 0.9,
    links: [
      { label: "View Tasks", path: "/tasks" }
    ]
  },
  {
    keywords: ["internal task", "team communication", "internal email"],
    answer: "Emails from team members (defined in your Team Members settings) are flagged as internal communications. AI processes these differently and creates tasks with an [Internal] prefix. This distinguishes team discussions from customer communications.",
    confidence: 0.85,
    links: [
      { label: "Team Members", path: "/team" },
      { label: "View Tasks", path: "/tasks" }
    ]
  },
  {
    keywords: ["view source email", "email link", "task email"],
    answer: "Every task created from an inbound email has a 'View Source Email' link. Click it to navigate directly to that email in the Inbound Command Center. Similarly, from emails you can click linked tasks to open the task detail modal.",
    confidence: 0.85,
    links: [
      { label: "Inbound Command Center", path: "/inbound" },
      { label: "View Tasks", path: "/tasks" }
    ]
  },
  // ===== ORIGINAL KNOWLEDGE BASE ENTRIES =====
  {
    keywords: ["invoice", "create invoice", "add invoice", "new invoice"],
    answer: "To create an invoice, go to the Invoices page and click 'Create Invoice'. You can also import invoices in bulk via the Data Center.",
    confidence: 0.9,
    links: [
      { label: "Go to Invoices", path: "/invoices" },
      { label: "Open Data Center", path: "/data-center" }
    ]
  },
  {
    keywords: ["account", "debtor", "customer", "add account"],
    answer: "Accounts can be managed from the Accounts page. You can add individual accounts or import them in bulk through the Data Center.",
    confidence: 0.9,
    links: [
      { label: "View Accounts", path: "/debtors" },
      { label: "Open Data Center", path: "/data-center" }
    ]
  },
  {
    keywords: ["workflow", "ai workflow", "collection workflow"],
    answer: "AI Workflows automatically generate collection drafts based on invoice aging buckets. Configure your collection automation from the AI Workflows page.",
    confidence: 0.85,
    links: [
      { label: "Configure AI Workflows", path: "/settings/ai-workflows" }
    ]
  },
  {
    keywords: ["persona", "ai agent", "sam", "james", "katy", "troy", "gotti", "rocco"],
    answer: "Recouply.ai has 6 AI personas: Sam (0-30 days), James (31-60), Katy (61-90), Troy (91-120), Gotti (121-150), and Rocco (150+ days). Each has a unique tone suited for different aging stages.",
    confidence: 0.9,
    links: [
      { label: "View AI Agents", path: "/personas" },
      { label: "Configure Workflows", path: "/settings/ai-workflows" }
    ]
  },
  {
    keywords: ["payment", "apply payment", "reconcile payment"],
    answer: "You can apply payments from invoice detail pages using the 'Apply Payment' button, or import payments in bulk via the Data Center and reconcile them.",
    confidence: 0.85,
    links: [
      { label: "View Invoices", path: "/invoices" },
      { label: "Reconciliation", path: "/reconciliation" },
      { label: "Data Center", path: "/data-center" }
    ]
  },
  {
    keywords: ["billing", "subscription", "plan", "pricing", "upgrade"],
    answer: "Manage your subscription from the Billing page. We offer Starter ($199/mo), Growth ($499/mo), and Professional ($799/mo) plans based on invoice volume.",
    confidence: 0.8,
    links: [
      { label: "Manage Billing", path: "/billing" },
      { label: "View Pricing", path: "/pricing" }
    ]
  },
  {
    keywords: ["email", "send email", "outreach", "draft"],
    answer: "AI-generated email drafts are created automatically based on your workflows. Review and approve drafts from the AI Workflows page before they're sent.",
    confidence: 0.85,
    links: [
      { label: "AI Workflows", path: "/settings/ai-workflows" }
    ]
  },
  {
    keywords: ["task", "collection task", "todo"],
    answer: "Collection tasks are created automatically from inbound emails and AI analysis. View and manage all tasks from the Collection Tasks page.",
    confidence: 0.85,
    links: [
      { label: "View Tasks", path: "/tasks" }
    ]
  },
  {
    keywords: ["risk", "payment score", "risk engine"],
    answer: "The Risk Engine calculates Payment Scores (0-100) for each account based on payment history, aging mix, disputes, and engagement. Higher scores indicate lower risk.",
    confidence: 0.85,
    links: [
      { label: "View Accounts", path: "/debtors" },
      { label: "Dashboard", path: "/dashboard" }
    ]
  },
  {
    keywords: ["logo", "branding", "customize"],
    answer: "Upload your company logo and customize branding from the Settings page. Your logo will appear in all outbound collection emails.",
    confidence: 0.8,
    links: [
      { label: "Branding Settings", path: "/settings" }
    ]
  },
  {
    keywords: ["security", "password", "mfa", "two factor"],
    answer: "Enable two-factor authentication from the Security Settings page. We support TOTP authenticator apps for enhanced account security.",
    confidence: 0.85,
    links: [
      { label: "Security Settings", path: "/settings/security" }
    ]
  },
  {
    keywords: ["team", "member", "invite", "user"],
    answer: "Add team members from the Team Members settings. Team members can be assigned to tasks and receive email notifications about their assignments.",
    confidence: 0.8,
    links: [
      { label: "Team Members", path: "/team" }
    ]
  },
  {
    keywords: ["daily digest", "report", "summary"],
    answer: "The Daily Collections Health Digest provides AR summaries, payment trends, and task counts. View it from the Daily Digest page or receive it via email.",
    confidence: 0.8,
    links: [
      { label: "Daily Digest", path: "/daily-digest" }
    ]
  },
  {
    keywords: ["dashboard", "overview", "home"],
    answer: "Your Dashboard shows key metrics including AR aging, payment scores, tasks, and collectability reports at a glance.",
    confidence: 0.85,
    links: [
      { label: "Go to Dashboard", path: "/dashboard" }
    ]
  },
  {
    keywords: ["aging", "ar aging", "overdue"],
    answer: "View your AR Aging breakdown from the AR Aging page. See invoices grouped by days past due (Current, 1-30, 31-60, 61-90, 91-120, 121+ days).",
    confidence: 0.85,
    links: [
      { label: "AR Aging Report", path: "/ar-aging" }
    ]
  },
  {
    keywords: ["inbound", "email reply", "customer response"],
    answer: "Inbound emails from customers are captured and processed automatically. View and manage them from the Inbound Command Center.",
    confidence: 0.85,
    links: [
      { label: "Inbound Command Center", path: "/inbound" }
    ]
  },
  {
    keywords: ["help", "support", "contact"],
    answer: "I'm Nicolas, your knowledge base assistant! If I can't answer your question, I can help you schedule a meeting with our founder or send a message to our support team.",
    confidence: 0.9,
    links: [
      { label: "Schedule Meeting", path: "__CALENDLY__" },
      { label: "Contact Us", path: "/contact" }
    ]
  },
  {
    keywords: ["meeting", "schedule", "call", "demo", "talk", "speak"],
    answer: "I'd be happy to help you schedule a meeting with Sharad, our founder! Click the link below to book a time that works for you.",
    confidence: 0.95,
    links: [
      { label: "Schedule Meeting", path: "__CALENDLY__" }
    ]
  },
  {
    keywords: ["calendly", "book", "appointment"],
    answer: "You can book a meeting directly with our founder using the link below. He'd love to chat about how Recouply.ai can help your business!",
    confidence: 0.95,
    links: [
      { label: "Book with Sharad", path: "__CALENDLY__" }
    ]
  }
];

// Combine FAQ knowledge base with contextual knowledge base
export const KNOWLEDGE_BASE = [...FAQ_KNOWLEDGE_BASE, ...CONTEXTUAL_KNOWLEDGE_BASE];

// Escalation trigger keywords
export const ESCALATION_TRIGGERS = [
  "contact support",
  "email support",
  "escalate",
  "human help",
  "speak to someone",
  "talk to support",
  "need help from a human",
  "bug",
  "error",
  "not working",
  "broken",
  "can't access",
  "account locked",
  "billing issue",
  "refund",
  "cancel subscription"
];

// Issue categories for smart collection
export const ISSUE_CATEGORIES = [
  "Billing or Payments",
  "Technical Issue / Bug",
  "Account Access",
  "Feature Question",
  "Integration Help",
  "Other"
];
