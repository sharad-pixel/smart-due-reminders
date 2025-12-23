import { useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "lucide-react";
import { useCollectionCampaigns } from "@/hooks/useCollectionCampaigns";
import { CampaignList } from "@/components/campaigns/CampaignList";
import { CreateCampaignModal } from "@/components/campaigns/CreateCampaignModal";

export default function CollectionCampaigns() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { campaigns, isLoading, updateCampaignStatus, deleteCampaign } = useCollectionCampaigns();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Collection Campaigns
            </h1>
            <p className="text-muted-foreground">
              AI-powered campaigns based on risk scores and account intelligence
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>

        <CampaignList
          campaigns={campaigns}
          onStatusChange={(id, status) => updateCampaignStatus.mutate({ id, status })}
          onDelete={(id) => deleteCampaign.mutate(id)}
          onView={(campaign) => console.log("View campaign:", campaign)}
        />

        <CreateCampaignModal open={showCreateModal} onOpenChange={setShowCreateModal} />
      </div>
    </Layout>
  );
}
