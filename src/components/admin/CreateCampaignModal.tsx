import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Target, Zap, Users, RotateCcw, Megaphone, Gift } from "lucide-react";

interface CreateCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateCampaign: (campaign: CampaignFormData) => void;
  isCreating: boolean;
}

export interface CampaignFormData {
  name: string;
  description: string;
  campaign_type: string;
  target_segment: string;
  target_industry: string;
  target_company_size: string;
  min_lead_score: number;
}

const campaignTypes = [
  { id: "nurture", label: "Nurture", icon: Users, description: "Build relationships with new leads" },
  { id: "acquisition", label: "Acquisition", icon: Target, description: "Convert leads to customers" },
  { id: "reactivation", label: "Reactivation", icon: RotateCcw, description: "Re-engage cold leads" },
  { id: "announcement", label: "Announcement", icon: Megaphone, description: "Share product updates" },
  { id: "promotion", label: "Promotion", icon: Gift, description: "Special offers & discounts" },
];

const segments = [
  { id: "all", label: "All Segments" },
  { id: "new", label: "New Leads" },
  { id: "engaged", label: "Engaged" },
  { id: "hot", label: "Hot Leads" },
  { id: "cold", label: "Cold Leads" },
];

const industries = [
  { id: "all", label: "All Industries" },
  { id: "saas", label: "SaaS" },
  { id: "fintech", label: "FinTech" },
  { id: "healthcare", label: "Healthcare" },
  { id: "ecommerce", label: "E-commerce" },
  { id: "professional_services", label: "Professional Services" },
  { id: "manufacturing", label: "Manufacturing" },
];

const companySizes = [
  { id: "all", label: "All Sizes" },
  { id: "1-10", label: "1-10 employees" },
  { id: "11-50", label: "11-50 employees" },
  { id: "51-200", label: "51-200 employees" },
  { id: "201-500", label: "201-500 employees" },
  { id: "500+", label: "500+ employees" },
];

export const CreateCampaignModal = ({
  open,
  onOpenChange,
  onCreateCampaign,
  isCreating,
}: CreateCampaignModalProps) => {
  const [formData, setFormData] = useState<CampaignFormData>({
    name: "",
    description: "",
    campaign_type: "nurture",
    target_segment: "all",
    target_industry: "all",
    target_company_size: "all",
    min_lead_score: 0,
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) return;
    onCreateCampaign(formData);
  };

  const selectedType = campaignTypes.find((t) => t.id === formData.campaign_type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Create Marketing Campaign
          </DialogTitle>
          <DialogDescription>
            Define your campaign strategy and target audience
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Campaign Basics */}
          <div className="space-y-4">
            <div>
              <Label>Campaign Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Q1 SaaS Nurture Sequence"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of campaign goals..."
                rows={2}
              />
            </div>
          </div>

          {/* Campaign Type Selection */}
          <div>
            <Label className="mb-3 block">Campaign Type</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {campaignTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setFormData((f) => ({ ...f, campaign_type: type.id }))}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    formData.campaign_type === type.id
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50"
                  }`}
                >
                  <type.icon
                    className={`h-5 w-5 mb-2 ${
                      formData.campaign_type === type.id ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <p className="font-medium text-sm">{type.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Targeting Criteria */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
            <h3 className="font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              Targeting Criteria
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Target Segment</Label>
                <Select
                  value={formData.target_segment}
                  onValueChange={(v) => setFormData((f) => ({ ...f, target_segment: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.map((seg) => (
                      <SelectItem key={seg.id} value={seg.id}>
                        {seg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Industry</Label>
                <Select
                  value={formData.target_industry}
                  onValueChange={(v) => setFormData((f) => ({ ...f, target_industry: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((ind) => (
                      <SelectItem key={ind.id} value={ind.id}>
                        {ind.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Company Size</Label>
                <Select
                  value={formData.target_company_size}
                  onValueChange={(v) => setFormData((f) => ({ ...f, target_company_size: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {companySizes.map((size) => (
                      <SelectItem key={size.id} value={size.id}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Minimum Lead Score</Label>
                <span className="text-sm font-medium">{formData.min_lead_score}</span>
              </div>
              <Slider
                value={[formData.min_lead_score]}
                onValueChange={(v) => setFormData((f) => ({ ...f, min_lead_score: v[0] }))}
                max={100}
                step={5}
                className="py-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>All leads</span>
                <span>Hot leads only</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.name.trim() || isCreating}
          >
            {isCreating ? "Creating..." : "Create Campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
