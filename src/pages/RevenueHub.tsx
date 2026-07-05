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
      <div className="container max-w-7xl pt-6 pb-10 space-y-6">
        {/* Hero */}
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Revenue Intelligence Hub
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Ask Nicolas anything about your revenue.
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Your Revenue Intelligence Agent has full context across contracts, invoices, payments,
            and risk signals. Ask a question, or jump into the Contracts or Collections hub below.
          </p>
        </header>

        {/* Nicolas prompt */}
        <DashboardAskAI />

        {/* Command centers */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <ContractIntelligenceSummary />
          <CollectionsCommandSummary />
        </div>
      </div>
    </Layout>
  );
}
