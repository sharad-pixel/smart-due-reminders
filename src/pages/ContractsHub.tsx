import { useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import ActiveContracts from "./ActiveContracts";

/**
 * Contracts Hub — the portfolio view of all active contracts.
 * New contract ingestion has moved to a dedicated guided wizard at
 * /contracts/new (Upload → Review → Customer → Compliance).
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
        title="Contracts · Recouply"
        description="Portfolio of active contracts. Ingest new contracts through the guided wizard."
      />
      <div className="container max-w-7xl pt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contracts</h1>
            <p className="text-sm text-muted-foreground">
              Every contract you've ingested, matched to a customer, and prepared for revenue compliance.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/contracts/new">
              <Sparkles className="h-4 w-4 mr-2" />
              New Contract
            </Link>
          </Button>
        </div>

        <ActiveContracts embedded />
      </div>
    </Layout>
  );
}
