import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";
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
import SEO from "@/components/SEO";

const DesignPartnersSection = () => {
  return (
    <section className="py-16 bg-gradient-to-b from-primary/5 via-primary/10 to-background border-y border-primary/20">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            Early Access Opportunity
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Become a Design Partner
          </h2>
          
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            We're looking for forward-thinking companies to shape the future of Collection Intelligence. 
            Join our Design Partner program and get early access, influence the roadmap, and lock in exclusive pricing.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button size="lg" className="gap-2" asChild>
              <Link to="/design-partners">
                Apply as Design Partner
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="gap-2" asChild>
              <Link to="/investors">
                <TrendingUp className="h-4 w-4" />
                Investment Opportunities
              </Link>
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Limited spots available. Perfect for companies with 50-500 monthly invoices.
          </p>
        </div>
      </div>
    </section>
  );
};

const Home = () => {
  return (
    <MarketingLayout>
      <SEO
        title="Recouply.ai | AI-Powered Collection Intelligence Platform"
        description="Transform accounts receivable with AI collection intelligence. Automate invoice follow-ups, predict payment behavior, and accelerate cash flow—without collection agencies."
        canonical="https://recouply.ai"
        keywords="AI collection software, accounts receivable automation, invoice collection, AR automation, cash flow management, payment recovery"
      />
      <AnimatedHero />
      <DesignPartnersSection />
      <ScrollPipeline />
      <AnimatedMetrics />
      <ValuePropositions />
      <FeatureGrid />
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
