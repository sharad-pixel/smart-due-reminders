import MarketingLayout from "@/components/layout/MarketingLayout";
import CinematicHero from "@/components/marketing/CinematicHero";
import ScrollPipeline from "@/components/marketing/ScrollPipeline";
import AnimatedMetrics from "@/components/marketing/AnimatedMetrics";
import CollectionIntelligenceShowcase from "@/components/marketing/CollectionIntelligenceShowcase";
import EmailDemo from "@/components/marketing/EmailDemo";
import PricingTeaser from "@/components/marketing/PricingTeaser";
import FAQAccordion from "@/components/marketing/FAQAccordion";
import RevenueRiskTeaser from "@/components/marketing/RevenueRiskTeaser";
import FinalCTA from "@/components/marketing/FinalCTA";
import ValuePropositions from "@/components/marketing/ValuePropositions";
import FeatureGrid from "@/components/marketing/FeatureGrid";
import AIAgentsSection from "@/components/marketing/AIAgentsSection";
import WhyDifferent from "@/components/marketing/WhyDifferent";
import DataVettingBadge from "@/components/marketing/DataVettingBadge";
import SEOHead from "@/components/seo/SEOHead";
import { PAGE_SEO, generateFAQSchema } from "@/lib/seoConfig";
import AssessmentCTA from "@/components/marketing/AssessmentCTA";

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
      <DataVettingBadge />
      <PricingTeaser />
      <FAQAccordion />
      <FinalCTA />
    </MarketingLayout>
  );
};

export default Home;
