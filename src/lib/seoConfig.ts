/**
 * Centralized SEO Configuration for Recouply.ai
 * All SEO metadata, keywords, and structured data configurations
 */

export const SITE_CONFIG = {
  siteName: 'Recouply.ai',
  siteUrl: 'https://recouply.ai',
  companyName: 'RecouplyAI Inc.',
  description: 'AI-powered Accounts Receivable & Collection Intelligence Platform. Automate cash collections, monitor collections health, track payments, and leverage AI automation for receivables — without collection agencies.',
  logo: 'https://recouply.ai/favicon.png',
  ogImage: 'https://recouply.ai/og-image.png',
  twitterHandle: '@recouplyai',
  foundingDate: '2024',
  email: 'support@recouply.ai',
};

// Primary target keywords organized by intent
export const TARGET_KEYWORDS = {
  primary: [
    'cash collections',
    'accounts receivable',
    'collections health',
    'payments',
    'AI automation for receivables',
    'AI collection software',
    'accounts receivable automation',
    'collection intelligence',
  ],
  secondary: [
    'cash collections software',
    'AR collections health monitoring',
    'payment recovery automation',
    'accounts receivable management',
    'invoice collection software',
    'AR automation platform',
    'automated invoice follow-up',
    'dunning automation',
    'payment prediction AI',
    'cash flow management software',
  ],
  longTail: [
    'AI powered cash collections automation',
    'accounts receivable collections health dashboard',
    'AI automation for receivables and payments',
    'automated invoice collection for small business',
    'SaaS accounts receivable software',
    'enterprise AR automation platform',
    'predictive payment behavior analytics',
    'human in the loop AI collections',
    'stripe quickbooks invoice sync',
    'reduce days sales outstanding DSO',
    'cash collections intelligence platform',
  ],
};

// Page-specific SEO configurations
export const PAGE_SEO: Record<string, { title: string; description: string; keywords: string }> = {
  home: {
    title: 'Recouply.ai | AI Automation for Receivables & Cash Collections',
    description: 'Transform accounts receivable with AI automation for receivables. Automate cash collections, monitor collections health, track payments, and accelerate cash flow — without collection agencies.',
    keywords: 'cash collections, accounts receivable, collections health, payments, AI automation for receivables, AI collection software, AR automation, collection intelligence platform, cash flow management',
  },
  features: {
    title: 'AI Collection Features | Cash Collections & Payments Automation',
    description: 'AI automation for receivables: automated cash collections, payments tracking, collections health monitoring, and human-approved AI agents that accelerate accounts receivable recovery.',
    keywords: 'cash collections, accounts receivable, AI automation for receivables, payments tracking, collections health, automated collections, payment prediction, dunning automation',
  },
  pricing: {
    title: 'Pricing | Affordable AI Automation for Receivables',
    description: 'Transparent pricing for AI-powered cash collections and accounts receivable automation. Start free, scale as you grow. No hidden fees, no collection agency commissions.',
    keywords: 'cash collections pricing, accounts receivable automation cost, AI automation for receivables pricing, payments software pricing, collections health platform cost',
  },
  integrations: {
    title: 'Integrations | Stripe & QuickBooks for Cash Collections',
    description: 'Connect Stripe and QuickBooks to automate cash collections and payments. Real-time accounts receivable sync, collections health visibility, and AI automation for receivables.',
    keywords: 'stripe integration, quickbooks sync, cash collections integrations, accounts receivable sync, payments reconciliation, AI automation for receivables, collections health',
  },
  enterprise: {
    title: 'Enterprise Cash Collections | AI Automation for Receivables',
    description: 'Enterprise-grade accounts receivable and cash collections automation. SOC 2 compliant, SSO, audit trails, and AI automation for receivables with collections health monitoring.',
    keywords: 'enterprise cash collections, accounts receivable enterprise, AI automation for receivables, collections health enterprise, payments automation, high-volume AR',
  },
  startups: {
    title: 'Cash Collections for Startups | AI Automation for Receivables',
    description: 'Startup-friendly cash collections and accounts receivable automation. Automate payments, monitor collections health, reduce DSO, and scale without adding finance headcount.',
    keywords: 'startup cash collections, accounts receivable startups, AI automation for receivables, payments automation startups, collections health',
  },
  smb: {
    title: 'Small Business Cash Collections | AI Automation for Receivables',
    description: 'Affordable AI-powered cash collections for small businesses. Automate accounts receivable, track payments, monitor collections health, and improve cash flow without hiring.',
    keywords: 'small business cash collections, SMB accounts receivable, AI automation for receivables, payments tracking, collections health SMB',
  },
  about: {
    title: 'About RecouplyAI | The Team Behind Collection Intelligence',
    description: 'Meet the team building the future of accounts receivable. Founded by operators with deep O2C, billing, and RevOps experience from Workday, Contentful, and Leanplum.',
    keywords: 'about recouply, collection intelligence company, AR automation team, fintech startup',
  },
  blog: {
    title: 'Blog | Cash Collections & Accounts Receivable Insights',
    description: 'Insights on cash collections, accounts receivable automation, collections health, payments optimization, and AI automation for receivables from the RecouplyAI team.',
    keywords: 'cash collections blog, accounts receivable insights, collections health tips, payments best practices, AI automation for receivables',
  },
  collectionIntelligence: {
    title: 'Collection Intelligence | Cash Collections & Payments Analytics',
    description: 'Collection Intelligence analyzes payments behavior to predict risk, monitor collections health, optimize cash collections timing, and maximize accounts receivable recovery with AI automation.',
    keywords: 'collection intelligence, cash collections analytics, accounts receivable, collections health, payments prediction, AI automation for receivables',
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
  applicationSubCategory: 'Cash Collections & Accounts Receivable Automation',
  operatingSystem: 'Web',
  description: SITE_CONFIG.description,
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
    'AI automation for receivables',
    'Cash collections automation',
    'Accounts receivable management',
    'Collections health monitoring',
    'Payments tracking and prediction',
    'Risk-aware outreach workflows',
    'Human-in-the-loop AI agents',
    'Stripe and QuickBooks integration',
    'Automated invoice follow-ups',
    'Predictive payment analytics',
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
  name: 'Cash Collections, Accounts Receivable & Collection Intelligence Platform',
  provider: {
    '@type': 'Organization',
    name: SITE_CONFIG.companyName,
  },
  description: 'AI automation for receivables — automate cash collections, monitor collections health, track payments, and accelerate accounts receivable recovery.',
  serviceType: 'Cash Collections & Accounts Receivable Automation',
  areaServed: {
    '@type': 'Place',
    name: 'Worldwide',
  },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Collection Intelligence Plans',
    itemListElement: [
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'AI Invoice Collection',
          description: 'Automated invoice follow-ups with AI-powered outreach',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Payment Prediction',
          description: 'Predictive analytics for payment behavior',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Risk Assessment',
          description: 'AI-powered risk scoring and collection prioritization',
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
