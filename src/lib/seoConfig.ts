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
export const PAGE_SEO = {
  home: {
    title: 'Recouply.ai | AI Automation for Receivables & Cash Collections',
    description: 'Transform accounts receivable with AI automation for receivables. Automate cash collections, monitor collections health, track payments, and accelerate cash flow — without collection agencies.',
    keywords: 'cash collections, accounts receivable, collections health, payments, AI automation for receivables, AI collection software, AR automation, collection intelligence platform, cash flow management',
  },
  features: {
    title: 'AI Collection Features | Cash Collections & Payments Automation | Recouply.ai',
    description: 'AI automation for receivables: automated cash collections, payments tracking, collections health monitoring, and human-approved AI agents that accelerate accounts receivable recovery.',
    keywords: 'cash collections, accounts receivable, AI automation for receivables, payments tracking, collections health, automated collections, payment prediction, dunning automation',
  },
  pricing: {
    title: 'Pricing | Affordable AI Automation for Receivables | Recouply.ai',
    description: 'Transparent pricing for AI-powered cash collections and accounts receivable automation. Start free, scale as you grow. No hidden fees, no collection agency commissions.',
    keywords: 'cash collections pricing, accounts receivable automation cost, AI automation for receivables pricing, payments software pricing, collections health platform cost',
  },
  integrations: {
    title: 'Integrations | Stripe & QuickBooks for Cash Collections | Recouply.ai',
    description: 'Connect Stripe and QuickBooks to automate cash collections and payments. Real-time accounts receivable sync, collections health visibility, and AI automation for receivables.',
    keywords: 'stripe integration, quickbooks sync, cash collections integrations, accounts receivable sync, payments reconciliation, AI automation for receivables, collections health',
  },
  enterprise: {
    title: 'Enterprise Cash Collections | AI Automation for Receivables | Recouply.ai',
    description: 'Enterprise-grade accounts receivable and cash collections automation. SOC 2 compliant, SSO, audit trails, and AI automation for receivables with collections health monitoring.',
    keywords: 'enterprise cash collections, accounts receivable enterprise, AI automation for receivables, collections health enterprise, payments automation, high-volume AR',
  },
  startups: {
    title: 'Cash Collections for Startups | AI Automation for Receivables | Recouply.ai',
    description: 'Startup-friendly cash collections and accounts receivable automation. Automate payments, monitor collections health, reduce DSO, and scale without adding finance headcount.',
    keywords: 'startup cash collections, accounts receivable startups, AI automation for receivables, payments automation startups, collections health',
  },
  smb: {
    title: 'Small Business Cash Collections | AI Automation for Receivables | Recouply.ai',
    description: 'Affordable AI-powered cash collections for small businesses. Automate accounts receivable, track payments, monitor collections health, and improve cash flow without hiring.',
    keywords: 'small business cash collections, SMB accounts receivable, AI automation for receivables, payments tracking, collections health SMB',
  },
  about: {
    title: 'About RecouplyAI | The Team Behind Collection Intelligence | Recouply.ai',
    description: 'Meet the team building the future of accounts receivable. Founded by operators with deep O2C, billing, and RevOps experience from Workday, Contentful, and Leanplum.',
    keywords: 'about recouply, collection intelligence company, AR automation team, fintech startup',
  },
  blog: {
    title: 'Blog | Cash Collections & Accounts Receivable Insights | Recouply.ai',
    description: 'Insights on cash collections, accounts receivable automation, collections health, payments optimization, and AI automation for receivables from the RecouplyAI team.',
    keywords: 'cash collections blog, accounts receivable insights, collections health tips, payments best practices, AI automation for receivables',
  },
  collectionIntelligence: {
    title: 'Collection Intelligence | AI-Powered AR Analytics | Recouply.ai',
    description: 'Collection Intelligence analyzes payment behavior to predict risk, optimize outreach timing, and maximize recovery rates with AI-powered insights.',
    keywords: 'collection intelligence, AR analytics, payment behavior prediction, collection scoring, risk assessment AR',
  },
  personas: {
    title: 'AI Agent Personas | Personalized Collection Outreach | Recouply.ai',
    description: 'Meet our AI collection agents—from friendly reminders to escalation specialists. Each persona adapts tone and strategy based on invoice age and customer context.',
    keywords: 'AI collection agents, automated outreach personas, personalized collections, adaptive dunning',
  },
  investors: {
    title: 'Investors | $70T+ Market Opportunity | Recouply.ai',
    description: 'Investment opportunities in Collection Intelligence. $70T+ annual B2B receivables market, category-defining AI platform, and founder-led execution.',
    keywords: 'fintech investment, AR automation investment, collection intelligence market, B2B receivables opportunity',
  },
  contact: {
    title: 'Contact Us | Get in Touch | Recouply.ai',
    description: 'Contact RecouplyAI for demos, partnerships, or support. We\'re here to help you transform your accounts receivable with AI-powered collection intelligence.',
    keywords: 'contact recouply, AR automation demo, collection software inquiry',
  },
  solutions: {
    title: 'Solutions | Industry-Specific AR Automation | Recouply.ai',
    description: 'Tailored collection intelligence solutions for SaaS, professional services, and small businesses. Industry-specific workflows and integrations.',
    keywords: 'AR solutions, industry AR automation, SaaS collections, professional services AR',
  },
  soloPro: {
    title: 'Solo Pro Plan | Full AI Collections for Independent Operators | Recouply.ai',
    description: 'Full-powered AI collection platform for sole proprietors and independent operators. $49/month for 25 invoices with all 6 AI agents and complete automation.',
    keywords: 'solo collections software, independent operator billing, freelancer invoice collection, sole proprietor AR automation',
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
  applicationSubCategory: 'Accounts Receivable Automation',
  operatingSystem: 'Web',
  description: SITE_CONFIG.description,
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '0',
    highPrice: '499',
    priceCurrency: 'USD',
    offerCount: '4',
    offers: [
      {
        '@type': 'Offer',
        name: 'Free Trial',
        price: '0',
        priceCurrency: 'USD',
      },
      {
        '@type': 'Offer',
        name: 'Starter',
        price: '49',
        priceCurrency: 'USD',
        priceValidUntil: '2026-12-31',
      },
      {
        '@type': 'Offer',
        name: 'Growth',
        price: '149',
        priceCurrency: 'USD',
        priceValidUntil: '2026-12-31',
      },
      {
        '@type': 'Offer',
        name: 'Enterprise',
        price: '499',
        priceCurrency: 'USD',
        priceValidUntil: '2026-12-31',
      },
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
    'AI-powered collection automation',
    'Payment behavior intelligence',
    'Risk-aware outreach workflows',
    'Human-in-the-loop AI agents',
    'Real-time cash flow visibility',
    'Stripe and QuickBooks integration',
    'Automated invoice follow-ups',
    'Predictive payment analytics',
  ],
  screenshot: 'https://recouply.ai/og-image.png',
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
      urlTemplate: `${SITE_CONFIG.siteUrl}/blog?q={search_term_string}`,
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
  name: 'Accounts Receivable & Collection Intelligence Platform',
  provider: {
    '@type': 'Organization',
    name: SITE_CONFIG.companyName,
  },
  description: 'AI-powered accounts receivable automation and collection intelligence service that helps businesses automate invoice follow-ups and accelerate cash flow.',
  serviceType: 'Accounts Receivable Automation',
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
