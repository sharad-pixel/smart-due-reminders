// Centralized Knowledge Base Data for Nicolas AI Agent and Knowledge Base Page
// This file contains all FAQ content that powers both the public Knowledge Base page
// and Nicolas's AI intelligence for answering user questions

export interface FAQItem {
  question: string;
  answer: string;
  keywords?: string[]; // Additional keywords for Nicolas's matching
}

export interface FAQCategory {
  id: string;
  title: string;
  description: string;
  faqs: FAQItem[];
}

export const knowledgeBaseData: FAQCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Everything you need to begin using Recouply.ai",
    faqs: [
      {
        question: "How do I create an account?",
        answer: "Visit recouply.ai/signup to create your account. You'll need to provide your email, create a password, and verify your email address. Once verified, you can immediately start setting up your workspace and uploading invoices.",
        keywords: ["signup", "register", "new account", "create account", "get started"]
      },
      {
        question: "What information do I need to get started?",
        answer: "To get started, you'll need: 1) Your business name and contact details, 2) Your accounts receivable data (invoices) in CSV/Excel format or through Stripe integration, 3) Customer/debtor contact information including emails. You can start with as few as one invoice and scale from there.",
        keywords: ["setup", "requirements", "onboarding", "first steps"]
      },
      {
        question: "How long does setup take?",
        answer: "Most teams are fully operational within 15-30 minutes. This includes: uploading your invoice data, configuring your branding settings, and reviewing your first AI-generated drafts. No technical expertise or complex integrations required.",
        keywords: ["time", "duration", "quick start", "how fast"]
      },
      {
        question: "Can I import data from my existing systems?",
        answer: "Yes! Recouply supports multiple import methods: 1) CSV/Excel upload for bulk invoice data, 2) Direct Stripe integration for automatic sync, 3) QuickBooks integration (limited - customer and invoice sync), 4) Manual entry for individual invoices.",
        keywords: ["import", "migrate", "transfer data", "existing data", "accounting system"]
      },
      {
        question: "Is there a free trial?",
        answer: "Yes, we offer a 7-day free trial with full access to all collection intelligence features. Payment info is required upfront and the trial auto-converts unless cancelled. Trial includes 5 active invoices. You can explore AI agents, upload invoices, and generate drafts during the trial period.",
        keywords: ["trial", "free", "demo", "test", "try"]
      }
    ]
  },
  {
    id: "ai-agents",
    title: "AI Collection Agents",
    description: "Understanding your six specialized AI agents",
    faqs: [
      {
        question: "What are the six AI agents and what do they do?",
        answer: "Recouply uses six specialized AI agents, each designed for a specific aging bucket: 1) SAM (1-30 days) - Friendly payment reminders, 2) JAMES (31-60 days) - Professional follow-ups, 3) DIANA (61-90 days) - Firm but fair escalation, 4) MARCUS (91-120 days) - Urgent collection notices, 5) ELENA (120+ days) - Final resolution attempts, 6) RECOVERY - Settlement and payment plan negotiations.",
        keywords: ["agents", "personas", "sam", "james", "diana", "marcus", "elena", "recovery", "ai", "who are"]
      },
      {
        question: "How do AI agents determine the right tone for each message?",
        answer: "Agents analyze multiple signals: invoice age, payment history, customer value (from CRM data), previous response patterns, and account risk score. High-value customers receive more empathetic messaging, while consistently late payers may receive firmer communication.",
        keywords: ["tone", "message", "personalization", "communication style"]
      },
      {
        question: "Can I customize the AI agent personalities?",
        answer: "Yes! You can adjust tone preferences, escalation thresholds, and communication frequency for each agent through the AI Workflows settings. You can also create custom workflow steps with specific templates for each aging bucket.",
        keywords: ["customize", "personalize", "adjust", "configure agents"]
      },
      {
        question: "Do AI agents send emails automatically?",
        answer: "By default, all AI-generated messages require your approval before sending (Human-in-the-Loop). You can enable 'Auto-Approve Outreach Drafts' in Branding settings if you want drafts to be sent automatically, but we recommend reviewing at least initially.",
        keywords: ["automatic", "auto send", "approval", "human in the loop"]
      },
      {
        question: "How do agents learn and improve over time?",
        answer: "Agents continuously learn from: email open/response rates, payment outcomes after outreach, customer feedback patterns, and dispute resolutions. This intelligence compounds with every interaction, improving recovery rates and timing recommendations.",
        keywords: ["learn", "improve", "machine learning", "smart", "intelligence"]
      }
    ]
  },
  {
    id: "invoices-debtors",
    title: "Invoices & Accounts",
    description: "Managing your accounts receivable data",
    faqs: [
      {
        question: "How do I upload invoices?",
        answer: "Navigate to Data Center or use the AR Upload page. You can: 1) Drag and drop CSV/Excel files with your invoice data, 2) Map columns to Recouply fields (invoice number, amount, due date, customer info), 3) Review and confirm before import. The system will automatically create debtors for new customers.",
        keywords: ["upload", "import invoices", "add invoices", "csv", "excel"]
      },
      {
        question: "What invoice statuses are available?",
        answer: "Invoices can have the following statuses: Open (unpaid), Paid (fully collected), Partially Paid (partial payment received), Disputed (customer has raised an issue), Voided (cancelled), Write-Off (uncollectable). Status changes can be made manually or synced automatically via integrations.",
        keywords: ["status", "invoice status", "paid", "open", "disputed"]
      },
      {
        question: "How do I manage debtor/account information?",
        answer: "From the Debtors page, you can: view all accounts and their AR balance, click into any account for detailed history, add/edit contact information, view the Collection Intelligence Report for each account, and manage payment plans. Each account shows all associated invoices and communication history.",
        keywords: ["debtor", "account", "customer", "manage accounts"]
      },
      {
        question: "What is the Account Intelligence Report?",
        answer: "The Account Intelligence Report is an AI-generated analysis for each debtor showing: risk level scoring, payment behavior patterns, communication sentiment analysis, recommended collection strategies, and key insights. The report becomes more accurate as more interactions are recorded.",
        keywords: ["intelligence report", "account report", "risk", "analysis"]
      },
      {
        question: "Can I bulk update invoice statuses?",
        answer: "Yes! From the Invoices page, you can select multiple invoices and perform bulk actions including status updates, adding notes, or assigning to workflows. You can also use the Reconciliation feature to mark invoices as paid based on payment data.",
        keywords: ["bulk", "batch update", "multiple invoices"]
      }
    ]
  },
  {
    id: "outreach-workflows",
    title: "Outreach & Workflows",
    description: "Automated collection communications",
    faqs: [
      {
        question: "How do AI Workflows work?",
        answer: "AI Workflows automate your collection cadence. Each workflow is tied to an aging bucket (1-30 days, 31-60 days, etc.) and contains steps that define: when to send (day offset), what channel (email/SMS), and the message template. When enabled, the system automatically generates drafts for invoices that match the criteria.",
        keywords: ["workflow", "automation", "cadence", "collection workflow"]
      },
      {
        question: "What is the Outreach Engine?",
        answer: "The Outreach Engine is the automated system that: 1) Cancels drafts for paid/voided invoices, 2) Generates new drafts for upcoming workflow steps (7-day window), 3) Sends approved drafts scheduled for today. You can run it manually from the AI Workflows page or let it run automatically.",
        keywords: ["outreach engine", "automation", "send emails"]
      },
      {
        question: "How do I review and approve drafts?",
        answer: "Pending drafts appear on your Dashboard and Outreach page. Click any draft to: preview the full message, edit the subject or body, approve for sending, or discard. Approved drafts are queued for the next Outreach Engine run.",
        keywords: ["drafts", "approve", "review", "pending"]
      },
      {
        question: "What is Account-Level Outreach?",
        answer: "Instead of sending invoice-specific messages, Account-Level Outreach sends consolidated communications at the debtor level. This uses the Collection Intelligence Report to dynamically inform message tone based on overall account health. Enable it from the debtor detail page.",
        keywords: ["account level", "consolidated", "account outreach"]
      },
      {
        question: "Can I schedule outreach for specific times?",
        answer: "Drafts are generated with a recommended send date based on the workflow step's day offset. The Outreach Engine processes approved drafts daily. For more control, you can manually approve drafts on specific days or adjust workflow step timing.",
        keywords: ["schedule", "timing", "when to send"]
      }
    ]
  },
  {
    id: "payment-plans",
    title: "Payment Plans",
    description: "Setting up and managing payment arrangements",
    faqs: [
      {
        question: "How do payment plans work in Recouply?",
        answer: "Payment plans allow debtors to pay off their balance in installments. Plans are created at the account level (not per invoice) and support 2-12 installments with weekly, bi-weekly, or monthly frequency. Both the debtor and your team must approve the plan before it activates.",
        keywords: ["payment plan", "installments", "payment arrangement"]
      },
      {
        question: "How do I create a payment plan?",
        answer: "From the debtor detail page: 1) Click 'Create Payment Plan', 2) Select which invoices to include, 3) Configure number of installments and frequency, 4) Preview the schedule, 5) Send to the debtor for approval. They'll receive a link to review and accept the terms.",
        keywords: ["create plan", "setup payment plan", "new plan"]
      },
      {
        question: "What happens when a payment plan is active?",
        answer: "Active payment plans: 1) Flag included invoices as 'on payment plan', 2) Exclude those invoices from standard AI aging workflows, 3) Switch the account to account-level outreach, 4) Use payment plan intelligence to inform communications about processed and pending payments.",
        keywords: ["active plan", "payment plan status"]
      },
      {
        question: "How do debtors approve and pay?",
        answer: "Debtors receive a tokenized portal link where they can: review the proposed payment schedule, accept or request modifications, make payments via Stripe (if configured), and track their remaining balance. You receive notifications when they interact with the portal.",
        keywords: ["debtor portal", "approve plan", "pay"]
      },
      {
        question: "Can I modify or cancel a payment plan?",
        answer: "Yes, from the debtor dashboard you can: edit pending plans before debtor approval, regenerate and resend portal links, mark plans as completed or cancelled. Cancelling a plan returns the included invoices to normal workflow processing.",
        keywords: ["modify plan", "cancel plan", "change plan"]
      }
    ]
  },
  {
    id: "inbound-communications",
    title: "Inbound Communications",
    description: "Handling debtor responses and requests",
    faqs: [
      {
        question: "How does Recouply handle debtor email replies?",
        answer: "All debtor replies are captured via our inbound email system. The AI automatically: links emails to the correct debtor and invoice, summarizes the content, identifies the intent (dispute, payment plan request, W9 request, etc.), and creates actionable tasks for your team.",
        keywords: ["email replies", "inbound email", "debtor response"]
      },
      {
        question: "What is the Inbound Command Center?",
        answer: "The Inbound Command Center is your hub for managing all debtor responses. It shows: incoming emails with AI-generated summaries, extracted action items, suggested responses, and one-click actions like sending invoice copies, W9 forms, or portal links.",
        keywords: ["inbound", "command center", "email hub"]
      },
      {
        question: "What types of requests does the AI detect?",
        answer: "The AI identifies common request types: W9/tax document requests, payment plan inquiries, invoice copy requests, dispute notifications, promise-to-pay commitments, address/contact updates, and general questions. Each creates a typed task with recommended actions.",
        keywords: ["request types", "detect", "w9", "dispute"]
      },
      {
        question: "How do I respond to inbound requests?",
        answer: "From any inbound task, you can: view the AI-suggested response, edit as needed, optionally include invoice PDFs or W9 documents, and send directly from Recouply. Responses are logged to the collection activity timeline for the account.",
        keywords: ["respond", "reply", "answer request"]
      },
      {
        question: "Can I set up auto-responses?",
        answer: "Currently, all inbound communications create tasks for human review. We recommend reviewing responses to maintain relationship quality. However, the AI pre-drafts responses that you can quickly approve and send with minimal editing.",
        keywords: ["auto response", "automatic reply"]
      }
    ]
  },
  {
    id: "tasks",
    title: "Tasks & Collection Activities",
    description: "Tracking and managing collection work",
    faqs: [
      {
        question: "What are Collection Tasks?",
        answer: "Collection Tasks are actionable items generated by the system or created manually. Types include: inbound email responses, follow-up reminders, dispute resolutions, payment plan follow-ups, and escalation reviews. Tasks have priority levels (low, medium, high, critical) and due dates.",
        keywords: ["tasks", "collection tasks", "to do", "action items"]
      },
      {
        question: "How are tasks prioritized?",
        answer: "Tasks are prioritized based on: invoice amount, days past due, account risk score, and request urgency. Critical tasks (disputes on large invoices, urgent requests) appear prominently on your Dashboard and in the Daily Digest email.",
        keywords: ["priority", "urgent", "important tasks"]
      },
      {
        question: "Can I assign tasks to team members?",
        answer: "Yes! If you have team members (Growth plan and above), you can assign tasks to specific users. Assigned team members receive email notifications and the task appears in their personal task list. Task ownership can be transferred at any time.",
        keywords: ["assign", "team", "delegate"]
      },
      {
        question: "How do I track collection activities?",
        answer: "Every action is logged to the Collection Activities timeline: emails sent, payments received, status changes, notes added, and tasks completed. View the full timeline from any debtor detail page or export activity logs for compliance/audit purposes.",
        keywords: ["track", "activities", "history", "timeline"]
      },
      {
        question: "What is the Daily Digest?",
        answer: "The Daily Digest is an automated email report summarizing: total AR outstanding by aging bucket, payments collected, high-priority tasks requiring attention, portfolio risk metrics, and AI insights. Configure delivery preferences in your Profile settings.",
        keywords: ["daily digest", "report", "summary", "email report"]
      }
    ]
  },
  {
    id: "branding-emails",
    title: "Branding & Email Settings",
    description: "Customizing your communications",
    faqs: [
      {
        question: "How do I set up my business branding?",
        answer: "Go to Settings > Branding to configure: business name, logo, primary/accent colors, email signature, and footer text. These settings are applied to all AI-generated emails, ensuring consistent brand presentation across all collection communications.",
        keywords: ["branding", "logo", "colors", "customize"]
      },
      {
        question: "Can I use my own email domain?",
        answer: "Yes! You can configure a custom 'From' email address. Enter your preferred email in Branding settings, and we'll guide you through domain verification. Once verified, all outgoing emails will appear from your domain rather than recouply.ai.",
        keywords: ["custom domain", "email domain", "from address", "own domain"]
      },
      {
        question: "What email formats are available?",
        answer: "Recouply offers two formats: 1) Simple - clean, text-focused emails without heavy styling, 2) Enhanced - branded emails with your logo, colors, and formatted layout. Choose based on your preference and what works best with your customers.",
        keywords: ["email format", "template", "email style"]
      },
      {
        question: "How do I add payment links to emails?",
        answer: "Add your Stripe payment link in Branding settings. AI-generated emails will automatically include a prominent 'Pay Now' button linking to your Stripe checkout. Payments go directly to your Stripe account—Recouply never handles your funds.",
        keywords: ["payment link", "pay now", "stripe link"]
      },
      {
        question: "Can I include escalation contact information?",
        answer: "Yes, configure escalation contacts in Branding settings (name, email, phone). For higher aging buckets, AI agents can reference your escalation contact when appropriate, giving debtors a direct line to resolve complex issues.",
        keywords: ["escalation", "contact info", "phone number"]
      }
    ]
  },
  {
    id: "team-collaboration",
    title: "Team & Collaboration",
    description: "Working together on collections",
    faqs: [
      {
        question: "How do I invite team members?",
        answer: "Navigate to Team page to invite colleagues. Enter their email address and select a role (Admin, Member, or Viewer). They'll receive an invitation email with a link to join your workspace. Pending invites can be resent or cancelled.",
        keywords: ["invite", "add team", "new user"]
      },
      {
        question: "What are the different team roles?",
        answer: "Three roles are available: 1) Owner - full access including billing and team management, 2) Admin - can manage invoices, workflows, and settings but not billing, 3) Member - can work with invoices and tasks but cannot change settings, 4) Viewer - read-only access to data.",
        keywords: ["roles", "permissions", "admin", "owner", "member"]
      },
      {
        question: "How does billing work for team members?",
        answer: "Team seats are included based on your plan (Starter: 1 seat, Growth: 3 seats, Enterprise: unlimited). Additional seats beyond your plan limit are billed at the per-seat rate. Seats are pro-rated when added mid-billing cycle.",
        keywords: ["seats", "team billing", "user cost"]
      },
      {
        question: "Can team members see all data?",
        answer: "Yes, team members in the same workspace share access to all invoices, debtors, and activities. For organizations needing data separation, contact us about multi-workspace configurations (Enterprise plan).",
        keywords: ["data access", "visibility", "shared data"]
      },
      {
        question: "How do I remove a team member?",
        answer: "From the Team page, click on the member you want to remove and select 'Remove from team'. Their access is revoked immediately. Any tasks assigned to them should be reassigned before removal.",
        keywords: ["remove user", "delete team member", "revoke access"]
      }
    ]
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connecting your tools",
    faqs: [
      {
        question: "What integrations are available?",
        answer: "Currently available: Stripe (for payment sync and invoice import) and QuickBooks (limited - customer and invoice sync). CRM integrations (Salesforce, HubSpot) are available exclusively for Enterprise Custom plans. Check the Integrations page for the latest availability.",
        keywords: ["integrations", "connect", "sync", "stripe", "quickbooks"]
      },
      {
        question: "How does Stripe integration work?",
        answer: "Connect your Stripe account from the Integrations page. Recouply will: import open invoices from Stripe, sync payment status automatically, and optionally embed your Stripe payment links in collection emails. You can configure sync frequency and which invoices to include.",
        keywords: ["stripe", "payment sync", "stripe connect"]
      },
      {
        question: "How does QuickBooks integration work?",
        answer: "Connect your QuickBooks account via OAuth from the Integrations page. Recouply will sync customers and invoices from QuickBooks. Note: QuickBooks integration is currently limited to customer and invoice data sync. Payment reconciliation features are coming soon.",
        keywords: ["quickbooks", "qb", "accounting sync"]
      },
      {
        question: "Will synced payments update invoice status?",
        answer: "Yes! When a payment is recorded in Stripe, Recouply automatically updates the corresponding invoice status. Paid invoices are excluded from future collection workflows. Use the Reconciliation page to review and confirm payment matches.",
        keywords: ["payment sync", "auto update", "reconcile"]
      },
      {
        question: "Can I disconnect an integration?",
        answer: "Yes, you can disconnect any integration from the Integrations page. Disconnecting stops future syncs but preserves data already imported. To remove imported data, you'll need to delete those records manually.",
        keywords: ["disconnect", "remove integration"]
      },
      {
        question: "Are CRM integrations available?",
        answer: "CRM integrations (Salesforce, HubSpot, and other customer relationship management platforms) are available exclusively for Enterprise Custom plans. These integrations enable AI agents to use customer relationship context for more personalized collection communications. Contact us to discuss Enterprise options.",
        keywords: ["crm", "salesforce", "hubspot", "enterprise"]
      }
    ]
  },
  {
    id: "billing-plans",
    title: "Billing & Plans",
    description: "Subscription and payment information",
    faqs: [
      {
        question: "What plans are available?",
        answer: "Recouply offers plans for every size: 1) Solo Pro ($49/mo) - 25 invoices, perfect for independent operators and sole proprietors, 2) Starter - up to 100 invoices/month, 1 user, 3) Growth - up to 300 invoices/month, 3 users, priority support, 4) Professional - up to 500 invoices/month, 5) Enterprise Custom - unlimited invoices and users, CRM integrations, dedicated support. All features are available on every plan—you only pay based on invoice volume and team size.",
        keywords: ["plans", "pricing", "cost", "subscription", "solo pro", "starter", "growth", "enterprise"]
      },
      {
        question: "Do all plans include the same features?",
        answer: "Yes! All Recouply plans include full access to all features: all six AI collection agents (SAM, JAMES, DIANA, MARCUS, ELENA, RECOVERY), AI workflows, payment plans, inbound communications, branding customization, Stripe integration, QuickBooks integration, and analytics. The only differences are invoice capacity, team seats, and overage rates. CRM integrations (Salesforce, HubSpot) are exclusive to Enterprise Custom plans.",
        keywords: ["features", "included", "what's included", "all features"]
      },
      {
        question: "What is the Solo Pro plan?",
        answer: "Solo Pro is designed for independent operators, consultants, and sole proprietors who need full collection intelligence power without enterprise pricing. At $49/month, you get 25 active invoices, all AI agents, all features, and the same powerful automation as larger plans. Additional invoices are billed at $1.99 each.",
        keywords: ["solo pro", "solo", "freelancer", "consultant", "small business"]
      },
      {
        question: "What happens if I exceed my invoice limit?",
        answer: "Collections continue uninterrupted. Invoices beyond your plan limit are billed at overage rates ($1.49-$1.99 per invoice depending on plan). You can upgrade anytime to get a better per-invoice rate and avoid overages.",
        keywords: ["overage", "exceed limit", "extra invoices"]
      },
      {
        question: "How do I upgrade or downgrade my plan?",
        answer: "Go to Settings > Billing to view your current plan and upgrade options. Upgrades take effect immediately with pro-rated billing. Downgrades take effect at the next billing cycle. Contact support if you need assistance with plan changes.",
        keywords: ["upgrade", "downgrade", "change plan"]
      },
      {
        question: "What payment methods are accepted?",
        answer: "We accept all major credit cards (Visa, Mastercard, American Express) via Stripe. Enterprise customers can request invoice billing with NET-30 terms. All payments are processed securely—we never store your card details.",
        keywords: ["payment method", "credit card", "how to pay"]
      },
      {
        question: "Can I cancel my subscription?",
        answer: "Yes, you can cancel anytime from the Billing page. Cancellation takes effect at the end of your current billing period. Your data is retained for 30 days after cancellation, during which you can reactivate or export your data.",
        keywords: ["cancel", "unsubscribe", "stop subscription"]
      }
    ]
  },
  {
    id: "security-privacy",
    title: "Security & Privacy",
    description: "Keeping your data safe",
    faqs: [
      {
        question: "How is my data protected?",
        answer: "We use bank-level security: 256-bit TLS encryption in transit, AES-256 encryption at rest, SOC 2 Type II compliance, regular security audits, and strict access controls. Your financial data is isolated per workspace with row-level security.",
        keywords: ["security", "data protection", "encryption", "safe"]
      },
      {
        question: "Do you share or sell customer data?",
        answer: "Never. Your data is used solely for providing Recouply services to you. We do not share, sell, or use your data for any other purpose. See our Privacy Policy for complete details on data handling practices.",
        keywords: ["privacy", "data sharing", "sell data"]
      },
      {
        question: "Can I export my data?",
        answer: "Yes, you can export your data at any time. From Settings, you can download invoices, debtors, and activity logs in CSV format. Enterprise customers have access to API exports and database snapshots.",
        keywords: ["export", "download data", "backup"]
      },
      {
        question: "How do you handle GDPR compliance?",
        answer: "Recouply is GDPR-compliant. We support: data subject access requests, right to deletion, data portability, and processing agreements. Contact support@recouply.ai for data requests or to sign a DPA.",
        keywords: ["gdpr", "compliance", "data rights", "european"]
      },
      {
        question: "What access controls are available?",
        answer: "Workspace security features include: role-based access control (Owner, Admin, Member, Viewer), email verification requirements, session management, and audit logs for all actions. Enterprise plans add SSO and IP whitelisting options.",
        keywords: ["access control", "permissions", "sso", "security settings"]
      }
    ]
  },
  {
    id: "knowledge-help",
    title: "Knowledge Base & Help",
    description: "Finding answers and documentation",
    faqs: [
      {
        question: "Does Recouply have a Knowledge Base?",
        answer: "Yes! You're looking at it. Our Knowledge Base contains comprehensive documentation about all Recouply features including AI agents, workflows, payment plans, integrations, billing, and more. You can also access it anytime from the footer link or by visiting /knowledge-base.",
        keywords: ["knowledge base", "kb", "documentation", "docs", "help center", "faq", "help"]
      },
      {
        question: "Where can I find help and documentation?",
        answer: "Recouply offers multiple help resources: 1) This Knowledge Base with searchable FAQs, 2) Nicolas - the AI assistant available on every page, 3) Contact form for human support, 4) Calendly link to schedule calls with our founder. Access any of these from the help links throughout the app.",
        keywords: ["help", "documentation", "support", "find answers"]
      },
      {
        question: "How do I contact support?",
        answer: "You can reach our support team through: 1) The contact form at /contact, 2) Email at support@recouply.ai, 3) Schedule a call with our founder via Calendly. For urgent billing or account issues, email us directly for fastest response.",
        keywords: ["contact", "support", "help", "email support", "phone"]
      }
    ]
  }
];

// Helper function to convert FAQ data to Nicolas's knowledge base format
export interface NicolasKnowledgeEntry {
  keywords: string[];
  answer: string;
  confidence: number;
  links?: { label: string; path: string }[];
}

export function generateNicolasKnowledgeBase(): NicolasKnowledgeEntry[] {
  const entries: NicolasKnowledgeEntry[] = [];
  
  for (const category of knowledgeBaseData) {
    for (const faq of category.faqs) {
      // Extract keywords from question and any provided keywords
      const questionWords = faq.question.toLowerCase()
        .replace(/[?.,!]/g, '')
        .split(' ')
        .filter(word => word.length > 3 && !['what', 'how', 'does', 'have', 'the', 'and', 'for', 'you', 'can', 'are', 'this', 'that', 'with', 'from', 'your', 'will'].includes(word));
      
      const keywords = [
        ...(faq.keywords || []),
        ...questionWords
      ];
      
      // Generate links based on category
      const links = getCategoryLinks(category.id);
      
      entries.push({
        keywords: [...new Set(keywords)], // Remove duplicates
        answer: faq.answer,
        confidence: 0.9,
        links
      });
    }
  }
  
  return entries;
}

function getCategoryLinks(categoryId: string): { label: string; path: string }[] {
  const linkMap: Record<string, { label: string; path: string }[]> = {
    'getting-started': [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Data Center', path: '/data-center' }
    ],
    'ai-agents': [
      { label: 'View AI Agents', path: '/personas' },
      { label: 'AI Workflows', path: '/settings/ai-workflows' }
    ],
    'invoices-debtors': [
      { label: 'View Invoices', path: '/invoices' },
      { label: 'View Accounts', path: '/debtors' }
    ],
    'outreach-workflows': [
      { label: 'AI Workflows', path: '/settings/ai-workflows' },
      { label: 'Outreach', path: '/outreach' }
    ],
    'payment-plans': [
      { label: 'View Accounts', path: '/debtors' }
    ],
    'inbound-communications': [
      { label: 'Inbound Command Center', path: '/inbound' },
      { label: 'View Tasks', path: '/tasks' }
    ],
    'tasks': [
      { label: 'View Tasks', path: '/tasks' },
      { label: 'Daily Digest', path: '/daily-digest' }
    ],
    'branding-emails': [
      { label: 'Branding Settings', path: '/settings' }
    ],
    'team-collaboration': [
      { label: 'Team Members', path: '/team' }
    ],
    'integrations': [
      { label: 'Integrations', path: '/integrations' }
    ],
    'billing-plans': [
      { label: 'Manage Billing', path: '/billing' },
      { label: 'View Pricing', path: '/pricing' }
    ],
    'security-privacy': [
      { label: 'Security Settings', path: '/settings/security' }
    ],
    'knowledge-help': [
      { label: 'Knowledge Base', path: '/knowledge-base' },
      { label: 'Contact Us', path: '/contact' }
    ]
  };
  
  return linkMap[categoryId] || [];
}
