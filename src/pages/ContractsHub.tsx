import { useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Sparkles, FileSignature } from "lucide-react";
import ActiveContracts from "./ActiveContracts";
import { ContractIntelligenceSummary } from "@/components/dashboard/ContractIntelligenceSummary";

/**
 * Contracts Hub — dedicated dashboard + portfolio for contract data.
 * KPIs (value, expiring, risk) sit on top; the full active-contract portfolio below.
 * New contract ingestion moves to the guided wizard at /contracts/new.
 */
export default function ContractsHub() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  // Redirect legacy ?hub=ingestion links into the new wizard.
  useEffect(() => {
    if (sp.get("hub") === "ingestion") navigate("/contracts/new", { replace: true });
  }, [sp, navigate]);

  return (
    <Layout>
      <SEO
        title="Contracts Hub · Recouply"
        description="Contract portfolio dashboard: value under management, upcoming renewals, revenue risk, and every active agreement."
      />
      <div className="container max-w-7xl pt-6 pb-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/10 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <FileSignature className="h-3.5 w-3.5" /> Contracts Hub
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Contract intelligence at a glance</h1>
            <p className="text-sm text-muted-foreground">
              Live contract value, upcoming renewals, revenue risk, and every active agreement in one place.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/contracts/new">
              <Sparkles className="h-4 w-4 mr-2" />
              New Contract
            </Link>
          </Button>
        </div>

        {/* Contract KPI dashboard */}
        <ContractIntelligenceSummary />

        {/* Portfolio */}
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Contract portfolio</h2>
            <p className="text-xs text-muted-foreground">
              Every contract ingested, matched to a customer, and prepared for revenue compliance.
            </p>
          </div>
          <ActiveContracts embedded />
        </div>
      </div>
    </Layout>
  );
}

