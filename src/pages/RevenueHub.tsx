import Layout from "@/components/layout/Layout";
import SEO from "@/components/seo/SEO";
import { usePageTitle } from "@/hooks/usePageTitle";
import { DashboardAskAI } from "@/components/dashboard/DashboardAskAI";
import { ContractIntelligenceSummary } from "@/components/dashboard/ContractIntelligenceSummary";
import { CollectionsCommandSummary } from "@/components/dashboard/CollectionsCommandSummary";
import { Sparkles } from "lucide-react";

/**
 * Revenue Intelligence Hub — authenticated landing page.
 *
 * Nicolas prompt on top, then Contract + Collections command-center summaries
 * that link deeper into their respective hubs.
 */
export default function RevenueHub() {
  usePageTitle("Revenue Intelligence Hub");

  return (
    <Layout>
      <SEO
        title="Revenue Intelligence Hub · Recouply"
        description="Ask Nicolas about revenue risk, contracts, and collections. Live command-center numbers across your entire contract-to-cash lifecycle."
      />
      <div className="w-full max-w-[1600px] mx-auto pt-8 pb-10 space-y-8">
        {/* Hero */}
        <header className="space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Revenue Intelligence Hub
          </div>
          <h1 className="text-[26px] font-semibold tracking-tight text-foreground">
            Ask Nicolas anything about your revenue.
          </h1>
          <p className="text-[13px] text-muted-foreground max-w-2xl">
            Full context across contracts, invoices, payments, and risk signals.
          </p>
        </header>

        {/* Nicolas prompt */}
        <DashboardAskAI />

        {/* Command centers */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <ContractIntelligenceSummary />
          <CollectionsCommandSummary />
        </div>
      </div>
    </Layout>
  );
}
