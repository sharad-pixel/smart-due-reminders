import MarketingLayout from "@/components/layout/MarketingLayout";
import AnimatedHero from "@/components/marketing/AnimatedHero";
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
    { question: 'What is AI accounts receivable automation?', answer: 'AI accounts receivable automation uses artificial intelligence to automate invoice follow-ups, predict payment behavior, score credit risk, and optimize collection timing — replacing manual AR processes with intelligent, data-driven workflows.' },
    { question: 'How does Recouply automate invoice collection with AI?', answer: 'Recouply uses AI agents to automatically generate and send personalized follow-up emails based on invoice age, customer payment history, risk score, and engagement patterns — all with human approval before sending.' },
    { question: 'Does Recouply integrate with Stripe and QuickBooks?', answer: 'Yes, Recouply offers native integrations with Stripe and QuickBooks for real-time invoice sync, automatic payment reconciliation, failed payment recovery, and seamless accounts receivable management.' },
    { question: 'How does AI predict payment risk in accounts receivable?', answer: 'Recouply\'s AI analyzes debtor payment history, engagement signals, invoice characteristics, and behavioral patterns to generate risk scores and predict which invoices are likely to age, enabling proactive intervention before payments become overdue.' },
    { question: 'Is there a free trial for the AI accounts receivable software?', answer: 'Yes, Recouply offers a 7-day free trial with full access to AI collection intelligence, risk scoring, Stripe integration, and automated outreach features. Payment info required upfront; auto-converts unless cancelled. Trial includes 5 invoices.' },
    { question: 'What is Collection Intelligence?', answer: 'Collection Intelligence is Recouply\'s AI-powered technology that analyzes every touchpoint — payment behavior, communication engagement, invoice aging, and risk signals — to predict outcomes, optimize outreach timing, and maximize accounts receivable recovery rates.' },
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
      <AnimatedHero />
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
