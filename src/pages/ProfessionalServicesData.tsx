import MarketingLayout from "@/components/MarketingLayout";
import SEOHead from "@/components/SEOHead";
import { usePageTitle } from "@/hooks/usePageTitle";
import ProfServicesHero from "@/components/professional-services/ProfServicesHero";
import TrustBarrierSection from "@/components/professional-services/TrustBarrierSection";
import VettingProcessSection from "@/components/professional-services/VettingProcessSection";
import FounderOversightSection from "@/components/professional-services/FounderOversightSection";
import DeliverablesSection from "@/components/professional-services/DeliverablesSection";
import ProfServicesPricing from "@/components/professional-services/ProfServicesPricing";

const ProfessionalServicesData = () => {
  usePageTitle("Professional Services – Data Integrity & Onboarding");

  return (
    <MarketingLayout>
      <SEOHead
        title="Professional Services – Data Integrity & Onboarding | Recouply.ai"
        description="Structured invoice data vetting and founder-led onboarding to ensure clean, validated imports into Recouply.ai."
        keywords="data integrity, invoice vetting, controlled onboarding, AR data governance, clean import"
        canonical="https://recouply.ai/professional-services"
      />
      <ProfServicesHero />
      <TrustBarrierSection />
      <VettingProcessSection />
      <FounderOversightSection />
      <DeliverablesSection />
      <ProfServicesPricing />
    </MarketingLayout>
  );
};

export default ProfessionalServicesData;
