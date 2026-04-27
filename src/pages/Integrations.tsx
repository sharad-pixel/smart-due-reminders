import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import MarketingLayout from "@/components/layout/MarketingLayout";
import SEO from "@/components/seo/SEO";
import { 
  ArrowRight, 
  Check, 
  Shield, 
  MessageSquare, 
  Database, 
  Brain,
  Clock,
  Users,
  FileCheck,
  Zap,
  Lock,
  RefreshCw,
  FileText,
  Sparkles,
  ScanSearch
} from "lucide-react";
import stripeLogo from "@/assets/stripe-logo.png";
import quickbooksLogo from "@/assets/quickbooks-logo.png";
import googleDriveLogo from "@/assets/google-drive-logo.png";
import googleSheetsLogo from "@/assets/google-sheets-logo.png";

const IntegrationCard = ({ 
  logo, 
  title, 
  description, 
  highlights, 
  ctaText 
}: { 
  logo: string; 
  title: string; 
  description: string; 
  highlights: string[]; 
  ctaText: string;
}) => (
  <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
    <CardHeader>
      <div className="flex items-center gap-4 mb-4">
        <div className="h-14 w-14 rounded-xl bg-background border border-border flex items-center justify-center overflow-hidden">
          <img src={logo} alt={title} className="h-10 w-10 object-contain" />
        </div>
        <CardTitle className="text-2xl">{title}</CardTitle>
      </div>
      <CardDescription className="text-base leading-relaxed">
        {description}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <ul className="space-y-3 mb-6">
        {highlights.map((highlight, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <span className="text-muted-foreground">{highlight}</span>
          </li>
        ))}
      </ul>
      <Button className="gap-2" asChild>
        <Link to="/signup">
          {ctaText}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </CardContent>
  </Card>
);

const FeatureBlock = ({ 
  icon: Icon, 
  title, 
  description 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
}) => (
  <div className="flex items-start gap-4">
    <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </div>
);

const Integrations = () => {
  return (
    <MarketingLayout>
      <SEO
        title="Integrations | Stripe, QuickBooks, Google Sheets & AI Smart Ingestion | Recouply.ai"
        description="Connect Stripe, QuickBooks, Google Sheets, or use AI Smart Ingestion to extract invoices from Google Drive PDFs. Real-time accounts receivable sync, collections health visibility, and AI automation."
        canonical="https://recouply.ai/integrations"
        keywords="cash collections, accounts receivable, payments, AI automation for receivables, collections health, Stripe integration, QuickBooks integration, smart ingestion, Google Drive PDF, AR automation"
      />

      {/* Hero Section */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
            Connect your revenue stack.
            <br />
            <span className="text-primary">Centralize collections.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Recouply.ai integrates directly with Stripe, QuickBooks, Google Sheets, and Google Drive — syncing customers, invoices, and payments or extracting them from PDFs with AI-powered Smart Ingestion.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" className="gap-2" asChild>
              <Link to="/signup">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/contact">Talk to Sales</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stripe Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden">
                <img src={stripeLogo} alt="Stripe" className="h-7 w-7 object-contain" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold">Stripe</h2>
            </div>
            <p className="text-muted-foreground mb-8 max-w-2xl">
              Connect once. Unpaid invoices are automatically monitored and actioned — zero manual follow-ups required.
            </p>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-2xl">Stripe Integration</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Recouply.ai connects to Stripe to automatically sync customers, invoices, balances, and payments in real time. Your collections workflows stay continuously aligned with payment activity — without manual reconciliation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {[
                    "Auto-sync Stripe customers and invoices",
                    "Track open balances and partial payments",
                    "Reflect real-time payment updates",
                    "Maintain a complete audit trail",
                    "Reduce finance and ops overhead",
                  ].map((highlight, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{highlight}</span>
                    </li>
                  ))}
                </ul>
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium mb-1">Set it and forget it</p>
                      <p className="text-sm text-muted-foreground">
                        Once connected, AI orchestration runs continuously in the background. Every unpaid invoice automatically gets the right attention at the right time. You can step in manually anytime, but you don't need to.
                      </p>
                    </div>
                  </div>
                </div>
                <Button className="gap-2" asChild>
                  <Link to="/signup">
                    Connect Stripe
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* QuickBooks Section */}
      <section className="py-16 md:py-24 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden">
                <img src={quickbooksLogo} alt="QuickBooks" className="h-7 w-7 object-contain" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold">QuickBooks Online</h2>
            </div>
            <p className="text-muted-foreground mb-8 max-w-2xl">
              Make your accounting system the source of truth while Recouply.ai handles collections automatically.
            </p>
            <IntegrationCard
              logo={quickbooksLogo}
              title="QuickBooks Online Integration"
              description="Connect QuickBooks Online to make your accounting system the source of truth while Recouply.ai automates collections, tracking, and follow-ups. Invoices, balances, and payments stay aligned with QuickBooks — Recouply.ai handles the operational complexity."
              highlights={[
                "Sync customers, invoices, and payments securely",
                "Track open, paid, and partially paid invoices",
                "Keep balances aligned with QuickBooks",
                "Eliminate CSV exports and manual uploads",
                "Built with safeguards for reliable syncing",
              ]}
              ctaText="Connect QuickBooks"
            />
          </div>
        </div>
      </section>

      {/* AI Smart Ingestion Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden">
                <img src={googleDriveLogo} alt="Google Drive" className="h-7 w-7 object-contain" loading="lazy" width={28} height={28} />
              </div>
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold">AI Smart Ingestion</h2>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                OCR Built-In
              </span>
            </div>
            <p className="text-muted-foreground mb-8 max-w-2xl">
              Connect your Google Drive folder and let AI extract invoice data from any PDF — including scanned paper invoices, photos, and low-quality images — using built-in OCR. No manual data entry required.
            </p>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
              <CardHeader>
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 flex items-center justify-center">
                    <ScanSearch className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Google Drive PDF Extraction</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">AI-Powered</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">$0.75/page</span>
                    </div>
                  </div>
                </div>
                <CardDescription className="text-base leading-relaxed">
                  Recouply.ai uses Gemini AI with built-in OCR to scan and extract invoice data from any PDF in your Google Drive — digital exports, scanned paper invoices, faxed copies, or even photos snapped on a phone. Each file is analyzed for invoice numbers, amounts, dates, debtor details, and more — with a confidence score so you can review before importing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {[
                    "Connect your Google Drive folder via secure OAuth",
                    "Built-in OCR reads scanned paper invoices, photos, and low-quality PDFs",
                    "AI extracts invoice number, amount, dates, and debtor info from any PDF",
                    "Confidence scoring with detailed extraction breakdown",
                    "Review queue with bulk approve, reject, and edit capabilities",
                    "Automatic debtor matching or creation from extracted data",
                    "Smart duplicate detection to prevent double-imports",
                  ].map((highlight, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{highlight}</span>
                    </li>
                  ))}
                </ul>
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium mb-1">Usage-based pricing — billed per page</p>
                      <p className="text-sm text-muted-foreground">
                        You're charged $0.75 per page when you approve an extraction in the review queue (e.g. a 3-page invoice = $2.25). Rejected or duplicate files are free. Charges are aggregated monthly on your existing billing cycle.
                      </p>
                    </div>
                  </div>
                </div>
                <Button className="gap-2" asChild>
                  <Link to="/signup">
                    Start Extracting Invoices
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Google Sheets Source of Truth Section */}
      <section className="py-16 md:py-24 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden">
                <img src={googleSheetsLogo} alt="Google Sheets" className="h-7 w-7 object-contain" loading="lazy" width={28} height={28} />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold">Google Sheets</h2>
            </div>
            <p className="text-muted-foreground mb-8 max-w-2xl">
              Use Google Sheets as your source of truth for accounts, invoices, and payments — with bidirectional sync powered by AI.
            </p>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
              <CardHeader>
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/20 flex items-center justify-center overflow-hidden">
                    <img src={googleSheetsLogo} alt="Google Sheets" className="h-9 w-9 object-contain" loading="lazy" width={36} height={36} />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Google Sheets Source of Truth</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Bidirectional Sync</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">AI-Powered</span>
                    </div>
                  </div>
                </div>
                <CardDescription className="text-base leading-relaxed">
                  Recouply.ai creates and maintains three master spreadsheets — Accounts, Invoices, and Payments — with manual Push and Pull synchronization. Import new accounts from sheets with AI-powered name cleaning, or export your portfolio for offline review and reconciliation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {[
                    "Three master spreadsheets: Accounts, Invoices, and Payments",
                    "Bidirectional Push & Pull sync via RAID/Ref ID matching",
                    "AI-powered company name cleaning and standardization (Gemini)",
                    "New account staging with bulk approve/reject controls",
                    "Sync protection prevents accidental mass data deletion",
                    "Works alongside Stripe, QuickBooks, and other source systems",
                  ].map((highlight, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{highlight}</span>
                    </li>
                  ))}
                </ul>
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <RefreshCw className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium mb-1">Always in sync, always in control</p>
                      <p className="text-sm text-muted-foreground">
                        Push your latest Recouply data to Sheets for reporting, or Pull updates back in. Records are matched by RAID regardless of their original integration source — giving you one unified view across all systems.
                      </p>
                    </div>
                  </div>
                </div>
                <Button className="gap-2" asChild>
                  <Link to="/signup">
                    Connect Google Sheets
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CSV / Excel Upload Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FileCheck className="h-6 w-6" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold">CSV & Excel Upload</h2>
            </div>
            <p className="text-muted-foreground mb-8 max-w-2xl">
              No billing integration? No problem. Upload your AR data directly and let Recouply.ai handle the rest.
            </p>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
              <CardHeader>
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center">
                    <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Bulk Data Import</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">Drag & Drop</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">Auto-Mapping</span>
                    </div>
                  </div>
                </div>
                <CardDescription className="text-base leading-relaxed">
                  Upload CSV or Excel files containing your accounts, invoices, and payments. Recouply.ai automatically maps columns, validates data, and imports records — ready for AI-powered collections workflows in minutes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {[
                    "Drag-and-drop CSV and Excel file uploads",
                    "Automatic column mapping with smart field detection",
                    "Built-in data validation and error highlighting",
                    "Bulk import accounts, invoices, and payments in one upload",
                    "Duplicate detection to prevent double-counting",
                    "Ideal for teams migrating from spreadsheets or legacy systems",
                  ].map((highlight, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{highlight}</span>
                    </li>
                  ))}
                </ul>
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium mb-1">From spreadsheet to collections in minutes</p>
                      <p className="text-sm text-muted-foreground">
                        Upload your AR aging report, map the columns, and Recouply.ai instantly creates customer accounts and invoices — complete with risk scoring and automated follow-up workflows.
                      </p>
                    </div>
                  </div>
                </div>
                <Button className="gap-2" asChild>
                  <Link to="/signup">
                    Upload Your Data
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stripe AI Orchestration */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Brain className="h-4 w-4" />
              AI-Powered Collections
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Your invoices. Intelligent follow-up.
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Recouply.ai is an AI-powered orchestration layer for accounts receivable and revenue recovery. With native Stripe, QuickBooks, Google Sheets, and AI Smart Ingestion integrations, unpaid invoices automatically receive the right attention — without manual follow-ups or client-side effort. Recouply.ai continuously assesses payment risk, orchestrates outreach, and improves over time to help businesses get paid faster without adding finance headcount.
            </p>
            <div className="flex flex-wrap gap-6 justify-center text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                No handoffs
              </span>
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                No lost context
              </span>
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                No fragmented workflows
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Intelligence & Risk Layer */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                  <Brain className="h-4 w-4" />
                  Collection Intelligence
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  Collections data that works beyond collections
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Recouply.ai uses historical payment behavior and engagement data to assess collection risk and inform future customer decisions.
                </p>
                <p className="text-muted-foreground">
                  Collection intelligence doesn't just reduce risk — it helps teams make smarter decisions around renewals, expansions, and customer health.
                </p>
              </div>
              <div className="grid gap-4">
                <FeatureBlock
                  icon={Zap}
                  title="Predictive Risk Scoring"
                  description="Identify at-risk accounts before they become problems"
                />
                <FeatureBlock
                  icon={RefreshCw}
                  title="Renewal Intelligence"
                  description="Use payment history to inform expansion decisions"
                />
                <FeatureBlock
                  icon={FileCheck}
                  title="Audit-Ready Reporting"
                  description="Complete visibility into every collection action"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 24/7 Slack Support */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1 grid gap-4">
                <FeatureBlock
                  icon={Clock}
                  title="24/7 Access"
                  description="Real humans available around the clock, not bots"
                />
                <FeatureBlock
                  icon={MessageSquare}
                  title="Direct Slack Channel"
                  description="Faster resolution via Slack, not ticket queues"
                />
                <FeatureBlock
                  icon={Users}
                  title="Proactive Guidance"
                  description="Expert support during onboarding and scaling"
                />
                <FeatureBlock
                  icon={Zap}
                  title="Finance-Ready"
                  description="Designed for finance and operations teams"
                />
              </div>
              <div className="order-1 md:order-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                  <MessageSquare className="h-4 w-4" />
                  Real-Time Support
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">
                  24/7 Slack Support
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Recouply.ai provides direct, real-time support through Slack — not ticket queues.
                </p>
                <p className="text-muted-foreground">
                  Get help from real engineers and product experts whenever you need it, whether you're onboarding, running a sync, or troubleshooting edge cases.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Security */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              Enterprise Security
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Built for financial teams
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Recouply.ai integrations are built with security and reliability in mind.
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {[
                { icon: Lock, label: "Secure OAuth connections" },
                { icon: Shield, label: "No credential sharing" },
                { icon: Users, label: "Granular permissions" },
                { icon: FileCheck, label: "Audit-ready logs" },
                { icon: Database, label: "Enterprise-grade data handling" },
              ].map((item, index) => (
                <div key={index} className="p-4 rounded-xl bg-card border border-border/50 text-center">
                  <item.icon className="h-6 w-6 text-primary mx-auto mb-3" />
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to centralize your collections?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Connect your revenue stack in minutes. Start with a free trial.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" className="gap-2" asChild>
              <Link to="/signup">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/contact?intent=demo">Request a Demo</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Integrations;
