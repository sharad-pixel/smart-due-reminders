import celebrateCashHero from "@/assets/blog/celebrate-cash-hero.png";
import powerOfOutreachHero from "@/assets/blog/power-of-outreach-hero.png";
import cashLeakageHero from "@/assets/blog/cash-leakage-hero.png";
import futureAiCollectionsHero from "@/assets/blog/future-ai-collections-hero.jpg";
import revenueNotCashflowHero from "@/assets/blog/revenue-not-cashflow-hero.jpg";
import collectionsIntelligenceHero from "@/assets/blog/collections-intelligence-platforms-hero.jpg";
import timingMattersHero from "@/assets/blog/timing-matters-receivables-hero.jpg";
import engagementCreditHero from "@/assets/blog/engagement-credit-signal-hero.jpg";
import hiddenCostHero from "@/assets/blog/hidden-cost-delayed-payments-hero.jpg";
import dataTrustHero from "@/assets/blog/data-trust-ar-automation-hero.jpg";
import spreadsheetsToSystemsHero from "@/assets/blog/spreadsheets-to-systems-hero.jpg";
import predictiveCollectionsHero from "@/assets/blog/predictive-collections-hero.jpg";
import nextGenArHero from "@/assets/blog/next-gen-ar-teams-hero.jpg";
import deathTraditionalCollectionsHero from "@/assets/blog/death-traditional-collections-hero.jpg";
import setItForgetItHero from "@/assets/blog/set-it-forget-it-automation-hero.jpg";
import realtimeRiskHero from "@/assets/blog/realtime-risk-operational-hero.jpg";
import collectionsNeedsCrmHero from "@/assets/blog/collections-needs-crm-hero.jpg";
import ftArchitectureHero from "@/assets/blog/ft-architecture-hero.jpg";
import ftSpreadsheetHero from "@/assets/blog/ft-spreadsheet-to-app-hero.jpg";
import ftControlCenterHero from "@/assets/blog/ft-control-center-hero.jpg";
import founderImage from "@/assets/founder-sharad.jpg";

export interface BlogAuthor {
  name: string;
  title: string;
  image: string;
  bio: string;
}

export type ResourceContentType =
  | "article"
  | "guide"
  | "whitepaper"
  | "playbook"
  | "case-study";

export interface BlogPost {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  category: string;
  author: BlogAuthor;
  publishDate: string;
  publishDateISO: string;
  readingTime: string;
  heroImage: string;
  heroAlt: string;
  keywords: string;
  featured?: boolean;
  /** Optional cornerstone series grouping (e.g. "The Revenue Intelligence Series"). */
  series?: string;
  /** Editorial curation flag surfaced in the /resources hub. */
  editorsPick?: boolean;
  /** Simple popularity signal for sorting Most Popular. */
  popularity?: number;
  /** Content type — future-proofs Guides / Playbooks / Case Studies / Whitepapers. */
  contentType?: ResourceContentType;
  /** Topic tags used for filtering and internal-link recommendations. */
  topics?: string[];
}

// Define authors
export const authors: Record<string, BlogAuthor> = {
  sharad: {
    name: "Sharad Chanana",
    title: "Founder & CEO, Recouply.ai",
    image: founderImage,
    bio: "Sharad has spent over a decade in B2B SaaS and fintech, building and scaling revenue operations at high-growth companies. He founded Recouply.ai to bring enterprise-grade Revenue Intelligence to businesses of all sizes.",
  },
};

// All blog posts - add new posts here
export const blogPosts: BlogPost[] = [
  {
    slug: "celebrate-cash",
    title: "We Ring the Gong for Bookings. Why Don't We Celebrate Cash?",
    metaTitle: "Why Cash Collection Deserves a Gong | Recouply.ai",
    metaDescription: "Bookings are a promise — cash completes the deal. Learn why cash collection deserves the same celebration as bookings and how automation drives growth.",
    excerpt: "Bookings are a promise — cash completes the deal. Learn why cash collection deserves the same celebration.",
    category: "Revenue Intelligence",
    author: authors.sharad,
    publishDate: "January 17, 2026",
    publishDateISO: "2026-01-17",
    readingTime: "5 min read",
    heroImage: celebrateCashHero,
    heroAlt: "Illustration showing sales teams celebrating bookings with a gong while finance teams celebrate cash collection with a digital dashboard",
    keywords: "cash collection, bookings, revenue, accounts receivable, collection intelligence, cash flow, SaaS finance",
    featured: true,
  },
  {
    slug: "power-of-outreach",
    title: "The Power of Outreach: Why Timely Payment Reminders Drive Cash Collection",
    metaTitle: "Why Automated Payment Reminders Improve Collections | Recouply.ai",
    metaDescription: "Timely outreach and automated payment reminders significantly increase collectability rates and reduce days to pay. Learn why early engagement matters.",
    excerpt: "Timely outreach and automated payment reminders significantly increase collectability rates and reduce days to pay.",
    category: "Revenue Intelligence",
    author: authors.sharad,
    publishDate: "January 17, 2026",
    publishDateISO: "2026-01-17",
    readingTime: "6 min read",
    heroImage: powerOfOutreachHero,
    heroAlt: "Illustration showing automated digital outreach for payments with timeline, reminders, and dashboard",
    keywords: "payment reminders, collections outreach, automated collections, accounts receivable, cash flow, collection intelligence",
    featured: false,
  },
  {
    slug: "cash-leakage",
    title: "How Finance Teams Lose Cash Without Realizing It",
    metaTitle: "How Finance Teams Lose Cash Without Realizing It | Recouply.ai",
    metaDescription: "Finance teams lose cash quietly through delayed outreach and reactive AR processes. Learn how collections intelligence prevents silent cash leakage.",
    excerpt: "Finance teams don't lose cash dramatically — they lose it quietly through delayed outreach, lack of visibility, and reactive AR processes.",
    category: "Revenue Intelligence",
    author: authors.sharad,
    publishDate: "January 22, 2026",
    publishDateISO: "2026-01-22",
    readingTime: "8 min read",
    heroImage: cashLeakageHero,
    heroAlt: "Visualization of invoices fading and dissolving representing silent cash leakage in accounts receivable",
    keywords: "collections intelligence, accounts receivable automation, invoice collectibility, early invoice follow-up, AR cash leakage",
    featured: true,
  },
  {
    slug: "future-of-ai-in-collections",
    title: "The Future of AI in Collections: From Automation to Autonomous Recovery",
    metaTitle: "The Future of AI in Collections | Recouply.ai",
    metaDescription: "AI in collections is evolving from rule-based automation to autonomous recovery agents. Explore what the next era of intelligent AR looks like.",
    excerpt: "AI in collections is moving beyond rule-based automation toward autonomous, context-aware recovery systems that operate with minimal human intervention.",
    category: "AI & Automation",
    author: authors.sharad,
    publishDate: "February 5, 2026",
    publishDateISO: "2026-02-05",
    readingTime: "7 min read",
    heroImage: futureAiCollectionsHero,
    heroAlt: "AI neural networks connecting to financial data streams and invoice documents",
    keywords: "AI collections, autonomous recovery, machine learning receivables, AI agents AR, intelligent collections automation",
    featured: true,
  },
  {
    slug: "revenue-does-not-equal-cash-flow",
    title: "Why Revenue Does Not Equal Cash Flow — And Why It Matters",
    metaTitle: "Revenue vs Cash Flow: Why They're Not the Same | Recouply.ai",
    metaDescription: "Revenue on the books does not mean cash in the bank. Learn why the gap between revenue and cash flow threatens growth and how to close it.",
    excerpt: "Revenue on the books does not mean cash in the bank. The gap between recognized revenue and collected cash is where businesses quietly lose momentum.",
    category: "Cash Flow",
    author: authors.sharad,
    publishDate: "February 12, 2026",
    publishDateISO: "2026-02-12",
    readingTime: "6 min read",
    heroImage: revenueNotCashflowHero,
    heroAlt: "Conceptual visualization of revenue flowing as a river versus cash flow as a diverging stream",
    keywords: "revenue vs cash flow, working capital, cash conversion cycle, SaaS cash flow, accounts receivable management",
    featured: false,
  },
  {
    slug: "rise-of-collections-intelligence",
    title: "The Rise of Revenue Intelligence Platforms",
    metaTitle: "Revenue Intelligence Platforms: A New Category | Recouply.ai",
    metaDescription: "Collections intelligence platforms combine AI, behavioral data, and workflow automation to replace reactive AR processes. Here's why they're emerging now.",
    excerpt: "A new category of platform is emerging that combines AI, behavioral signals, and workflow orchestration to transform how businesses recover revenue.",
    category: "Revenue Intelligence",
    author: authors.sharad,
    publishDate: "February 20, 2026",
    publishDateISO: "2026-02-20",
    readingTime: "7 min read",
    heroImage: collectionsIntelligenceHero,
    heroAlt: "Intelligence platform with interconnected data nodes and predictive analytics dashboards",
    keywords: "collections intelligence platform, AR technology, revenue recovery platform, AI collections software, receivables intelligence",
    featured: true,
  },
  {
    slug: "timing-matters-more-than-tone",
    title: "Why Timing Matters More Than Tone in Receivables",
    metaTitle: "Timing vs Tone in Collections: What Drives Results | Recouply.ai",
    metaDescription: "In receivables, when you reach out matters more than how you say it. Learn why timing is the strongest lever for improving collection outcomes.",
    excerpt: "Finance teams obsess over the perfect email template. But research shows that when you reach out matters far more than what you say.",
    category: "Revenue Intelligence",
    author: authors.sharad,
    publishDate: "March 1, 2026",
    publishDateISO: "2026-03-01",
    readingTime: "6 min read",
    heroImage: timingMattersHero,
    heroAlt: "Clock and calendar visualization with invoice timeline arrows showing optimal timing windows",
    keywords: "collections timing, payment reminder timing, AR outreach optimization, receivables follow-up, invoice follow-up best practices",
    featured: false,
  },
  {
    slug: "engagement-as-credit-signal",
    title: "Engagement as a New Credit Signal: Rethinking Debtor Risk",
    metaTitle: "Engagement as a Credit Signal in Collections | Recouply.ai",
    metaDescription: "Traditional credit scoring misses real-time behavioral signals. Learn how engagement data is becoming the most reliable predictor of payment behavior.",
    excerpt: "Traditional credit scores tell you what happened last year. Engagement signals tell you what is happening right now — and that changes how you assess risk.",
    category: "Risk Intelligence",
    author: authors.sharad,
    publishDate: "March 8, 2026",
    publishDateISO: "2026-03-08",
    readingTime: "7 min read",
    heroImage: engagementCreditHero,
    heroAlt: "Engagement signals as data points forming a credit score meter with communication icons",
    keywords: "engagement credit signal, debtor risk scoring, behavioral analytics AR, payment prediction, collections risk assessment",
    featured: false,
  },
  {
    slug: "hidden-cost-of-delayed-payments",
    title: "The Hidden Cost of Delayed Payments: What Late Invoices Really Cost You",
    metaTitle: "The True Cost of Late Payments for Businesses | Recouply.ai",
    metaDescription: "Late payments cost more than just cash. They erode margins, increase borrowing, and consume team bandwidth. Here's how to quantify the real impact.",
    excerpt: "Late payments don't just delay cash — they compound costs across your entire operation in ways that rarely show up on a P&L statement.",
    category: "Cash Flow",
    author: authors.sharad,
    publishDate: "March 15, 2026",
    publishDateISO: "2026-03-15",
    readingTime: "6 min read",
    heroImage: hiddenCostHero,
    heroAlt: "Coins and currency dissolving and fading representing hidden costs of delayed payments",
    keywords: "cost of late payments, delayed payment impact, working capital cost, invoice aging cost, AR efficiency",
    featured: false,
  },
  {
    slug: "data-trust-in-ar-automation",
    title: "Why Data Trust Matters in AR Automation",
    metaTitle: "Data Trust in Accounts Receivable Automation | Recouply.ai",
    metaDescription: "AR automation only works when teams trust the data driving it. Learn why data integrity is the foundation of effective receivables automation.",
    excerpt: "Automation without data trust creates faster mistakes. In AR, the quality of your data determines whether automation helps or hurts your cash flow.",
    category: "AI & Automation",
    author: authors.sharad,
    publishDate: "March 20, 2026",
    publishDateISO: "2026-03-20",
    readingTime: "6 min read",
    heroImage: dataTrustHero,
    heroAlt: "Secure data vault with verified checkmarks surrounding AR automation workflows",
    keywords: "data trust AR, data quality receivables, AR automation data integrity, accounts receivable data management, clean data collections",
    featured: false,
  },
  {
    slug: "spreadsheets-to-systems-of-record",
    title: "From Spreadsheets to Systems of Record in Collections",
    metaTitle: "Moving from Spreadsheets to AR Systems of Record | Recouply.ai",
    metaDescription: "Most AR teams still run on spreadsheets. Learn why migrating to a system of record is essential for scaling collections and reducing operational risk.",
    excerpt: "Spreadsheets got you here. But they won't get you to the next level of collections maturity — and the risks of staying on them are growing.",
    category: "Operations",
    author: authors.sharad,
    publishDate: "March 25, 2026",
    publishDateISO: "2026-03-25",
    readingTime: "7 min read",
    heroImage: spreadsheetsToSystemsHero,
    heroAlt: "Scattered spreadsheet cells morphing into an organized digital system of record",
    keywords: "AR system of record, spreadsheet collections, accounts receivable software, collections operations, AR digital transformation",
    featured: false,
  },
  {
    slug: "predictive-collections-revenue-risk",
    title: "Predictive Collections and Revenue Risk: Seeing What's Coming",
    metaTitle: "Predictive Collections: Forecasting Revenue Risk | Recouply.ai",
    metaDescription: "Predictive collections uses AI to forecast which invoices are at risk before they age. Learn how forward-looking AR intelligence protects cash flow.",
    excerpt: "The best collections strategy is the one that acts before an invoice becomes a problem. Predictive intelligence makes that possible at scale.",
    category: "Risk Intelligence",
    author: authors.sharad,
    publishDate: "March 28, 2026",
    publishDateISO: "2026-03-28",
    readingTime: "7 min read",
    heroImage: predictiveCollectionsHero,
    heroAlt: "Predictive analytics with forecast curves and risk heat maps for revenue collections",
    keywords: "predictive collections, revenue risk forecasting, AI invoice risk, AR predictive analytics, collections forecasting",
    featured: true,
  },
  {
    slug: "next-generation-ar-teams",
    title: "The Next Generation of AR Teams: Human + AI Operating Models",
    metaTitle: "Next-Gen AR Teams: Human + AI Operating Models | Recouply.ai",
    metaDescription: "The future AR team is smaller, more strategic, and augmented by AI agents. Learn how the operating model for accounts receivable is being redefined.",
    excerpt: "Tomorrow's AR team won't be larger — it will be more strategic. AI agents handle volume and consistency while humans focus on relationships and exceptions.",
    category: "AI & Automation",
    author: authors.sharad,
    publishDate: "April 1, 2026",
    publishDateISO: "2026-04-01",
    readingTime: "7 min read",
    heroImage: nextGenArHero,
    heroAlt: "Modern AR team working with AI agents and digital dashboards collaboratively",
    keywords: "next generation AR teams, AI augmented collections, human AI receivables, AR team structure, future of accounts receivable",
    featured: false,
  },
  {
    slug: "death-of-traditional-collections",
    title: "Death of Traditional Collections",
    metaTitle: "Death of Traditional Collections | Recouply.ai",
    metaDescription: "Traditional collections is dead. Meet the AI-powered Revenue Intelligence Platform built for real-time cash flow.",
    excerpt: "Traditional collections is broken—here's the new operating model built on AI, real-time risk, and a true system of record.",
    category: "Revenue Intelligence Platform",
    author: authors.sharad,
    publishDate: "January 28, 2026",
    publishDateISO: "2026-01-28",
    readingTime: "7 min read",
    heroImage: deathTraditionalCollectionsHero,
    heroAlt: "Traditional paper invoices and filing cabinets dissolving into digital particles representing the death of old-school collections",
    keywords: "collections, accounts receivable, AR automation, risk assessment, CRM, AI collections, Stripe, QuickBooks, B2B SaaS",
    featured: true,
  },
  {
    slug: "set-it-and-forget-it-automation",
    title: "Set It and Forget It: The New Standard for Collections Automation",
    metaTitle: "Set It and Forget It Automation | Recouply.ai",
    metaDescription: "Automate collections with AI agents and risk-based playbooks. Sync Stripe and QuickBooks, then let Recouply.ai drive cash flow.",
    excerpt: "Turn collections into a self-driving workflow with AI agents, real-time syncing, and risk-based playbooks you set once and scale infinitely.",
    category: "AI & Automation",
    author: authors.sharad,
    publishDate: "February 18, 2026",
    publishDateISO: "2026-02-18",
    readingTime: "6 min read",
    heroImage: setItForgetItHero,
    heroAlt: "Autonomous workflow system with interconnected gears and flowing automation nodes",
    keywords: "collections automation, AI agents, AR, risk segmentation, Stripe, QuickBooks, receivables, workflows, SaaS finance",
    featured: true,
  },
  {
    slug: "risk-as-a-real-time-operational-system",
    title: "Risk as a Real-Time Operational System",
    metaTitle: "Risk as a Real-Time System | Recouply.ai",
    metaDescription: "Turn risk from a report into a live operating signal that drives collections, outreach, and cash outcomes.",
    excerpt: "Risk can't live in a weekly slide. It must drive actions in real time across collections, outreach, and escalation paths.",
    category: "Risk Intelligence",
    author: authors.sharad,
    publishDate: "March 12, 2026",
    publishDateISO: "2026-03-12",
    readingTime: "7 min read",
    heroImage: realtimeRiskHero,
    heroAlt: "Real-time risk monitoring dashboard with dynamic heat maps and live risk scores",
    keywords: "risk assessment, real-time risk, collections CRM, AR, behavioral signals, DSO, AI, receivables, finance operations",
    featured: false,
  },
  {
    slug: "why-collections-needs-a-crm",
    title: "Why Collections Needs a CRM (Like Salesforce for Sales)",
    metaTitle: "Why Collections Needs a CRM | Recouply.ai",
    metaDescription: "Collections needs a CRM: a system of record for invoices, risk, and AI workflows. See how Recouply.ai brings CRM discipline to cash.",
    excerpt: "Sales scaled with CRM. Collections will too—with a system of record built for invoices, risk, and AI-driven workflows.",
    category: "Revenue Intelligence Platform",
    author: authors.sharad,
    publishDate: "April 5, 2026",
    publishDateISO: "2026-04-05",
    readingTime: "7 min read",
    heroImage: collectionsNeedsCrmHero,
    heroAlt: "CRM system interface for collections showing organized customer records and AI intelligence layers",
    keywords: "collections CRM, AR, receivables, Salesforce analogy, system of record, audit logs, AI automation, finance ops, B2B SaaS",
    featured: true,
  },
  // ────────────────────────────────────────────────────────────
  // The Revenue Intelligence Series (cornerstone content)
  // ────────────────────────────────────────────────────────────
  {
    slug: "hidden-cost-of-contract-oversight",
    title: "The Hidden Cost of Contract Oversight: How Revenue Leakage Begins Before the First Invoice",
    metaTitle: "The Hidden Cost of Contract Oversight | Recouply.ai",
    metaDescription: "Revenue leakage doesn't start at collections — it starts in the contract. Learn how missed renewals, pricing ramps, and overlooked terms erode ARR before the first invoice.",
    excerpt: "Revenue leakage doesn't start at collections. It starts inside the contract — the moment terms, dates, and obligations stop being watched.",
    category: "Contract Intelligence",
    author: authors.sharad,
    publishDate: "May 5, 2026",
    publishDateISO: "2026-05-05",
    readingTime: "8 min read",
    heroImage: cashLeakageHero,
    heroAlt: "Contract pages with dissolving fine print representing hidden revenue leakage",
    keywords: "revenue leakage, contract oversight, missed renewals, pricing ramps, ASC 606, revenue recognition, contract intelligence",
    featured: true,
    editorsPick: true,
    popularity: 98,
    series: "The Revenue Intelligence Series",
    contentType: "article",
    topics: ["Contract Intelligence", "Revenue Intelligence", "ASC 606", "Risk Intelligence"],
  },
  {
    slug: "every-revenue-problem-starts-with-a-contract",
    title: "Every Revenue Problem Starts With a Contract",
    metaTitle: "Every Revenue Problem Starts With a Contract | Recouply.ai",
    metaDescription: "From order form to renewal, every downstream revenue issue traces back to a contract. See the full contract-to-cash chain and why disconnected systems break it.",
    excerpt: "Follow any revenue miss upstream and you'll land in the contract. Here's the full contract-to-cash chain — and where the breaks happen.",
    category: "Revenue Intelligence",
    author: authors.sharad,
    publishDate: "May 8, 2026",
    publishDateISO: "2026-05-08",
    readingTime: "9 min read",
    heroImage: collectionsIntelligenceHero,
    heroAlt: "Contract-to-cash chain visualization from signature to revenue recognition",
    keywords: "contract to cash, revenue operations, order form, revenue recognition, renewals, expansion, quote to cash",
    featured: true,
    editorsPick: true,
    popularity: 95,
    series: "The Revenue Intelligence Series",
    contentType: "article",
    topics: ["Revenue Intelligence", "Revenue Operations", "Contract Intelligence"],
  },
  {
    slug: "order-forms-as-structured-data",
    title: "Why Finance Teams Should Treat Order Forms Like Structured Data",
    metaTitle: "Order Forms as Structured Data | Recouply.ai",
    metaDescription: "PDFs are not a system of record. Learn why order forms belong in structured, operational data — ARR, ACV, TCV, ramps, and renewal notice fields all extractable and queryable.",
    excerpt: "Order forms carry ARR, ACV, ramps, and renewal notice terms — but sit in PDFs no system can read. Here's how AI turns them into structured operational data.",
    category: "Contract Intelligence",
    author: authors.sharad,
    publishDate: "May 12, 2026",
    publishDateISO: "2026-05-12",
    readingTime: "7 min read",
    heroImage: dataTrustHero,
    heroAlt: "Order form PDF being parsed into structured fields for finance systems",
    keywords: "order form data, structured contract data, ARR extraction, ACV, TCV, price escalators, auto-renewal, contract AI",
    featured: false,
    editorsPick: true,
    popularity: 88,
    series: "The Revenue Intelligence Series",
    contentType: "article",
    topics: ["Contract Intelligence", "OCR", "AI", "Finance Automation"],
  },
  {
    slug: "reactive-revenue-operations-costing-millions",
    title: "Reactive Revenue Operations Are Costing Companies Millions",
    metaTitle: "Reactive Revenue Operations Cost Millions | Recouply.ai",
    metaDescription: "Manual spreadsheets, missed renewals, late invoicing — reactive RevOps compounds silently into eight-figure leakage. Here's the proactive Revenue Intelligence alternative.",
    excerpt: "Manual spreadsheets, missed renewals, late invoicing, and forecast drift compound into eight-figure revenue leakage. Proactive intelligence is the fix.",
    category: "Revenue Operations",
    author: authors.sharad,
    publishDate: "May 15, 2026",
    publishDateISO: "2026-05-15",
    readingTime: "7 min read",
    heroImage: predictiveCollectionsHero,
    heroAlt: "Reactive vs proactive revenue operations dashboard comparison",
    keywords: "revenue operations, reactive RevOps, revenue leakage, forecast accuracy, quote to cash, finance automation",
    featured: false,
    editorsPick: true,
    popularity: 82,
    series: "The Revenue Intelligence Series",
    contentType: "article",
    topics: ["Revenue Operations", "Revenue Intelligence", "Finance Automation"],
  },
  {
    slug: "from-ocr-to-revenue-intelligence",
    title: "From OCR to Revenue Intelligence",
    metaTitle: "From OCR to Revenue Intelligence | Recouply.ai",
    metaDescription: "OCR is step one. Real value comes from turning contract text into revenue classification, risk detection, workflows, and financial exposure — a full Revenue Intelligence pipeline.",
    excerpt: "OCR is the easy part. Real Revenue Intelligence begins after extraction — when classification, risk, workflow, and financial exposure meet.",
    category: "AI",
    author: authors.sharad,
    publishDate: "May 20, 2026",
    publishDateISO: "2026-05-20",
    readingTime: "8 min read",
    heroImage: futureAiCollectionsHero,
    heroAlt: "AI pipeline from contract OCR to Revenue Intelligence dashboard",
    keywords: "OCR, contract AI, revenue intelligence, risk detection, contract workflows, financial exposure",
    featured: true,
    editorsPick: true,
    popularity: 90,
    series: "The Revenue Intelligence Series",
    contentType: "article",
    topics: ["AI", "OCR", "Contract Intelligence", "Revenue Intelligence"],
  },
  {
    slug: 'next-era-of-finance-transformation',
    title: 'The Next Era of Finance Transformation: Build the Workflow, Not Another Platform',
    metaTitle: 'Next Era of Finance Transformation | Recouply.ai',
    metaDescription: 'Finance transformation is shifting from buying platforms to building purpose-built workflow applications around existing systems of record.',
    excerpt: 'Finance transformation is shifting from buying a platform for every problem to building purpose-built workflows around the systems you already own.',
    category: "Finance Transformation",
    author: authors.sharad,
    publishDate: "Oct 6, 2026",
    publishDateISO: '2026-10-06',
    readingTime: "9 min read",
    heroImage: ftArchitectureHero,
    heroAlt: 'The Next Era of Finance Transformation: Build the Workflow, Not Another Platform',
    keywords: 'finance transformation, purpose-built business applications, AI-enabled application building, order to cash, systems of record',
    featured: false,
    editorsPick: true,
    popularity: 95,
    series: "The Finance Transformation Series",
    contentType: "article",
    topics: ["Finance Transformation", "O2C Transformation", "Custom Business Applications"],
  },
  {
    slug: 'from-spreadsheet-to-business-application',
    title: 'From Spreadsheet to Business Application: The Opportunity Finance Teams Are Missing',
    metaTitle: 'From Spreadsheet to Business Application | Recouply.ai',
    metaDescription: 'Critical finance workflows still run on Excel and email. Learn how modern application-building turns them into structured, controlled applications.',
    excerpt: "Many of finance's most important processes still run on Excel, email and Slack. They're prototypes waiting to become applications.",
    category: "Finance Transformation",
    author: authors.sharad,
    publishDate: "Oct 6, 2026",
    publishDateISO: '2026-10-06',
    readingTime: "8 min read",
    heroImage: ftSpreadsheetHero,
    heroAlt: 'From Spreadsheet to Business Application: The Opportunity Finance Teams Are Missing',
    keywords: 'spreadsheet to application, finance workflow automation, billing readiness, write-off approvals, credit approvals, low-code finance',
    featured: false,
    editorsPick: false,
    popularity: 94,
    series: "The Finance Transformation Series",
    contentType: "article",
    topics: ["Finance Transformation", "O2C Transformation", "Custom Business Applications"],
  },
  {
    slug: 'ai-changing-economics-of-custom-business-software',
    title: 'AI Is Changing the Economics of Custom Business Software',
    metaTitle: 'AI and the Economics of Custom Software | Recouply.ai',
    metaDescription: 'AI-assisted development lowers the cost of purpose-built finance applications — without making engineering, security or governance optional.',
    excerpt: 'Custom applications used to require full engineering teams. AI-assisted development changes the cost equation — not the need for governance.',
    category: "Finance Transformation",
    author: authors.sharad,
    publishDate: "Oct 6, 2026",
    publishDateISO: '2026-10-06',
    readingTime: "8 min read",
    heroImage: ftSpreadsheetHero,
    heroAlt: 'AI Is Changing the Economics of Custom Business Software',
    keywords: 'AI-assisted development, custom business software, purpose-built applications, finance applications, build economics',
    featured: false,
    editorsPick: false,
    popularity: 93,
    series: "The Finance Transformation Series",
    contentType: "article",
    topics: ["Finance Transformation", "O2C Transformation", "Custom Business Applications"],
  },
  {
    slug: 'build-vs-buy-wrong-question-modern-finance',
    title: 'Build vs. Buy Is the Wrong Question for Modern Finance',
    metaTitle: 'Build vs. Buy vs. Compose for Finance | Recouply.ai',
    metaDescription: 'Buy standardized capabilities, build differentiated workflows, compose cross-system processes. A modern framework for finance technology decisions.',
    excerpt: 'Buy when the capability is standardized, build when the workflow is differentiated, compose when the process spans platforms.',
    category: "Finance Transformation",
    author: authors.sharad,
    publishDate: "Oct 6, 2026",
    publishDateISO: '2026-10-06',
    readingTime: "7 min read",
    heroImage: ftArchitectureHero,
    heroAlt: 'Build vs. Buy Is the Wrong Question for Modern Finance',
    keywords: 'build vs buy, composable finance, finance technology strategy, quote to cash, enterprise architecture',
    featured: false,
    editorsPick: false,
    popularity: 92,
    series: "The Finance Transformation Series",
    contentType: "article",
    topics: ["Finance Transformation", "O2C Transformation", "Custom Business Applications"],
  },
  {
    slug: 'missing-layer-in-finance-transformation',
    title: 'The Missing Layer in Finance Transformation',
    metaTitle: 'The Operational Application Layer | Recouply.ai',
    metaDescription: 'Why finance transformations stall: systems of record get modernized while approvals, exceptions and ownership stay in Excel and email.',
    excerpt: 'Organizations invest in systems of record but leave approvals, exceptions and ownership running through Excel and email.',
    category: "Finance Transformation",
    author: authors.sharad,
    publishDate: "Oct 6, 2026",
    publishDateISO: '2026-10-06',
    readingTime: "7 min read",
    heroImage: ftArchitectureHero,
    heroAlt: 'The Missing Layer in Finance Transformation',
    keywords: 'operational application layer, finance transformation, workflow, approvals, exceptions, RACI, RAID',
    featured: false,
    editorsPick: true,
    popularity: 91,
    series: "The Finance Transformation Series",
    contentType: "article",
    topics: ["Finance Transformation", "O2C Transformation", "Custom Business Applications"],
  },
  {
    slug: 'erp-shouldnt-solve-every-finance-problem',
    title: "Why Your ERP Shouldn't Have to Solve Every Finance Problem",
    metaTitle: "Your ERP Shouldn't Solve Every Problem | Recouply.ai",
    metaDescription: 'When finance workflows belong inside the ERP versus in a connected purpose-built application — with practical examples.',
    excerpt: 'ERP is the system of record. Connected applications can handle workflows that change often or span multiple systems.',
    category: "Finance Transformation",
    author: authors.sharad,
    publishDate: "Oct 6, 2026",
    publishDateISO: '2026-10-06',
    readingTime: "7 min read",
    heroImage: ftArchitectureHero,
    heroAlt: "Why Your ERP Shouldn't Have to Solve Every Finance Problem",
    keywords: 'ERP customization, NetSuite, connected applications, finance workflows, system of record',
    featured: false,
    editorsPick: false,
    popularity: 90,
    series: "The Finance Transformation Series",
    contentType: "article",
    topics: ["Finance Transformation", "O2C Transformation", "Custom Business Applications"],
  },
  {
    slug: 'raci-and-raid-shouldnt-live-in-spreadsheets',
    title: "RACI and RAID Shouldn't Live in Spreadsheets",
    metaTitle: 'RACI and RAID Beyond Spreadsheets | Recouply.ai',
    metaDescription: 'Turn RACI and RAID into living governance linked to workstreams, owners, controls and milestones with a Transformation Control Center.',
    excerpt: 'Transformation governance works best when RACI and RAID are linked to workstreams, owners and controls — not static files.',
    category: "Finance Transformation",
    author: authors.sharad,
    publishDate: "Oct 6, 2026",
    publishDateISO: '2026-10-06',
    readingTime: "7 min read",
    heroImage: ftControlCenterHero,
    heroAlt: "RACI and RAID Shouldn't Live in Spreadsheets",
    keywords: 'RACI, RAID log, transformation governance, transformation control center, finance transformation',
    featured: false,
    editorsPick: false,
    popularity: 89,
    series: "The Finance Transformation Series",
    contentType: "article",
    topics: ["Finance Transformation", "O2C Transformation", "Custom Business Applications"],
  },
  {
    slug: 'order-to-cash-perfect-candidate-purpose-built-applications',
    title: 'Order-to-Cash Is a Perfect Candidate for Purpose-Built Applications',
    metaTitle: 'O2C and Purpose-Built Applications | Recouply.ai',
    metaDescription: 'O2C crosses CRM, contracts, billing, collections and revenue. Purpose-built applications fill the handoffs between systems.',
    excerpt: 'O2C crosses CRM, deal desk, contracts, billing, collections and revenue. The gaps between them are where applications create value.',
    category: "Finance Transformation",
    author: authors.sharad,
    publishDate: "Oct 6, 2026",
    publishDateISO: '2026-10-06',
    readingTime: "8 min read",
    heroImage: ftControlCenterHero,
    heroAlt: 'Order-to-Cash Is a Perfect Candidate for Purpose-Built Applications',
    keywords: 'order to cash, O2C transformation, billing readiness, deal desk, dispute management, collections intelligence',
    featured: false,
    editorsPick: true,
    popularity: 88,
    series: "The Finance Transformation Series",
    contentType: "article",
    topics: ["Finance Transformation", "O2C Transformation", "Custom Business Applications"],
  },
  {
    slug: 'finance-transformation-stack-of-the-future',
    title: 'The Finance Transformation Stack of the Future',
    metaTitle: 'Finance Transformation Stack of the Future | Recouply.ai',
    metaDescription: 'A five-layer finance stack: systems of record, data, applications, intelligence and governance — and how they work together.',
    excerpt: 'Five layers working together: systems of record, data, applications, intelligence and governance.',
    category: "Finance Transformation",
    author: authors.sharad,
    publishDate: "Oct 6, 2026",
    publishDateISO: '2026-10-06',
    readingTime: "7 min read",
    heroImage: ftArchitectureHero,
    heroAlt: 'The Finance Transformation Stack of the Future',
    keywords: 'finance technology stack, composable finance, data layer, AI agents, governance, finance architecture',
    featured: false,
    editorsPick: false,
    popularity: 87,
    series: "The Finance Transformation Series",
    contentType: "article",
    topics: ["Finance Transformation", "O2C Transformation", "Custom Business Applications"],
  },
  {
    slug: 'finance-teams-becoming-application-builders',
    title: 'Finance Teams Are About to Become Application Builders',
    metaTitle: 'Finance Teams as Application Builders | Recouply.ai',
    metaDescription: 'Finance understands processes, controls and rules — the core inputs for useful applications. AI-assisted development lets them build, with IT as partner.',
    excerpt: 'Finance professionals already understand processes, controls, exceptions and rules — the core inputs for designing applications.',
    category: "Finance Transformation",
    author: authors.sharad,
    publishDate: "Oct 6, 2026",
    publishDateISO: '2026-10-06',
    readingTime: "7 min read",
    heroImage: ftSpreadsheetHero,
    heroAlt: 'Finance Teams Are About to Become Application Builders',
    keywords: 'finance application builders, AI-assisted development, citizen development, finance and IT collaboration',
    featured: false,
    editorsPick: false,
    popularity: 86,
    series: "The Finance Transformation Series",
    contentType: "article",
    topics: ["Finance Transformation", "O2C Transformation", "Custom Business Applications"],
  },
];

// Helper functions
export const getBlogPostBySlug = (slug: string): BlogPost | undefined => {
  return blogPosts.find((post) => post.slug === slug);
};

export const getFeaturedPosts = (): BlogPost[] => {
  return blogPosts.filter((post) => post.featured);
};

export const getRecentPosts = (limit: number = 5): BlogPost[] => {
  return [...blogPosts]
    .sort((a, b) => new Date(b.publishDateISO).getTime() - new Date(a.publishDateISO).getTime())
    .slice(0, limit);
};

export const getPostsByCategory = (category: string): BlogPost[] => {
  return blogPosts.filter((post) => post.category === category);
};

export const getAllCategories = (): string[] => {
  return [...new Set(blogPosts.map((post) => post.category))];
};

export const getAllTopics = (): string[] => {
  const topics = new Set<string>();
  blogPosts.forEach((p) => p.topics?.forEach((t) => topics.add(t)));
  return [...topics].sort();
};

export const getSeriesPosts = (series: string): BlogPost[] => {
  return blogPosts
    .filter((p) => p.series === series)
    .sort((a, b) => new Date(a.publishDateISO).getTime() - new Date(b.publishDateISO).getTime());
};

export const getEditorsPicks = (): BlogPost[] => {
  return blogPosts.filter((p) => p.editorsPick);
};

export const getRelatedPosts = (post: BlogPost, limit: number = 3): BlogPost[] => {
  const postTopics = new Set(post.topics ?? []);
  return blogPosts
    .filter((p) => p.slug !== post.slug)
    .map((p) => {
      const shared = (p.topics ?? []).filter((t) => postTopics.has(t)).length;
      const categoryMatch = p.category === post.category ? 1 : 0;
      return { post: p, score: shared * 2 + categoryMatch };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.post);
};

export const REVENUE_INTELLIGENCE_SERIES = "The Revenue Intelligence Series";
