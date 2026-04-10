/**
 * Centralized SEO Configuration for Recouply.ai
 * All SEO metadata, keywords, and structured data configurations
 */

export const SITE_CONFIG = {
  siteName: 'Recouply.ai',
  siteUrl: 'https://recouply.ai',
  companyName: 'RecouplyAI Inc.',
  description: 'Collections & Risk Intelligence Platform for Finance Teams. Centralize receivables management, prioritize by risk, maintain a full audit trail of outreach, and accelerate cash flow with AI-powered collections workflows — without collection agencies.',
  logo: 'https://recouply.ai/favicon.png',
  ogImage: 'https://recouply.ai/og-image.png',
  twitterHandle: '@recouplyai',
  foundingDate: '2024',
  email: 'support@recouply.ai',
};

// Primary target keywords organized by intent — optimized for top-100 AR + AI + Risk searches
export const TARGET_KEYWORDS = {
  primary: [
    // Core AR + AI terms
    'accounts receivable AI',
    'AI accounts receivable software',
    'accounts receivable automation',
    'AI collection software',
    'collection intelligence',
    'AI invoice collection',
    'accounts receivable management software',
    'AR automation platform',
    // Risk management
    'accounts receivable risk management',
    'credit risk management software',
    'AI risk scoring',
    'revenue risk management',
    'expected credit loss software',
    // Stripe integration
    'Stripe accounts receivable',
    'Stripe invoice automation',
    'Stripe payment recovery',
    'Stripe AR integration',
  ],
  secondary: [
    // AR automation variants
    'automated accounts receivable',
    'accounts receivable software for small business',
    'best accounts receivable software',
    'AR automation software',
    'accounts receivable tracking software',
    'cloud accounts receivable software',
    'accounts receivable management system',
    'invoice management software',
    'invoice tracking software',
    'invoice follow-up automation',
    'dunning management software',
    'dunning automation platform',
    'payment reminder software',
    'automated payment reminders',
    'overdue invoice management',
    'past due invoice software',
    // AI + collections
    'artificial intelligence collections',
    'AI debt collection',
    'AI powered collections',
    'machine learning accounts receivable',
    'predictive analytics accounts receivable',
    'AI dunning',
    'smart collections software',
    'intelligent collections platform',
    // Risk + credit
    'credit risk assessment software',
    'payment risk scoring',
    'debtor risk analysis',
    'AR risk assessment',
    'collectability scoring',
    'invoice risk prediction',
    'payment behavior prediction',
    'predictive payment analytics',
    'ASC 326 software',
    'IFRS 9 expected credit loss',
    'bad debt prediction software',
    // Cash flow
    'cash flow management software',
    'cash flow forecasting software',
    'DSO reduction software',
    'days sales outstanding reduction',
    'working capital optimization',
    'cash conversion cycle',
    // Stripe + integrations
    'Stripe billing automation',
    'Stripe collections integration',
    'Stripe failed payment recovery',
    'Stripe dunning management',
    'QuickBooks AR automation',
    'QuickBooks collections integration',
    'ERP accounts receivable integration',
  ],
  longTail: [
    // High-intent long-tail
    'best AI software for accounts receivable',
    'AI accounts receivable automation for small business',
    'how to automate accounts receivable with AI',
    'accounts receivable artificial intelligence platform',
    'AI powered invoice collection software',
    'automated invoice follow-up software',
    'accounts receivable automation with Stripe',
    'Stripe invoice collection automation',
    'Stripe overdue payment recovery automation',
    'reduce days sales outstanding with AI',
    'AI reduce DSO accounts receivable',
    'predictive analytics for invoice collection',
    'machine learning payment prediction',
    'AI credit risk scoring for receivables',
    'accounts receivable risk management platform',
    'expected credit loss calculation software',
    'revenue risk prediction AI',
    'SaaS accounts receivable automation software',
    'enterprise AR automation platform',
    'human in the loop AI collections',
    'AI agents for accounts receivable',
    'autonomous collections automation',
    'B2B invoice collection software',
    'B2B accounts receivable software',
    'accounts receivable for startups',
    'accounts receivable software for SaaS companies',
    'small business invoice collection software',
    'affordable AR automation software',
    'accounts receivable dashboard software',
    'AR aging report automation',
    'collection workflow automation',
    'payment reconciliation software Stripe',
    'invoice dispute management software',
    'accounts receivable KPI tracking',
    'AR performance analytics dashboard',
  ],
};

// Page-specific SEO configurations
export const PAGE_SEO: Record<string, { title: string; description: string; keywords: string }> = {
  home: {
    title: 'Recouply.ai | Collections & Risk Intelligence Platform for Finance Teams',
    description: 'Collections & Risk Intelligence Platform for Finance Teams. Centralize receivables, prioritize by risk, and maintain a full audit trail. Reduce DSO and recover cash with AI-powered collections workflows.',
    keywords: 'collections CRM, AI collections software, accounts receivable CRM, AI-powered collections workflows, risk-based prioritization, collections audit trail, centralized receivables, DSO reduction, cash flow management, collection intelligence platform',
  },
  features: {
    title: 'AI Collections CRM Features | Risk Scoring & Workflow Engine',
    description: 'AI-powered collections CRM features: risk-based prioritization, centralized receivables, full audit trail, AI-powered collections workflows, and intelligent outreach.',
    keywords: 'AI collections CRM features, risk-based prioritization, collections audit trail, AI-powered collections workflows, centralized receivables management, payment behavior prediction',
  },
  pricing: {
    title: 'Pricing | AI Accounts Receivable Software Starting Free',
    description: 'Transparent pricing for AI accounts receivable automation. Start free, scale with growth. No collection agency commissions. Stripe and QuickBooks integration included.',
    keywords: 'accounts receivable software pricing, AR automation cost, AI collections pricing, invoice collection software price, affordable AR software, accounts receivable management cost',
  },
  integrations: {
    title: 'Stripe & QuickBooks Integration | AI Accounts Receivable',
    description: 'Connect Stripe, QuickBooks, and your billing stack to automate accounts receivable. Real-time invoice sync, payment reconciliation, and AI-powered collection workflows.',
    keywords: 'Stripe accounts receivable integration, QuickBooks AR automation, Stripe invoice collection, Stripe payment recovery, Stripe dunning, payment reconciliation software, ERP AR integration, billing integration accounts receivable',
  },
  enterprise: {
    title: 'Enterprise Accounts Receivable AI | SOC 2 Compliant AR Automation',
    description: 'Enterprise-grade AI accounts receivable automation. SOC 2 compliant, SSO, audit trails, advanced risk management, and Stripe integration for high-volume collections.',
    keywords: 'enterprise accounts receivable software, enterprise AR automation, SOC 2 AR software, enterprise AI collections, high-volume invoice management, enterprise credit risk management, enterprise Stripe integration',
  },
  startups: {
    title: 'Accounts Receivable Software for Startups | AI Collection Automation',
    description: 'Startup-friendly AI accounts receivable software. Automate invoice collections, reduce DSO, integrate with Stripe, and scale without adding finance headcount.',
    keywords: 'accounts receivable for startups, startup AR software, startup invoice collection, AI collections startup, Stripe AR startups, reduce DSO startup',
  },
  smb: {
    title: 'Small Business Accounts Receivable Software | AI Invoice Collection',
    description: 'Affordable AI accounts receivable software for small businesses. Automate invoice follow-ups, track payments, predict risk, and integrate with Stripe and QuickBooks.',
    keywords: 'small business accounts receivable software, SMB AR automation, small business invoice collection, affordable AR software, AI collections small business, Stripe small business AR',
  },
  about: {
    title: 'About RecouplyAI | AI Accounts Receivable Company',
    description: 'Meet the team building AI-powered accounts receivable software. Founded by operators with deep O2C, billing, and RevOps experience from Workday, Contentful, and Leanplum.',
    keywords: 'about recouply, AI accounts receivable company, AR automation team, fintech startup, collection intelligence company',
  },
  blog: {
    title: 'Blog | AI Accounts Receivable & Risk Management Insights',
    description: 'Expert insights on AI accounts receivable automation, credit risk management, Stripe integration, cash flow optimization, and collection intelligence from RecouplyAI.',
    keywords: 'accounts receivable blog, AI collections insights, AR automation best practices, credit risk management articles, Stripe AR tips, cash flow management blog, DSO reduction strategies',
  },
  collectionIntelligence: {
    title: 'Collections & Risk CRM | AI-Powered Workflows & Risk Scoring',
    description: 'AI-powered collections CRM with risk-based prioritization, centralized receivables management, full audit trail, and intelligent collections workflows for maximum recovery.',
    keywords: 'collections CRM, AI collections workflows, risk-based prioritization, collections audit trail, centralized receivables, predictive collections, AI credit risk, AR intelligence platform',
  },
  personas: {
    title: 'AI Agent Personas | Personalized Collection Outreach',
    description: 'Meet our AI collection agents—from friendly reminders to escalation specialists. Each persona adapts tone and strategy based on invoice age and customer context.',
    keywords: 'AI collection agents, automated outreach personas, personalized collections, adaptive dunning',
  },
  investors: {
    title: 'Investors | $70T+ Market Opportunity',
    description: 'Investment opportunities in Collection Intelligence. $70T+ annual B2B receivables market, category-defining AI platform, and founder-led execution.',
    keywords: 'fintech investment, AR automation investment, collection intelligence market, B2B receivables opportunity',
  },
  contact: {
    title: 'Contact Us | Get in Touch',
    description: 'Contact RecouplyAI for demos, partnerships, or support. We\'re here to help you transform your accounts receivable with AI-powered collection intelligence.',
    keywords: 'contact recouply, AR automation demo, collection software inquiry',
  },
  solutions: {
    title: 'Solutions | Industry-Specific AR Automation',
    description: 'Tailored collection intelligence solutions for SaaS, professional services, and small businesses. Industry-specific workflows and integrations.',
    keywords: 'AR solutions, industry AR automation, SaaS collections, professional services AR',
  },
  soloPro: {
    title: 'Solo Pro Plan | Full AI Collections for Independent Operators',
    description: 'Full-powered AI collection platform for sole proprietors and independent operators. $49/month for 25 invoices with all 6 AI agents and complete automation.',
    keywords: 'solo collections software, independent operator billing, freelancer invoice collection, sole proprietor AR automation',
  },
  revenueRisk: {
    title: 'Revenue Risk & ECL Intelligence | Recouply.ai',
    description: 'Predict expected credit losses, score invoice collectability, and protect revenue with AI-powered risk intelligence aligned to ASC 326 & IFRS 9.',
    keywords: 'expected credit loss, ECL, revenue risk, collectability score, ASC 326, IFRS 9, accounts receivable risk',
  },
  // --- New page configs ---
  aiCommandCenter: {
    title: 'AI Command Center | Intelligent Collections Automation',
    description: 'Control your entire collections workflow from a single AI command center. Generate drafts, manage outreach, and oversee AI agents across all aging buckets.',
    keywords: 'AI command center, collections automation dashboard, AI agent management, receivables command center',
  },
  whyCollectionsMatter: {
    title: 'Why Collections Matter | The Cost of Late Payments',
    description: 'Understand how late payments impact cash flow, profitability, and growth. Learn why proactive accounts receivable management is essential for every business.',
    keywords: 'why collections matter, late payment impact, cash flow management, accounts receivable importance, DSO reduction',
  },
  collectionsAssessment: {
    title: 'Free Collections Assessment | Score Your AR Health',
    description: 'Get a free assessment of your accounts receivable health. Evaluate collection risk, identify revenue leaks, and discover how AI automation can improve recovery rates.',
    keywords: 'collections assessment, AR health score, free receivables audit, collection risk assessment',
  },
  security: {
    title: 'Security | Enterprise-Grade Data Protection',
    description: 'Bank-level encryption, SOC 2 compliance, and enterprise security controls. Your accounts receivable data is protected with industry-leading security standards.',
    keywords: 'AR security, accounts receivable data protection, SOC 2 compliance, enterprise security, data encryption',
  },
  knowledgeBase: {
    title: 'Knowledge Base | Help Center & FAQ',
    description: 'Find answers to common questions about Recouply.ai. Guides on cash collections, AI workflows, integrations, billing, and account management.',
    keywords: 'recouply help center, AR automation FAQ, collections software guide, knowledge base',
  },
  designPartners: {
    title: 'Design Partner Program | Shape the Future of Collections',
    description: 'Join our Design Partner program and help shape the future of AI-powered collections. Early access, direct input, and exclusive pricing for founding partners.',
    keywords: 'design partner program, beta access, early adopter, collections software partnership',
  },
  careers: {
    title: 'Careers | Join the RecouplyAI Team',
    description: 'Join a mission-driven team building the future of accounts receivable. Remote-first culture, competitive compensation, and meaningful impact on a $70T+ market.',
    keywords: 'recouply careers, fintech jobs, AR automation careers, remote fintech jobs',
  },
  professionalServices: {
    title: 'Professional Services AR Automation | Recouply.ai',
    description: 'Purpose-built accounts receivable automation for professional services firms. Manage retainers, milestone billing, and project-based invoicing with AI collection agents.',
    keywords: 'professional services AR, consulting invoice collection, law firm receivables, project-based billing automation',
  },
  saas: {
    title: 'SaaS Accounts Receivable Automation | Recouply.ai',
    description: 'Designed for SaaS companies: automate subscription invoice collections, reduce involuntary churn, and recover failed payments with AI-powered outreach.',
    keywords: 'SaaS AR automation, subscription collections, failed payment recovery, involuntary churn prevention, SaaS receivables',
  },
  smallBusinesses: {
    title: 'Small Business Collections Software | Recouply.ai',
    description: 'Affordable AI-powered collections for small businesses. Automate invoice follow-ups, get paid faster, and protect cash flow without hiring a collections team.',
    keywords: 'small business collections, affordable AR automation, invoice follow-up software, SMB cash collections',
  },
  comingSoon: {
    title: 'Coming Soon | New Features on the Way',
    description: 'Exciting new features are coming to Recouply.ai. Stay tuned for the latest updates to our AI-powered collection intelligence platform.',
    keywords: 'recouply updates, new features, collection intelligence roadmap',
  },
  signup: {
    title: 'Sign Up | Start Collecting Smarter Today',
    description: 'Create your free Recouply.ai account and start automating accounts receivable collections with AI. No credit card required.',
    keywords: 'sign up recouply, free AR automation trial, create account',
  },
  login: {
    title: 'Log In | Recouply.ai',
    description: 'Log in to your Recouply.ai account to manage collections, review AI drafts, and track payments.',
    keywords: 'recouply login, sign in, AR automation dashboard',
  },
  // Blog posts
  blogCelebrateCash: {
    title: 'Celebrate Cash: Why Every Dollar Collected Matters',
    description: 'Learn why celebrating successful cash collections drives team morale and reinforces the behaviors that keep your accounts receivable healthy.',
    keywords: 'cash collections culture, celebrate payments, AR team motivation, collections best practices',
  },
  blogPowerOfOutreach: {
    title: 'The Power of Proactive Outreach in Collections',
    description: 'How proactive, timely outreach dramatically improves collection rates. Data-backed strategies for accounts receivable teams.',
    keywords: 'proactive collections outreach, AR follow-up strategy, invoice collection timing, dunning best practices',
  },
  blogCashLeakage: {
    title: 'Cash Leakage: The Silent Revenue Killer',
    description: 'Identify and plug the hidden cash leaks in your accounts receivable process. Practical strategies to recover lost revenue and reduce DSO.',
    keywords: 'cash leakage, revenue leaks, AR process optimization, reduce DSO, accounts receivable efficiency',
  },
  // Legal pages
  terms: {
    title: 'Terms of Service | Recouply.ai',
    description: 'Terms of Service for Recouply.ai. Read our terms governing the use of our AI-powered collection intelligence platform.',
    keywords: 'terms of service, legal terms, recouply terms',
  },
  privacy: {
    title: 'Privacy Policy | Recouply.ai',
    description: 'Privacy Policy for Recouply.ai. Learn how we collect, use, and protect your data on our collection intelligence platform.',
    keywords: 'privacy policy, data protection, recouply privacy',
  },
  cookies: {
    title: 'Cookie Policy | Recouply.ai',
    description: 'Cookie Policy for Recouply.ai. Understand how we use cookies and similar technologies on our platform.',
    keywords: 'cookie policy, cookies, recouply cookies',
  },
};

// Structured data generators
export const generateOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_CONFIG.companyName,
  alternateName: SITE_CONFIG.siteName,
  url: SITE_CONFIG.siteUrl,
  logo: SITE_CONFIG.logo,
  description: SITE_CONFIG.description,
  foundingDate: SITE_CONFIG.foundingDate,
  address: {
    '@type': 'PostalAddress',
    addressRegion: 'Delaware',
    addressCountry: 'US',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    email: SITE_CONFIG.email,
    contactType: 'customer service',
  },
  sameAs: [
    'https://linkedin.com/company/recouply',
    'https://twitter.com/recouplyai',
  ],
});

export const generateSoftwareApplicationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_CONFIG.siteName,
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Accounts Receivable AI & Risk Management Software',
  operatingSystem: 'Web',
  description: 'AI-powered accounts receivable automation and risk management platform. Automate invoice collections, predict payment behavior with AI, score credit risk, integrate with Stripe and QuickBooks, and reduce days sales outstanding.',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '0',
    highPrice: '499',
    priceCurrency: 'USD',
    offerCount: '4',
    offers: [
      { '@type': 'Offer', name: 'Free Trial', price: '0', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Starter', price: '49', priceCurrency: 'USD', priceValidUntil: '2027-12-31' },
      { '@type': 'Offer', name: 'Growth', price: '149', priceCurrency: 'USD', priceValidUntil: '2027-12-31' },
      { '@type': 'Offer', name: 'Enterprise', price: '499', priceCurrency: 'USD', priceValidUntil: '2027-12-31' },
    ],
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    ratingCount: '127',
    bestRating: '5',
    worstRating: '1',
  },
  featureList: [
    'AI accounts receivable automation',
    'Artificial intelligence invoice collection',
    'Accounts receivable risk management',
    'Credit risk scoring and assessment',
    'Payment behavior prediction with AI',
    'Expected credit loss (ECL) calculation',
    'Stripe payment recovery integration',
    'Stripe invoice sync and reconciliation',
    'QuickBooks accounts receivable integration',
    'Automated dunning and payment reminders',
    'Days sales outstanding (DSO) reduction',
    'Cash flow forecasting and management',
    'AI collection agents with human approval',
    'Invoice aging report automation',
    'Predictive payment analytics dashboard',
    'B2B accounts receivable management',
    'Collection workflow orchestration',
    'Revenue risk intelligence',
  ],
  screenshot: SITE_CONFIG.ogImage,
  softwareVersion: '2.0',
  creator: {
    '@type': 'Organization',
    name: SITE_CONFIG.companyName,
  },
});

export const generateWebSiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_CONFIG.siteName,
  url: SITE_CONFIG.siteUrl,
  description: SITE_CONFIG.description,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_CONFIG.siteUrl}/knowledge-base?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
});

export const generateBreadcrumbSchema = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
});

export const generateFAQSchema = (faqs: { question: string; answer: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
});

export const generateArticleSchema = (article: {
  title: string;
  description: string;
  url: string;
  image: string;
  datePublished: string;
  dateModified?: string;
  author: { name: string; url?: string };
}) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: article.title,
  description: article.description,
  url: article.url,
  image: article.image,
  datePublished: article.datePublished,
  dateModified: article.dateModified || article.datePublished,
  author: {
    '@type': 'Person',
    name: article.author.name,
    url: article.author.url,
  },
  publisher: {
    '@type': 'Organization',
    name: SITE_CONFIG.companyName,
    logo: {
      '@type': 'ImageObject',
      url: SITE_CONFIG.logo,
    },
  },
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': article.url,
  },
});

export const generateServiceSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'AI Accounts Receivable Automation & Risk Management Platform',
  provider: {
    '@type': 'Organization',
    name: SITE_CONFIG.companyName,
  },
  description: 'AI-powered accounts receivable automation and risk management service. Automate invoice collections, predict payment behavior, score credit risk, integrate with Stripe, and reduce days sales outstanding.',
  serviceType: 'Accounts Receivable AI Software',
  areaServed: {
    '@type': 'Place',
    name: 'Worldwide',
  },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'AI Accounts Receivable Plans',
    itemListElement: [
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'AI Invoice Collection Automation',
          description: 'Automated invoice follow-ups with AI-powered outreach, Stripe integration, and payment reconciliation',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Payment Risk Prediction & Credit Scoring',
          description: 'AI-powered payment behavior prediction, credit risk scoring, and expected credit loss calculation',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Accounts Receivable Risk Management',
          description: 'Portfolio-level risk assessment, revenue risk intelligence, and DSO reduction analytics',
        },
      },
    ],
  },
});

export const generateProductSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: SITE_CONFIG.siteName,
  description: SITE_CONFIG.description,
  brand: {
    '@type': 'Brand',
    name: SITE_CONFIG.companyName,
  },
  image: SITE_CONFIG.ogImage,
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '0',
    highPrice: '499',
    priceCurrency: 'USD',
    offerCount: '4',
    availability: 'https://schema.org/InStock',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    ratingCount: '127',
    bestRating: '5',
    worstRating: '1',
  },
  category: 'Business Software',
});

export const generateHowToSchema = (steps: { name: string; text: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to Automate Accounts Receivable with Recouply.ai',
  description: 'Step-by-step guide to automating your collections workflow with AI-powered agents.',
  step: steps.map((step, index) => ({
    '@type': 'HowToStep',
    position: index + 1,
    name: step.name,
    text: step.text,
  })),
});
