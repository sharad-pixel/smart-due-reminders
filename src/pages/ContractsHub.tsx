import { useSearchParams } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/seo/SEO";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileSignature, Sparkles } from "lucide-react";
import ActiveContracts from "./ActiveContracts";
import LiveContracts from "./LiveContracts";

/**
 * Contracts Hub — unified page combining:
 *  - Active Contracts (browsing the live contract portfolio)
 *  - Ingestion & Extraction (AI Smart Ingestion for contract documents)
 */
export default function ContractsHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hub = searchParams.get("hub") === "ingestion" ? "ingestion" : "active";

  const setHub = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("hub", value);
    // Reset inner-tab params when swapping hubs
    if (value === "active") {
      next.delete("status");
      next.delete("tab");
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <Layout>
      <SEO
        title="Contracts · Recouply"
        description="Browse active contracts and ingest new documents with AI in a single workspace."
      />
      <div className="container max-w-7xl pt-6">
        <Tabs value={hub} onValueChange={setHub} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="active" className="gap-2">
              <FileSignature className="h-4 w-4" />
              Active Contracts
            </TabsTrigger>
            <TabsTrigger value="ingestion" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Ingestion & Extraction
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-0">
            <ActiveContracts embedded />
          </TabsContent>
          <TabsContent value="ingestion" className="mt-0">
            <LiveContracts embedded />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
