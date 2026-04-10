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
import founderImage from "@/assets/founder-sharad.jpg";

export interface BlogAuthor {
  name: string;
  title: string;
  image: string;
  bio: string;
}

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
}

// Define authors
export const authors: Record<string, BlogAuthor> = {
  sharad: {
    name: "Sharad Chanana",
    title: "Founder & CEO, Recouply.ai",
    image: founderImage,
    bio: "Sharad has spent over a decade in B2B SaaS and fintech, building and scaling revenue operations at high-growth companies. He founded Recouply.ai to bring enterprise-grade Collection Intelligence to businesses of all sizes.",
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
    category: "Collection Intelligence",
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
    category: "Collection Intelligence",
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
    category: "Collection Intelligence",
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
    title: "The Rise of Collections Intelligence Platforms",
    metaTitle: "Collections Intelligence Platforms: A New Category | Recouply.ai",
    metaDescription: "Collections intelligence platforms combine AI, behavioral data, and workflow automation to replace reactive AR processes. Here's why they're emerging now.",
    excerpt: "A new category of platform is emerging that combines AI, behavioral signals, and workflow orchestration to transform how businesses recover revenue.",
    category: "Collection Intelligence",
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
    category: "Collection Intelligence",
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
    metaDescription: "Traditional collections is dead. Meet the AI-powered Collections & Risk Assessment CRM built for real-time cash flow.",
    excerpt: "Traditional collections is broken—here's the new operating model built on AI, real-time risk, and a true system of record.",
    category: "Collections CRM",
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
    category: "Collections CRM",
    author: authors.sharad,
    publishDate: "April 5, 2026",
    publishDateISO: "2026-04-05",
    readingTime: "7 min read",
    heroImage: collectionsNeedsCrmHero,
    heroAlt: "CRM system interface for collections showing organized customer records and AI intelligence layers",
    keywords: "collections CRM, AR, receivables, Salesforce analogy, system of record, audit logs, AI automation, finance ops, B2B SaaS",
    featured: true,
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
