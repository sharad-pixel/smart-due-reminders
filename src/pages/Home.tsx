import MarketingLayout from "@/components/MarketingLayout";
import AnimatedHero from "@/components/marketing/AnimatedHero";
import ScrollPipeline from "@/components/marketing/ScrollPipeline";
import AnimatedMetrics from "@/components/marketing/AnimatedMetrics";
import EmailDemo from "@/components/marketing/EmailDemo";

import PricingTeaser from "@/components/marketing/PricingTeaser";

import FAQAccordion from "@/components/marketing/FAQAccordion";
import FinalCTA from "@/components/marketing/FinalCTA";
import ValuePropositions from "@/components/marketing/ValuePropositions";
import FeatureGrid from "@/components/marketing/FeatureGrid";
import AIAgentsSection from "@/components/marketing/AIAgentsSection";
import WhyDifferent from "@/components/marketing/WhyDifferent";
import IntelligenceShowcase from "@/components/marketing/IntelligenceShowcase";

const Home = () => {
  return (
    <MarketingLayout>
      <AnimatedHero />
      <ScrollPipeline />
      <AnimatedMetrics />
      <ValuePropositions />
      <FeatureGrid />
      <IntelligenceShowcase />
      <AIAgentsSection />
      <EmailDemo />
      <WhyDifferent />
      <PricingTeaser />
      <FAQAccordion />
      <FinalCTA />
    </MarketingLayout>
  );
};

export default Home;
