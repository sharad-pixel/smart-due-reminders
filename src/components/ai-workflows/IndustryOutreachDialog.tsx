import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const INDUSTRIES = [
  "Accounting & Finance",
  "Advertising & Marketing",
  "Agriculture",
  "Automotive",
  "Construction",
  "Consulting",
  "E-commerce",
  "Education",
  "Energy & Utilities",
  "Engineering",
  "Food & Beverage",
  "Healthcare",
  "Hospitality & Travel",
  "Insurance",
  "IT & Technology",
  "Legal Services",
  "Logistics & Transportation",
  "Manufacturing",
  "Media & Entertainment",
  "Nonprofit",
  "Professional Services",
  "Real Estate",
  "Retail",
  "SaaS / Software",
  "Staffing & Recruiting",
  "Telecommunications",
  "Wholesale & Distribution",
  "Other",
];

interface IndustryOutreachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (industry: string, businessDescription: string, replaceScheduled: boolean) => Promise<void>;
}

export function IndustryOutreachDialog({ open, onOpenChange, onGenerate }: IndustryOutreachDialogProps) {
  const [industry, setIndustry] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [replaceScheduled, setReplaceScheduled] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved values
  useEffect(() => {
    if (open && !loaded) {
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("branding_settings")
          .select("industry, business_description")
          .eq("user_id", user.id)
          .single();
        if (data) {
          setIndustry((data as any).industry || "");
          setBusinessDescription((data as any).business_description || "");
        }
        setLoaded(true);
      })();
    }
  }, [open, loaded]);

  const handleGenerate = async () => {
    if (!industry) {
      toast.error("Please select an industry");
      return;
    }
    if (!businessDescription.trim()) {
      toast.error("Please describe your business products/services");
      return;
    }

    setGenerating(true);
    try {
      // Save to branding_settings
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: saveError } = await supabase
          .from("branding_settings")
          .update({ 
            industry: industry, 
            business_description: businessDescription 
          } as any)
          .eq("user_id", user.id);
        if (saveError) {
          console.error("Failed to save industry context:", saveError);
          toast.error("Failed to save industry context");
          setGenerating(false);
          return;
        }
        console.log("Saved industry context:", { industry, businessDescription: businessDescription.substring(0, 50) });
      }

      await onGenerate(industry, businessDescription, replaceScheduled);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to generate industry-specific outreach");
    } finally {
      setGenerating(false);
    }
  };

  const hasBusinessInfo = !!industry && !!businessDescription.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate AI Templates
          </DialogTitle>
          <DialogDescription>
            Provide your industry and business details so AI agents can craft outreach messages that reference your products/services naturally — making collections feel contextual, not generic.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger>
                <SelectValue placeholder="Select your industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((ind) => (
                  <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessDescription">
              What does your business do? (Products / Services)
            </Label>
            <Textarea
              id="businessDescription"
              placeholder="e.g. We provide cloud-based project management software for construction teams. Our main products are a scheduling tool and a field reporting app sold on annual subscriptions."
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value.slice(0, 1000))}
              maxLength={1000}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {businessDescription.length}/1,000
            </p>
            <p className="text-xs text-muted-foreground">
              This context helps AI agents reference your specific offerings in collection messages, making outreach feel personalized and relevant.
            </p>
          </div>

          <div className="flex items-start space-x-3 rounded-md border p-3 bg-muted/30">
            <Checkbox
              id="replaceScheduled"
              checked={replaceScheduled}
              onCheckedChange={(checked) => setReplaceScheduled(checked === true)}
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="replaceScheduled" className="text-sm font-medium cursor-pointer">
                Replace all scheduled outreach with new templates
              </Label>
              <p className="text-xs text-muted-foreground">
                This will cancel all pending/scheduled drafts and regenerate them using the new industry-specific templates. Existing sent outreach will not be affected.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={generating || !hasBusinessInfo} className="gap-1.5">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Generating..." : "Generate Templates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
