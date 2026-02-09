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
    'AI collection software',
    'accounts receivable automation',
    'invoice collection software',
    'AR automation platform',
    'collection intelligence',
    'automated invoice follow-up',
  ],
  secondary: [
    'cash flow management software',
    'payment recovery automation',
    'debt collection AI',
    'invoice reminder software',
    'AR aging report automation',
    'accounts receivable management',
    'dunning automation',
    'payment prediction AI',
  ],
  longTail: [
    'AI powered accounts receivable automation',
    'automated invoice collection for small business',
    'SaaS accounts receivable software',
    'enterprise AR automation platform',
    'predictive payment behavior analytics',
    'human in the loop AI collections',
    'stripe quickbooks invoice sync',
    'reduce days sales outstanding DSO',
  ],
};

// Page-specific SEO configurations
export const PAGE_SEO = {
  home: {
    title: 'Recouply.ai | AI-Powered Accounts Receivable & Collection Intelligence Platform',
    description: 'Transform accounts receivable with AI-powered AR and collection intelligence. Automate invoice follow-ups, predict payment behavior, and accelerate cash flow—without collection agencies.',
    keywords: 'AI collection software, accounts receivable automation, AR intelligence, invoice collection, AR automation, cash flow management, payment recovery, collection intelligence platform',
  },
  features: {
    title: 'AI Collection Features | Automated AR & Invoice Management | Recouply.ai',
    description: 'Discover AI-powered collection features: automated invoice follow-ups, payment prediction, risk-aware outreach, and human-approved AI agents that accelerate cash flow.',
    keywords: 'AI invoice automation, automated collections, payment prediction, AR features, collection workflows, dunning automation, invoice reminder system',
  },
  pricing: {
    title: 'Pricing | Affordable AI Collection Software | Recouply.ai',
    description: 'Transparent pricing for AI-powered collection intelligence. Start free, scale as you grow. No hidden fees, no collection agency commissions.',
    keywords: 'collection software pricing, AR automation cost, invoice management pricing, affordable debt collection software',
  },
  integrations: {
    title: 'Integrations | Stripe & QuickBooks Sync | Recouply.ai',
    description: 'Seamlessly connect Recouply with Stripe, QuickBooks, and your existing financial stack. Real-time invoice sync and automated payment reconciliation.',
    keywords: 'stripe integration, quickbooks sync, AR software integrations, invoice sync, payment reconciliation, accounting software integration',
  },
  enterprise: {
    title: 'Enterprise AR Automation | High-Volume Collection Intelligence | Recouply.ai',
    description: 'Enterprise-grade accounts receivable automation. SOC 2 compliant, SSO, audit trails, and AI-powered collection intelligence for high-volume invoice management.',
    keywords: 'enterprise AR automation, SOC 2 collection software, enterprise invoice management, high-volume accounts receivable',
  },
  startups: {
    title: 'AR Automation for Startups | Grow Without Adding Finance Headcount | Recouply.ai',
    description: 'Startup-friendly accounts receivable automation. Automate invoice collections, reduce DSO, and scale revenue without adding finance team overhead.',
    keywords: 'startup AR automation, invoice collection for startups, SaaS collections, reduce DSO startup',
  },
  smb: {
    title: 'Small Business Collection Software | AI Invoice Follow-ups | Recouply.ai',
    description: 'Affordable AI-powered collection software for small businesses. Automate invoice reminders, track payments, and improve cash flow without hiring.',
    keywords: 'small business collection software, SMB AR automation, invoice reminder software, affordable collection solution',
  },
  about: {
    title: 'About RecouplyAI | The Team Behind Collection Intelligence | Recouply.ai',
    description: 'Meet the team building the future of accounts receivable. Founded by operators with deep O2C, billing, and RevOps experience from Workday, Contentful, and Leanplum.',
    keywords: 'about recouply, collection intelligence company, AR automation team, fintech startup',
  },
  blog: {
    title: 'Blog | Collection Intelligence Insights | Recouply.ai',
    description: 'Insights on Collection Intelligence, accounts receivable automation, cash flow optimization, and building durable revenue from the RecouplyAI team.',
    keywords: 'AR automation blog, collection intelligence insights, cash flow tips, accounts receivable best practices',
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
