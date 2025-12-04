import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateSourceModalProps {
  open: boolean;
  onClose: () => void;
}

const SYSTEM_TYPES = [
  { value: "quickbooks", label: "QuickBooks" },
  { value: "netsuite", label: "NetSuite" },
  { value: "sap", label: "SAP" },
  { value: "xero", label: "Xero" },
  { value: "sage", label: "Sage" },
  { value: "freshbooks", label: "FreshBooks" },
  { value: "zoho", label: "Zoho" },
  { value: "custom", label: "Custom / Other" },
];

export const CreateSourceModal = ({ open, onClose }: CreateSourceModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sourceName, setSourceName] = useState("");
  const [systemType, setSystemType] = useState("custom");
  const [description, setDescription] = useState("");

  const createSource = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("data_center_sources")
        .insert({
          user_id: user.id,
          source_name: sourceName,
          system_type: systemType,
          description: description || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-center-sources"] });
      queryClient.invalidateQueries({ queryKey: ["data-center-stats"] });
      toast({ title: "Source created", description: "You can now upload files using this source profile." });
      handleClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    setSourceName("");
    setSystemType("custom");
    setDescription("");
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceName.trim()) {
      toast({ title: "Error", description: "Source name is required", variant: "destructive" });
      return;
    }
    createSource.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Data Source</DialogTitle>
          <DialogDescription>
            Define a source profile to save column mappings for future uploads
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sourceName">Source Name *</Label>
            <Input
              id="sourceName"
              placeholder="e.g., QuickBooks Export, NetSuite AR Report"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemType">System Type</Label>
            <Select value={systemType} onValueChange={setSystemType}>
              <SelectTrigger>
                <SelectValue placeholder="Select system type" />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Notes about this data source..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSource.isPending}>
              {createSource.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Source
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
