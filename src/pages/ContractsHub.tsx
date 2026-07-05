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
      <div className="container max-w-7xl pt-8 pb-10 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
              <FileSignature className="h-3 w-3" /> Contracts Hub
            </div>
            <h1 className="text-[26px] font-semibold tracking-tight text-foreground">
              Contract intelligence at a glance
            </h1>
            <p className="text-[13px] text-muted-foreground max-w-2xl">
              Live contract value, upcoming renewals, revenue risk, and every active agreement.
            </p>
          </div>
          <Button asChild size="sm" className="h-9">
            <Link to="/contracts/new">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
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

