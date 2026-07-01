import { lazy, Suspense } from "react";
import MarketingLayout from "@/components/layout/MarketingLayout";
import EnterpriseHero from "@/components/marketing/enterprise/EnterpriseHero";
import SEOHead from "@/components/seo/SEOHead";
import { generateFAQSchema } from "@/lib/seoConfig";

const RevenueJourney = lazy(() => import("@/components/marketing/enterprise/RevenueJourney"));
const ContractIntelligenceSection = lazy(() => import("@/components/marketing/enterprise/ContractIntelligenceSection"));
const CollectionIntelligenceSection = lazy(() => import("@/components/marketing/enterprise/CollectionIntelligenceSection"));
const CollectabilityAssuranceSection = lazy(() => import("@/components/marketing/enterprise/CollectabilityAssuranceSection"));
const ExecutiveDashboardSection = lazy(() => import("@/components/marketing/enterprise/ExecutiveDashboardSection"));
const AIRecommendationsSection = lazy(() => import("@/components/marketing/enterprise/AIRecommendationsSection"));
const EnterpriseFeaturesSection = lazy(() => import("@/components/marketing/enterprise/EnterpriseFeaturesSection"));
const IntegrationsShowcase = lazy(() => import("@/components/marketing/enterprise/IntegrationsShowcase"));
const CustomerResultsMetrics = lazy(() => import("@/components/marketing/enterprise/CustomerResultsMetrics"));
const EnterpriseFinalCTA = lazy(() => import("@/components/marketing/enterprise/EnterpriseFinalCTA"));
const FAQAccordion = lazy(() => import("@/components/marketing/FAQAccordion"));

const Home = () => {
  const homeFaqs = [
    { question: "What is Recouply's Revenue Intelligence Platform?", answer: "Recouply is an AI-powered Revenue Intelligence Platform that unifies Contract Intelligence and Collection Intelligence — transforming every commercial agreement into structured revenue data and every customer interaction into predictable cash flow." },
    { question: "How is Recouply different from a CLM or an AR automation tool?", answer: "CLMs stop at signature. AR tools start at the invoice. Recouply connects the entire revenue lifecycle — from contract terms and renewal triggers to invoicing, collections, and executive cash forecasting." },
    { question: "What does Contract Intelligence do?", answer: "Contract Intelligence extracts commercial terms (ARR, MRR, ACV, TCV, professional services, renewals, notice periods, billing schedules), scores revenue exposure, and generates workflow tasks — all with confidence scoring and editable AI results." },
    { question: "What does Collection Intelligence do?", answer: "Collection Intelligence unifies contracts, invoices, payment history, promises to pay, risk scoring, communication timelines, and AI recommendations into a single customer profile — then executes prioritized, on-brand outreach with human approval." },
    { question: "Which systems does Recouply integrate with?", answer: "Stripe, QuickBooks, NetSuite, Salesforce, HubSpot, Google Drive, Google Sheets, Microsoft 365, email, REST API, webhooks, and CSV — synchronized bidirectionally." },
    { question: "Is Recouply enterprise-ready?", answer: "Yes. SOC 2 ready architecture, SSO, role-based access, custom roles, approval workflows, audit logs, multi-entity support, and an API-first foundation." },
  ];

  return (
    <MarketingLayout>
      <SEOHead
        title="Recouply · Revenue Intelligence — From Contract to Cash"
        description="Revenue Intelligence — from contract to cash. AI-native Contract Intelligence and Collection Intelligence that reads every clause, tracks every obligation, and turns every receivable into predictable cash."
        keywords="revenue intelligence platform, contract intelligence, collection intelligence, ai contract extraction, ar automation, cash forecasting, dso reduction, enterprise finance software"
        canonical="https://recouply.ai"
        structuredData={generateFAQSchema(homeFaqs)}
      />
      <EnterpriseHero />
      <Suspense fallback={null}>
        <RevenueJourney />
        <ContractIntelligenceSection />
        <ContractIntelligenceSection />
        <CollectabilityAssuranceSection />
        <CollectionIntelligenceSection />
        <ExecutiveDashboardSection />
        <AIRecommendationsSection />
        <EnterpriseFeaturesSection />
        <IntegrationsShowcase />
        <CustomerResultsMetrics />
        <FAQAccordion />
        <EnterpriseFinalCTA />
      </Suspense>
    </MarketingLayout>
  );
};

export default Home;
