// Page-specific onboarding content for Nicolas contextual help

export interface PageOnboardingContent {
  title: string;
  welcomeMessage: string;
  tips: string[];
  quickActions?: { label: string; path: string }[];
}

export const PAGE_ONBOARDING_CONTENT: Record<string, PageOnboardingContent> = {
  '/dashboard': {
    title: 'Dashboard',
    welcomeMessage: "Welcome to your Dashboard! This is your command center for monitoring collections health, AR aging, and key metrics at a glance.",
    tips: [
      "The AR Aging breakdown shows your receivables by age bucket - watch the 90+ day balances closely",
      "Payment Score indicates overall portfolio health - higher is better",
      "Click on any metric card to drill down into details",
      "Collection Intelligence provides actionable recommendations based on your data",
    ],
    quickActions: [
      { label: "View Accounts", path: "/debtors" },
      { label: "Import Data", path: "/data-center" },
    ],
  },

  '/debtors': {
    title: 'Accounts',
    welcomeMessage: "This is your Accounts hub where you manage all your customers and their collection status.",
    tips: [
      "Each account has a Risk Score (0-100) - lower scores indicate higher risk",
      "Click an account to see detailed collection history and intelligence",
      "Use filters to find accounts by status, risk tier, or balance",
      "Export accounts to get Recouply IDs for invoice mapping",
    ],
    quickActions: [
      { label: "Import Accounts", path: "/data-center" },
      { label: "View High Risk", path: "/debtors?risk=high" },
    ],
  },

  '/invoices': {
    title: 'Invoices',
    welcomeMessage: "Your Invoices page shows all outstanding and historical invoices with their collection status.",
    tips: [
      "Invoices are automatically assigned to AI Workflows based on aging",
      "Click an invoice to see full details, apply payments, or view outreach history",
      "Use the status filter to find Open, Overdue, or Paid invoices",
      "Pause outreach on individual invoices when needed",
    ],
    quickActions: [
      { label: "Import Invoices", path: "/data-center" },
      { label: "View Overdue", path: "/invoices?status=overdue" },
    ],
  },

  '/data-center': {
    title: 'Data Center',
    welcomeMessage: "The Data Center is your central hub for importing and managing all AR data - accounts, invoices, and payments.",
    tips: [
      "Start with Accounts - they get Recouply IDs needed for invoice mapping",
      "Download templates for properly formatted imports",
      "Create Data Sources to save column mappings for recurring uploads",
      "Review staging data before finalizing imports",
    ],
    quickActions: [
      { label: "Download Templates", path: "/data-center?tab=sources" },
    ],
  },

  '/settings/ai-workflows': {
    title: 'AI Workflows',
    welcomeMessage: "AI Workflows automate your collection outreach with intelligent, persona-driven messaging.",
    tips: [
      "Each aging bucket has its own workflow with escalating tone",
      "Enable 'Auto-generate drafts' to create messages automatically",
      "Customize step timing and message templates to match your style",
      "Review and approve drafts before they're sent",
    ],
    quickActions: [
      { label: "View Outreach Queue", path: "/outreach" },
      { label: "Meet the AI Agents", path: "/personas" },
    ],
  },

  '/outreach': {
    title: 'Outreach',
    welcomeMessage: "Manage all your AI-generated collection drafts here - review, approve, and send outreach messages.",
    tips: [
      "Drafts are created automatically based on your AI Workflows",
      "Review each draft before approving - you can edit the content",
      "Bulk approve multiple drafts to speed up your workflow",
      "Click 'Send Approved' to dispatch all approved messages",
    ],
    quickActions: [
      { label: "Configure Workflows", path: "/settings/ai-workflows" },
    ],
  },

  '/inbound': {
    title: 'Inbound Command Center',
    welcomeMessage: "The Inbound AI processes all customer responses and extracts actionable insights automatically.",
    tips: [
      "AI analyzes every inbound email for sentiment, priority, and action items",
      "Tasks are auto-created for requests like payment plans, disputes, or document needs",
      "Generate AI responses with one click, maintaining persona consistency",
      "Link emails to accounts and invoices for full context",
    ],
    quickActions: [
      { label: "View Tasks", path: "/tasks" },
    ],
  },

  '/tasks': {
    title: 'Collection Tasks',
    welcomeMessage: "Track all collection actions and follow-ups in one organized task board.",
    tips: [
      "Tasks are auto-created from inbound emails and AI analysis",
      "Assign tasks to team members for accountability",
      "Use status columns: Open → In Progress → Done",
      "Filter by priority, type, or assignee to focus your work",
    ],
    quickActions: [
      { label: "View Inbound Emails", path: "/inbound" },
    ],
  },

  '/daily-digest': {
    title: 'Daily Digest',
    welcomeMessage: "Your Daily Collections Health Digest summarizes key metrics and trends each day.",
    tips: [
      "Health Score (0-100) indicates overall collections health",
      "AR breakdown shows balances by aging bucket",
      "Payment trends compare this week vs last week",
      "Navigate between dates to review historical performance",
    ],
  },

  '/team': {
    title: 'Team & Roles',
    welcomeMessage: "Manage your team members and their access levels from this page.",
    tips: [
      "Invite team members by email - they'll receive a secure invite link",
      "Assign roles: Admin, Member, or Viewer based on needed access",
      "Deactivate members instead of deleting to preserve billing history",
      "Reassign seats to new team members without extra charges",
    ],
  },

  '/reconciliation': {
    title: 'Reconciliation',
    welcomeMessage: "The Reconciliation page helps you match imported payments to invoices.",
    tips: [
      "Payments are auto-matched using Recouply Invoice IDs",
      "Review low-confidence matches before applying",
      "Bulk approve matched payments to update invoice statuses",
      "Unmatched payments can be manually assigned",
    ],
    quickActions: [
      { label: "Import Payments", path: "/data-center" },
    ],
  },

  '/settings': {
    title: 'Settings',
    welcomeMessage: "Configure your Recouply.ai account settings, integrations, and preferences.",
    tips: [
      "Set up email sending to customize your From address",
      "Configure branding to include your logo in outreach",
      "Manage security settings like MFA for extra protection",
      "Review data retention and privacy settings",
    ],
    quickActions: [
      { label: "Branding", path: "/branding" },
      { label: "Security", path: "/security" },
    ],
  },

  '/branding': {
    title: 'Branding',
    welcomeMessage: "Customize your collection emails with your company branding.",
    tips: [
      "Upload your logo - it appears in all outbound emails",
      "Set brand colors for consistent visual identity",
      "Add a custom email signature for personal touch",
      "Configure payment links to include in collection emails",
    ],
  },

  '/profile': {
    title: 'Profile',
    welcomeMessage: "Manage your personal profile and account information.",
    tips: [
      "Update your display name and avatar",
      "Review your subscription and billing details",
      "Check your invoice usage against plan limits",
      "Manage team members from here if you're an owner",
    ],
    quickActions: [
      { label: "Billing", path: "/billing" },
      { label: "Team", path: "/team" },
    ],
  },

  '/documents': {
    title: 'Documents',
    welcomeMessage: "Store and manage important documents like W9s, contracts, and tax forms.",
    tips: [
      "Upload documents to keep everything organized",
      "Control which documents appear on your public AR page",
      "Track document expiration dates for compliance",
      "Link documents to specific accounts when needed",
    ],
  },

  '/personas': {
    title: 'AI Agents',
    welcomeMessage: "Meet your AI collection agents - each with a unique personality for different aging stages.",
    tips: [
      "Sam (0-30 days): Friendly, helpful - perfect for early follow-ups",
      "James (31-60 days): Professional, direct - escalating tone",
      "Katy (61-90 days): Firm but fair - emphasizing urgency",
      "Troy, Gotti, Rocco: Progressively more serious for older debts",
    ],
    quickActions: [
      { label: "Configure Workflows", path: "/settings/ai-workflows" },
    ],
  },
};

// Get content for current page, with fallback
export const getPageOnboardingContent = (pathname: string): PageOnboardingContent | null => {
  // Direct match
  if (PAGE_ONBOARDING_CONTENT[pathname]) {
    return PAGE_ONBOARDING_CONTENT[pathname];
  }

  // Handle dynamic routes
  if (pathname.startsWith('/debtors/')) {
    return {
      title: 'Account Detail',
      welcomeMessage: "View comprehensive collection intelligence for this account.",
      tips: [
        "Account Intelligence shows risk analysis and recommended strategies",
        "View all invoices and their collection status",
        "See communication history and task activity",
        "Use AI Outreach to send personalized collection messages",
      ],
    };
  }

  if (pathname.startsWith('/invoices/')) {
    return {
      title: 'Invoice Detail',
      welcomeMessage: "Complete details and collection history for this invoice.",
      tips: [
        "Apply payments directly from this page",
        "View all outreach history and communications",
        "Pause outreach if needed for special circumstances",
        "See the assigned AI workflow and next scheduled actions",
      ],
    };
  }

  if (pathname.startsWith('/data-center/review/')) {
    return {
      title: 'Review Import',
      welcomeMessage: "Review and finalize your data import before it's processed.",
      tips: [
        "Check match status for each row - green means matched",
        "Manually assign unmatched rows to existing accounts",
        "Delete rows with errors before finalizing",
        "Use bulk actions to speed up review process",
      ],
    };
  }

  return null;
};
