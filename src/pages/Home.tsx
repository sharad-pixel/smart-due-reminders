import MarketingLayout from "@/components/MarketingLayout";
import AnimatedHero from "@/components/marketing/AnimatedHero";
import ScrollPipeline from "@/components/marketing/ScrollPipeline";
import AnimatedMetrics from "@/components/marketing/AnimatedMetrics";
import CollectionIntelligenceShowcase from "@/components/marketing/CollectionIntelligenceShowcase";
import EmailDemo from "@/components/marketing/EmailDemo";
import PricingTeaser from "@/components/marketing/PricingTeaser";
import FAQAccordion from "@/components/marketing/FAQAccordion";
import FinalCTA from "@/components/marketing/FinalCTA";
import ValuePropositions from "@/components/marketing/ValuePropositions";
import FeatureGrid from "@/components/marketing/FeatureGrid";
import AIAgentsSection from "@/components/marketing/AIAgentsSection";
import WhyDifferent from "@/components/marketing/WhyDifferent";
import DataVettingBadge from "@/components/marketing/DataVettingBadge";
import SEOHead from "@/components/SEOHead";
import { PAGE_SEO, generateFAQSchema } from "@/lib/seoConfig";
import AssessmentCTA from "@/components/marketing/AssessmentCTA";

const Home = () => {
  const homeFaqs = [
    { question: 'What is Collection Intelligence?', answer: 'Collection Intelligence is AI-powered technology that analyzes payment behavior patterns to predict risk, optimize outreach timing, and maximize invoice recovery rates.' },
    { question: 'How does Recouply automate invoice collection?', answer: 'Recouply uses AI agents to automatically generate and send personalized follow-up emails based on invoice age, customer history, and payment patterns—all with human approval before sending.' },
    { question: 'Does Recouply integrate with Stripe and QuickBooks?', answer: 'Yes, Recouply offers native integrations with Stripe and QuickBooks for real-time invoice sync and automatic payment reconciliation.' },
    { question: 'Is there a free trial available?', answer: 'Yes, Recouply offers a 7-day free trial with full access to collection intelligence features. Payment info required upfront; auto-converts unless cancelled. Trial includes 5 invoices.' },
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
      <DataVettingBadge />
      <PricingTeaser />
      <FAQAccordion />
      <FinalCTA />
    </MarketingLayout>
  );
};

export default Home;
