import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  UserMinus, 
  Loader2, 
  BellOff,
  Clock,
  CheckCircle2,
  Send,
  Mail
} from "lucide-react";
import { format } from "date-fns";
import { LeadScoreBadge } from "./LeadScoreBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface MarketingLead {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  lead_score: number | null;
  segment: string | null;
  lifecycle_stage: string | null;
  last_engaged_at: string | null;
  created_at: string;
  status: string;
}

interface LeadProgress {
  lead_id: string;
  current_step: number;
  step_0_sent_at: string | null;
  step_1_sent_at: string | null;
  step_2_sent_at: string | null;
  next_send_at: string | null;
  status: string;
}

interface CampaignLeadsTableProps {
  leads: MarketingLead[];
  leadProgress?: LeadProgress[];
  campaignId?: string;
  isLoading?: boolean;
  onRemoveLeads?: (leadIds: string[]) => void;
  isRemovingLeads?: boolean;
}

export function CampaignLeadsTable({
  leads,
  leadProgress = [],
  campaignId,
  isLoading,
  onRemoveLeads,
  isRemovingLeads,
}: CampaignLeadsTableProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Filter leads by search
  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;
    const query = searchQuery.toLowerCase();
    return leads.filter(
      (l) =>
        l.email.toLowerCase().includes(query) ||
        l.name?.toLowerCase().includes(query) ||
        l.company?.toLowerCase().includes(query)
    );
  }, [leads, searchQuery]);

  // Active leads (not unsubscribed)
  const activeLeads = useMemo(() => filteredLeads.filter(l => l.status !== "unsubscribed"), [filteredLeads]);

  // Get progress for a lead
  const getLeadProgress = (leadId: string): LeadProgress | undefined => {
    return leadProgress.find(p => p.lead_id === leadId);
  };

  // Send to selected leads mutation
  const sendToSelectedMutation = useMutation({
    mutationFn: async (stepNumber: number) => {
      if (!campaignId) throw new Error("Campaign ID required");
      
      const { data, error } = await supabase.functions.invoke("send-campaign-outreach", {
        body: {
          campaign_id: campaignId,
          step_number: stepNumber,
          lead_ids: selectedLeadIds,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sent ${data.sent_count} emails successfully`);
      setSelectedLeadIds([]);
      queryClient.invalidateQueries({ queryKey: ["lead-campaign-progress", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Get progress badge
  const getProgressBadge = (progress: LeadProgress | undefined) => {
    if (!progress) {
      return <Badge variant="outline" className="text-xs">Not Started</Badge>;
    }
    
    if (progress.step_2_sent_at) {
      return (
        <Badge className="text-xs bg-green-100 text-green-800">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    }
    
    if (progress.step_1_sent_at) {
      return (
        <Badge className="text-xs bg-blue-100 text-blue-800">
          <Send className="h-3 w-3 mr-1" />
          Step 2/3
        </Badge>
      );
    }
    
    if (progress.step_0_sent_at) {
      return (
        <Badge className="text-xs bg-amber-100 text-amber-800">
          <Send className="h-3 w-3 mr-1" />
          Step 1/3
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="text-xs">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  // Get next step for lead
  const getNextStep = (progress: LeadProgress | undefined): number | null => {
    if (!progress) return 0;
    if (!progress.step_0_sent_at) return 0;
    if (!progress.step_1_sent_at) return 1;
    if (!progress.step_2_sent_at) return 2;
    return null; // Completed
  };

  // Toggle lead selection (skip unsubscribed)
  const toggleLeadSelection = (id: string) => {
    const lead = leads.find(l => l.id === id);
    if (lead?.status === "unsubscribed") return;
    
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === activeLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(activeLeads.map((l) => l.id));
    }
  };

  const handleRemoveLeads = () => {
    if (onRemoveLeads && selectedLeadIds.length > 0) {
      onRemoveLeads(selectedLeadIds);
      setSelectedLeadIds([]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search and Actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedLeadIds.length > 0 && (
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => sendToSelectedMutation.mutate(0)}
              disabled={sendToSelectedMutation.isPending}
            >
              {sendToSelectedMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Mail className="h-3 w-3 mr-1" />
              )}
              Send Next Step ({selectedLeadIds.length})
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleRemoveLeads}
              disabled={isRemovingLeads}
              className="text-destructive hover:text-destructive"
            >
              {isRemovingLeads ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <UserMinus className="h-3 w-3 mr-1" />
              )}
              Remove
            </Button>
          </div>
        )}
      </div>

      {/* Leads Table */}
      <ScrollArea className="h-[400px] border rounded-lg">
        {filteredLeads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No leads assigned to this campaign</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={activeLeads.length > 0 && selectedLeadIds.length === activeLeads.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Workflow Progress</TableHead>
                <TableHead>Next Send</TableHead>
                <TableHead>Last Engaged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => {
                const isUnsubscribed = lead.status === "unsubscribed";
                const progress = getLeadProgress(lead.id);
                const nextStep = getNextStep(progress);
                
                return (
                  <TableRow key={lead.id} className={isUnsubscribed ? "opacity-60 bg-muted/30" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedLeadIds.includes(lead.id)}
                        onCheckedChange={() => toggleLeadSelection(lead.id)}
                        disabled={isUnsubscribed}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium">{lead.name || lead.email}</p>
                          {lead.name && (
                            <p className="text-xs text-muted-foreground">{lead.email}</p>
                          )}
                        </div>
                        {isUnsubscribed && (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                            <BellOff className="h-3 w-3 mr-1" />
                            Unsub
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{lead.company || "-"}</TableCell>
                    <TableCell>
                      <LeadScoreBadge score={lead.lead_score || 0} size="sm" />
                    </TableCell>
                    <TableCell>
                      {getProgressBadge(progress)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {nextStep !== null ? (
                        <span className="text-muted-foreground">
                          {progress?.next_send_at 
                            ? format(new Date(progress.next_send_at), "MMM d, HH:mm")
                            : "Ready now"}
                        </span>
                      ) : (
                        <span className="text-green-600">Done</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lead.last_engaged_at
                        ? format(new Date(lead.last_engaged_at), "MMM d, yyyy")
                        : "Never"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ScrollArea>
    </div>
  );
}
