import { lazy, Suspense } from "react";
import MarketingLayout from "@/components/layout/MarketingLayout";
import CinematicHero from "@/components/marketing/CinematicHero";
import SEOHead from "@/components/seo/SEOHead";
import { PAGE_SEO, generateFAQSchema } from "@/lib/seoConfig";

// Lazy-load below-the-fold sections so the hero (LCP) paints faster on first load.
const AssessmentCTA = lazy(() => import("@/components/marketing/AssessmentCTA"));
const ScrollPipeline = lazy(() => import("@/components/marketing/ScrollPipeline"));
const CollectionIntelligenceShowcase = lazy(() => import("@/components/marketing/CollectionIntelligenceShowcase"));
const AnimatedMetrics = lazy(() => import("@/components/marketing/AnimatedMetrics"));
const ValuePropositions = lazy(() => import("@/components/marketing/ValuePropositions"));
const FeatureGrid = lazy(() => import("@/components/marketing/FeatureGrid"));
const AIAgentsSection = lazy(() => import("@/components/marketing/AIAgentsSection"));
const EmailDemo = lazy(() => import("@/components/marketing/EmailDemo"));
const WhyDifferent = lazy(() => import("@/components/marketing/WhyDifferent"));
const RevenueRiskTeaser = lazy(() => import("@/components/marketing/RevenueRiskTeaser"));
const ContractIntelligenceTeaser = lazy(() => import("@/components/marketing/ContractIntelligenceTeaser"));
const DataVettingBadge = lazy(() => import("@/components/marketing/DataVettingBadge"));
const PricingTeaser = lazy(() => import("@/components/marketing/PricingTeaser"));
const FAQAccordion = lazy(() => import("@/components/marketing/FAQAccordion"));
const FinalCTA = lazy(() => import("@/components/marketing/FinalCTA"));

const Home = () => {
  const homeFaqs = [
    { question: 'What is agentic AI for accounts receivable?', answer: 'Agentic AI goes beyond simple automation — it deploys autonomous AI agents that independently manage invoice follow-ups, assess debtor risk, read and respond to emails, negotiate payment plans, and escalate accounts — all with human oversight at key decision points.' },
    { question: 'How do Recouply\'s AI agents recover revenue?', answer: 'Recouply deploys 6 specialized AI agents that autonomously orchestrate the entire revenue recovery lifecycle — from generating personalized collection messages based on risk scores and payment history, to reading debtor replies, triaging disputes, and triggering escalations — with human approval before any communication is sent.' },
    { question: 'Does Recouply integrate with Stripe, QuickBooks, and Google Sheets?', answer: 'Yes, Recouply offers native integrations with Stripe, QuickBooks, Google Sheets, and Google Drive for real-time invoice sync, automatic payment reconciliation, spreadsheet-based data import/export, and AI-powered invoice extraction from PDFs.' },
    { question: 'How does Recouply assess revenue risk?', answer: 'Our AI engine calculates real-time Collectability Scores (0–100) and Expected Credit Loss (ECL) for every account using payment history, engagement signals, sentiment analysis, and behavioral patterns — aligned to ASC 326 and IFRS 9 frameworks for audit-ready risk assessment.' },
    { question: 'Is there a free trial for Recouply\'s AI agents?', answer: 'Yes, Recouply offers a 7-day free trial with full access to all AI agents, revenue risk scoring, integration capabilities, and autonomous outreach features. Payment info required upfront; auto-converts unless cancelled. Trial includes 5 invoices.' },
    { question: 'What is Revenue Recovery Intelligence?', answer: 'Revenue Recovery Intelligence is Recouply\'s agentic AI platform that synthesizes every data point — payment behavior, communication engagement, invoice aging, risk signals, and debtor sentiment — to autonomously prioritize accounts, predict outcomes, and execute recovery workflows with zero manual effort.' },
  ];

  return (
    <MarketingLayout>
      <SEOHead
        title={PAGE_SEO.home.title}
        description={PAGE_SEO.home.description}
        keywords={PAGE_SEO.home.keywords}
        canonical="https://recouply.ai"
        structuredData={generateFAQSchema(homeFaqs)}
      />
      <CinematicHero />
      <Suspense fallback={null}>
        <AssessmentCTA />
        <ScrollPipeline />
        <CollectionIntelligenceShowcase />
        <AnimatedMetrics />
        <ValuePropositions />
        <FeatureGrid />
        <AIAgentsSection />
        <EmailDemo />
        <WhyDifferent />
        <RevenueRiskTeaser />
        <ContractIntelligenceTeaser />
        <DataVettingBadge />
        <PricingTeaser />
        <FAQAccordion />
        <FinalCTA />
      </Suspense>
    </MarketingLayout>
  );
};

export default Home;
