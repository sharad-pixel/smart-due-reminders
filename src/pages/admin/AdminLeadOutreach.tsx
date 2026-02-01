import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { useDropzone } from "react-dropzone";
import { Upload, Plus, Send, Trash2, Mail, Users, FileSpreadsheet, Sparkles, Loader2, RefreshCw, Eye, Target, BarChart3, Zap, Search, UserPlus, ClipboardPaste, BellOff } from "lucide-react";
import * as XLSX from "xlsx";
import { MarketingLeadStats } from "@/components/admin/MarketingLeadStats";
import { MarketingCampaignCard } from "@/components/admin/MarketingCampaignCard";
import { LeadSegmentFilter } from "@/components/admin/LeadSegmentFilter";
import { CreateCampaignModal, CampaignFormData } from "@/components/admin/CreateCampaignModal";
import { LeadScoreBadge } from "@/components/admin/LeadScoreBadge";
import { BulkEmailImportModal } from "@/components/admin/BulkEmailImportModal";
import { BroadcastActionsCard } from "@/components/admin/BroadcastActionsCard";
import { CampaignDetailsModal } from "@/components/admin/CampaignDetailsModal";
import { SendEmailModal } from "@/components/admin/SendEmailModal";
import { PricingTierCampaigns, PRICING_TIER_CAMPAIGNS } from "@/components/admin/PricingTierCampaigns";
import { AssignLeadsToCampaignModal } from "@/components/admin/AssignLeadsToCampaignModal";

interface MarketingLead {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  source: string | null;
  tags: string[] | null;
  status: string;
  created_at: string;
  lead_score: number | null;
  segment: string | null;
  industry: string | null;
  company_size: string | null;
  last_engaged_at: string | null;
  campaign_id: string | null;
  lifecycle_stage: string | null;
}

interface EmailBroadcast {
  id: string;
  subject: string;
  body_html: string;
  body_text?: string | null;
  status: string;
  total_recipients: number | null;
  sent_count: number | null;
  failed_count: number | null;
  sent_at: string | null;
  created_at: string;
  audience?: string | null;
  campaign_id?: string | null;
}

interface MarketingCampaign {
  id: string;
  name: string;
  description: string | null;
  campaign_type: string;
  target_segment: string | null;
  target_industry: string | null;
  target_company_size: string | null;
  min_lead_score: number | null;
  status: string;
  started_at: string | null;
  ends_at: string | null;
  total_leads: number | null;
  emails_sent: number | null;
  opens: number | null;
  clicks: number | null;
  conversions: number | null;
  created_at: string;
}

export default function AdminLeadOutreach() {
  const queryClient = useQueryClient();
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showDeleteCampaign, setShowDeleteCampaign] = useState<string | null>(null);
  const [showCampaignDetails, setShowCampaignDetails] = useState<MarketingCampaign | null>(null);
  const [showSendEmail, setShowSendEmail] = useState(false);
  const [showAssignToCampaign, setShowAssignToCampaign] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [activeSegment, setActiveSegment] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  
  // Form states
  const [newLead, setNewLead] = useState({ 
    email: "", 
    name: "", 
    company: "", 
    source: "manual",
    industry: "",
    company_size: "",
    lead_score: 0
  });
  const [emailForm, setEmailForm] = useState({ subject: "", body_html: "", body_text: "" });
  const [aiPrompt, setAiPrompt] = useState({ topic: "", tone: "professional", email_type: "product_update" as const });

  // Fetch leads
  const { data: leads = [], isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ["marketing-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_leads")
        .select("*")
        .order("lead_score", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as MarketingLead[];
    },
  });

  // Fetch campaigns
  const { data: campaigns = [], isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery({
    queryKey: ["marketing-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MarketingCampaign[];
    },
  });

  // Fetch broadcasts
  const { data: broadcasts = [], isLoading: broadcastsLoading } = useQuery({
    queryKey: ["email-broadcasts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_broadcasts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as EmailBroadcast[];
    },
  });

  // Compute stats
  const stats = useMemo(() => {
    const weekAgo = subDays(new Date(), 7);
    const newLeads = leads.filter(l => new Date(l.created_at) >= weekAgo).length;
    const hotLeads = leads.filter(l => (l.lead_score || 0) >= 80).length;
    const activeCampaigns = campaigns.filter(c => c.status === "active").length;
    const totalSent = broadcasts.reduce((sum, b) => sum + (b.sent_count || 0), 0);
    const converted = leads.filter(l => l.lifecycle_stage === "customer").length;
    const conversionRate = leads.length > 0 ? (converted / leads.length) * 100 : 0;

    return { totalLeads: leads.length, newLeads, hotLeads, activeCampaigns, totalSent, conversionRate };
  }, [leads, campaigns, broadcasts]);

  // Compute segment counts
  const segmentCounts = useMemo(() => ({
    all: leads.length,
    new: leads.filter(l => l.segment === "new" || !l.segment).length,
    engaged: leads.filter(l => l.segment === "engaged").length,
    hot: leads.filter(l => (l.lead_score || 0) >= 80).length,
    cold: leads.filter(l => l.segment === "cold" || (l.lead_score || 0) < 20).length,
    converted: leads.filter(l => l.lifecycle_stage === "customer").length,
    unsubscribed: leads.filter(l => l.status === "unsubscribed").length,
  }), [leads]);

  // Count leads by pricing tier campaign
  const leadsCountByTier = useMemo(() => {
    const tierCounts: Record<string, number> = {};
    PRICING_TIER_CAMPAIGNS.forEach(tier => {
      // Find campaigns matching this tier
      const tierCampaign = campaigns.find(c => 
        c.name.toLowerCase().includes(tier.tier.replace("_", " ")) ||
        c.name.toLowerCase().includes(tier.tier)
      );
      if (tierCampaign) {
        tierCounts[tier.tier] = leads.filter(l => l.campaign_id === tierCampaign.id).length;
      }
    });
    return tierCounts;
  }, [leads, campaigns]);

  // Count active (non-unsubscribed) selected leads
  const activeSelectedLeads = useMemo(() => {
    return leads.filter(l => selectedLeads.includes(l.id) && l.status !== "unsubscribed");
  }, [leads, selectedLeads]);

  // Filter leads
  const filteredLeads = useMemo(() => {
    let result = leads;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.email.toLowerCase().includes(query) ||
        l.name?.toLowerCase().includes(query) ||
        l.company?.toLowerCase().includes(query)
      );
    }

    // Segment filter
    if (activeSegment !== "all") {
      switch (activeSegment) {
        case "new":
          result = result.filter(l => l.segment === "new" || !l.segment);
          break;
        case "engaged":
          result = result.filter(l => l.segment === "engaged");
          break;
        case "hot":
          result = result.filter(l => (l.lead_score || 0) >= 80);
          break;
        case "cold":
          result = result.filter(l => l.segment === "cold" || (l.lead_score || 0) < 20);
          break;
        case "converted":
          result = result.filter(l => l.lifecycle_stage === "customer");
          break;
      }
    }

    // Campaign filter
    if (selectedCampaignId) {
      result = result.filter(l => l.campaign_id === selectedCampaignId);
    }

    return result;
  }, [leads, searchQuery, activeSegment, selectedCampaignId]);

  // Add lead mutation
  const addLeadMutation = useMutation({
    mutationFn: async (lead: typeof newLead) => {
      const { error } = await supabase.from("marketing_leads").insert({
        email: lead.email,
        name: lead.name || null,
        company: lead.company || null,
        source: lead.source,
        industry: lead.industry || null,
        company_size: lead.company_size || null,
        lead_score: lead.lead_score || 0,
        segment: "new",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead added successfully");
      setShowAddLead(false);
      setNewLead({ email: "", name: "", company: "", source: "manual", industry: "", company_size: "", lead_score: 0 });
      queryClient.invalidateQueries({ queryKey: ["marketing-leads"] });
    },
    onError: (error: Error) => {
      toast.error(error.message.includes("duplicate") ? "This email already exists" : error.message);
    },
  });

  // Delete leads mutation
  const deleteLeadsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("marketing_leads").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leads deleted");
      setSelectedLeads([]);
      queryClient.invalidateQueries({ queryKey: ["marketing-leads"] });
    },
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (campaign: CampaignFormData) => {
      const { error } = await supabase.from("marketing_campaigns").insert({
        name: campaign.name,
        description: campaign.description || null,
        campaign_type: campaign.campaign_type,
        target_segment: campaign.target_segment !== "all" ? campaign.target_segment : null,
        target_industry: campaign.target_industry !== "all" ? campaign.target_industry : null,
        target_company_size: campaign.target_company_size !== "all" ? campaign.target_company_size : null,
        min_lead_score: campaign.min_lead_score,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign created");
      setShowCreateCampaign(false);
      queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update campaign status
  const updateCampaignStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, any> = { status };
      if (status === "active" && !campaigns.find(c => c.id === id)?.started_at) {
        updates.started_at = new Date().toISOString();
      }
      const { error } = await supabase.from("marketing_campaigns").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign updated");
      queryClient.invalidateQueries({ queryKey: ["marketing-campaigns"] });
    },
  });

  // Assign leads to campaign
  const assignLeadsToCampaign = useMutation({
    mutationFn: async ({ leadIds, campaignId }: { leadIds: string[]; campaignId: string }) => {
      const { error } = await supabase
        .from("marketing_leads")
        .update({ campaign_id: campaignId })
        .in("id", leadIds);
      if (error) throw error;

      // Update campaign lead count
      const { data: count } = await supabase
        .from("marketing_leads")
        .select("id", { count: "exact" })
        .eq("campaign_id", campaignId);
      
      await supabase
        .from("marketing_campaigns")
        .update({ total_leads: count?.length || 0 })
        .eq("id", campaignId);
    },
    onSuccess: () => {
      toast.success("Leads assigned to campaign");
      setSelectedLeads([]);
      queryClient.invalidateQueries({ queryKey: ["marketing-leads", "marketing-campaigns"] });
    },
  });

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      // First unassign all leads from this campaign
      await supabase
        .from("marketing_leads")
        .update({ campaign_id: null })
        .eq("campaign_id", id);
      
      const { error } = await supabase.from("marketing_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign deleted");
      setShowDeleteCampaign(null);
      queryClient.invalidateQueries({ queryKey: ["marketing-campaigns", "marketing-leads"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete broadcasts mutation
  const deleteBroadcastsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("email_broadcasts").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Broadcasts deleted");
      queryClient.invalidateQueries({ queryKey: ["email-broadcasts"] });
    },
  });

  // Fetch leads for the selected campaign (for details modal)
  const campaignLeads = useMemo(() => {
    if (!showCampaignDetails) return [];
    return leads.filter((l) => l.campaign_id === showCampaignDetails.id);
  }, [leads, showCampaignDetails]);

  // Fetch activities for the selected campaign
  const { data: campaignActivities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ["campaign-activities", showCampaignDetails?.id],
    queryFn: async () => {
      if (!showCampaignDetails) return [];
      // Query broadcasts that were sent to this campaign's leads
      const campaignLeadEmails = leads
        .filter((l) => l.campaign_id === showCampaignDetails.id)
        .map((l) => l.email);
      
      if (campaignLeadEmails.length === 0) return [];

      // For now, return mock activity data based on broadcast history
      // In a full implementation, you'd have a dedicated activity tracking table
      const { data: broadcastData } = await supabase
        .from("email_broadcasts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      // Create activity entries from broadcasts
      const activities = (broadcastData || []).flatMap((broadcast) => {
        return campaignLeadEmails.slice(0, 5).map((email, idx) => ({
          id: `${broadcast.id}-${idx}`,
          lead_email: email,
          activity_type: "email",
          status: broadcast.status,
          sent_at: broadcast.sent_at,
          opened_at: idx < 2 && broadcast.sent_at ? broadcast.sent_at : null, // Mock some opens
          clicked_at: idx === 0 && broadcast.sent_at ? broadcast.sent_at : null, // Mock some clicks
          subject: broadcast.subject,
        }));
      });

      return activities;
    },
    enabled: !!showCampaignDetails,
  });

  // Remove leads from campaign mutation
  const removeLeadsFromCampaign = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { error } = await supabase
        .from("marketing_leads")
        .update({ campaign_id: null })
        .in("id", leadIds);
      if (error) throw error;

      // Update campaign lead count
      if (showCampaignDetails) {
        const remainingCount = campaignLeads.length - leadIds.length;
        await supabase
          .from("marketing_campaigns")
          .update({ total_leads: Math.max(0, remainingCount) })
          .eq("id", showCampaignDetails.id);
      }
    },
    onSuccess: () => {
      toast.success("Leads removed from campaign");
      queryClient.invalidateQueries({ queryKey: ["marketing-leads", "marketing-campaigns"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Bulk import leads
  const bulkImportLeads = async (emails: string[], segment: string, leadScore: number) => {
    setIsImporting(true);
    try {
      const leadsToInsert = emails.map(email => ({
        email,
        segment,
        lead_score: leadScore,
        source: "bulk_paste",
        status: "active",
      }));

      let inserted = 0;
      const batchSize = 100;

      for (let i = 0; i < leadsToInsert.length; i += batchSize) {
        const batch = leadsToInsert.slice(i, i + batchSize);
        const { data: insertedData } = await supabase
          .from("marketing_leads")
          .upsert(batch, { onConflict: "email", ignoreDuplicates: true })
          .select();
        inserted += insertedData?.length || 0;
      }

      const duplicates = emails.length - inserted;
      toast.success(`Imported ${inserted} leads${duplicates > 0 ? ` (${duplicates} duplicates skipped)` : ""}`);
      setShowBulkImport(false);
      queryClient.invalidateQueries({ queryKey: ["marketing-leads"] });
    } catch (err) {
      console.error("Bulk import error:", err);
      toast.error("Failed to import leads");
    } finally {
      setIsImporting(false);
    }
  };

  // Assign bulk imported emails to campaign
  const assignEmailsToCampaign = async (emails: string[], campaignId: string) => {
    try {
      const { error } = await supabase
        .from("marketing_leads")
        .update({ campaign_id: campaignId })
        .in("email", emails);
      if (error) throw error;

      // Update campaign lead count
      const { data: count } = await supabase
        .from("marketing_leads")
        .select("id", { count: "exact" })
        .eq("campaign_id", campaignId);
      
      await supabase
        .from("marketing_campaigns")
        .update({ total_leads: count?.length || 0 })
        .eq("id", campaignId);

      queryClient.invalidateQueries({ queryKey: ["marketing-leads", "marketing-campaigns"] });
    } catch (err) {
      console.error("Campaign assignment error:", err);
    }
  };

  // Duplicate broadcast for resend
  const handleDuplicateBroadcast = (broadcast: EmailBroadcast) => {
    setEmailForm({
      subject: broadcast.subject,
      body_html: broadcast.body_html,
      body_text: broadcast.body_text || "",
    });
    if (broadcast.campaign_id) {
      setSelectedCampaignId(broadcast.campaign_id);
    }
    setShowCompose(true);
    toast.info("Broadcast content loaded. Edit and send!");
  };

  // Resend broadcast
  const handleResendBroadcast = async (broadcast: EmailBroadcast) => {
    setEmailForm({
      subject: broadcast.subject,
      body_html: broadcast.body_html,
      body_text: broadcast.body_text || "",
    });
    if (broadcast.campaign_id) {
      setSelectedCampaignId(broadcast.campaign_id);
    }
    setShowCompose(true);
  };

  // Edit draft broadcast
  const handleEditDraft = (broadcast: EmailBroadcast) => {
    setEmailForm({
      subject: broadcast.subject,
      body_html: broadcast.body_html,
      body_text: broadcast.body_text || "",
    });
    if (broadcast.campaign_id) {
      setSelectedCampaignId(broadcast.campaign_id);
    }
    setShowCompose(true);
    toast.info("Draft loaded for editing");
  };



  // CSV Upload handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet);

        const leadsToInsert = jsonData
          .filter((row) => row.email || row.Email || row.EMAIL)
          .map((row) => ({
            email: (row.email || row.Email || row.EMAIL || "").toString().toLowerCase().trim(),
            name: (row.name || row.Name || row.NAME || row["First Name"] || row["Full Name"] || null)?.toString() || null,
            company: (row.company || row.Company || row.COMPANY || row.Organization || null)?.toString() || null,
            industry: (row.industry || row.Industry || null)?.toString() || null,
            company_size: (row.company_size || row["Company Size"] || null)?.toString() || null,
            source: "csv_upload",
            segment: "new",
            lead_score: 10,
          }));

        if (leadsToInsert.length === 0) {
          toast.error("No valid emails found in file");
          return;
        }

        let inserted = 0;
        const batchSize = 100;

        for (let i = 0; i < leadsToInsert.length; i += batchSize) {
          const batch = leadsToInsert.slice(i, i + batchSize);
          const { data: insertedData } = await supabase
            .from("marketing_leads")
            .upsert(batch, { onConflict: "email", ignoreDuplicates: true })
            .select();
          inserted += insertedData?.length || 0;
        }

        const duplicates = leadsToInsert.length - inserted;
        toast.success(`Imported ${inserted} leads${duplicates > 0 ? ` (${duplicates} duplicates skipped)` : ""}`);
        queryClient.invalidateQueries({ queryKey: ["marketing-leads"] });
      } catch (err) {
        console.error("CSV parse error:", err);
        toast.error("Failed to parse file");
      }
    };
    reader.readAsBinaryString(file);
  }, [queryClient]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
  });

  // Generate AI email
  const handleGenerateEmail = async () => {
    if (!aiPrompt.topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-marketing-email", {
        body: {
          email_type: aiPrompt.email_type,
          topic: aiPrompt.topic,
          tone: aiPrompt.tone,
        },
      });

      if (error) throw error;
      if (data?.email) {
        setEmailForm({
          subject: data.email.subject || "",
          body_html: data.email.body_html || "",
          body_text: data.email.body_text || "",
        });
        toast.success("Email content generated!");
      }
    } catch (err) {
      console.error("Generate error:", err);
      toast.error("Failed to generate email");
    } finally {
      setIsGenerating(false);
    }
  };

  // Send broadcast
  const handleSendBroadcast = async (testMode = false) => {
    if (!emailForm.subject.trim() || !emailForm.body_html.trim()) {
      toast.error("Subject and body are required");
      return;
    }

    const targetEmails = selectedLeads.length > 0
      ? leads.filter((l) => selectedLeads.includes(l.id)).map((l) => l.email)
      : filteredLeads.filter((l) => l.status === "active").map((l) => l.email);

    if (!testMode && targetEmails.length === 0) {
      toast.error("No leads selected");
      return;
    }

    setIsSending(true);
    try {
      const { data: broadcast, error: broadcastError } = await supabase
        .from("email_broadcasts")
        .insert({
          subject: emailForm.subject,
          body_html: emailForm.body_html,
          body_text: emailForm.body_text || null,
          audience: selectedLeads.length > 0 ? "selected_leads" : "filtered_leads",
          audience_filter: { segment: activeSegment, campaign_id: selectedCampaignId },
          status: testMode ? "draft" : "sending",
          total_recipients: testMode ? 1 : targetEmails.length,
        })
        .select()
        .single();

      if (broadcastError) throw broadcastError;

      const { error: sendError } = await supabase.functions.invoke("send-broadcast-email", {
        body: {
          broadcast_id: broadcast.id,
          subject: emailForm.subject,
          body_html: emailForm.body_html,
          body_text: emailForm.body_text,
          audience: testMode ? "specific_emails" : (selectedLeads.length > 0 ? "specific_emails" : "all_leads"),
          specific_emails: testMode ? undefined : (selectedLeads.length > 0 ? targetEmails : undefined),
          test_mode: testMode,
        },
      });

      if (sendError) throw sendError;

      toast.success(testMode ? "Test email sent to your email" : `Broadcast sent to ${targetEmails.length} leads`);
      setShowCompose(false);
      setEmailForm({ subject: "", body_html: "", body_text: "" });
      setSelectedLeads([]);
      queryClient.invalidateQueries({ queryKey: ["email-broadcasts"] });
    } catch (err) {
      console.error("Send error:", err);
      toast.error("Failed to send broadcast");
    } finally {
      setIsSending(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map((l) => l.id));
    }
  };

  const toggleLead = (id: string) => {
    setSelectedLeads((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <AdminLayout title="Marketing Command Center" description="Manage leads, campaigns, and email outreach">
      <div className="space-y-6">
        {/* Stats Dashboard */}
        <MarketingLeadStats
          totalLeads={stats.totalLeads}
          newLeads={stats.newLeads}
          hotLeads={stats.hotLeads}
          campaignsActive={stats.activeCampaigns}
          emailsSent={stats.totalSent}
          conversionRate={stats.conversionRate}
        />

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            {campaigns.length > 0 && (
              <Select value={selectedCampaignId || "all"} onValueChange={(v) => setSelectedCampaignId(v === "all" ? null : v)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { refetchLeads(); refetchCampaigns(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => setShowBulkImport(true)}>
              <ClipboardPaste className="h-4 w-4 mr-2" />
              Paste Emails
            </Button>
            <Button variant="outline" onClick={() => setShowCreateCampaign(true)}>
              <Target className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
            <Dialog open={showCompose} onOpenChange={setShowCompose}>
              <DialogTrigger asChild>
                <Button>
                  <Send className="h-4 w-4 mr-2" />
                  Compose Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Compose Email Campaign</DialogTitle>
                  <DialogDescription>
                    {selectedLeads.length > 0
                      ? `Send to ${selectedLeads.length} selected leads`
                      : `Send to ${filteredLeads.filter((l) => l.status === "active").length} ${activeSegment !== "all" ? activeSegment : ""} leads`}
                  </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="ai" className="mt-4">
                  <TabsList className="mb-4">
                    <TabsTrigger value="ai">
                      <Sparkles className="h-4 w-4 mr-2" />
                      AI Generate
                    </TabsTrigger>
                    <TabsTrigger value="manual">
                      <Mail className="h-4 w-4 mr-2" />
                      Manual
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="ai" className="space-y-4">
                    <div className="grid gap-4">
                      <div>
                        <Label>Email Type</Label>
                        <Select
                          value={aiPrompt.email_type}
                          onValueChange={(v) => setAiPrompt((p) => ({ ...p, email_type: v as typeof aiPrompt.email_type }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="product_update">Product Update</SelectItem>
                            <SelectItem value="feature_announcement">Feature Announcement</SelectItem>
                            <SelectItem value="newsletter">Newsletter</SelectItem>
                            <SelectItem value="promotion">Promotion</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Tone</Label>
                        <Select
                          value={aiPrompt.tone}
                          onValueChange={(v) => setAiPrompt((p) => ({ ...p, tone: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                            <SelectItem value="excited">Excited</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Topic / What to announce</Label>
                        <Textarea
                          placeholder="e.g., New AI-powered collection features that help recover 30% more revenue..."
                          value={aiPrompt.topic}
                          onChange={(e) => setAiPrompt((p) => ({ ...p, topic: e.target.value }))}
                          rows={3}
                        />
                      </div>
                      <Button onClick={handleGenerateEmail} disabled={isGenerating}>
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate Email
                          </>
                        )}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="manual" className="space-y-4">
                    <p className="text-sm text-muted-foreground">Write your email manually below.</p>
                  </TabsContent>
                </Tabs>

                <div className="space-y-4 mt-4 border-t pt-4">
                  <div>
                    <Label>Subject</Label>
                    <Input
                      value={emailForm.subject}
                      onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))}
                      placeholder="Email subject line"
                    />
                  </div>
                  <div>
                    <Label>Body (HTML)</Label>
                    <Textarea
                      value={emailForm.body_html}
                      onChange={(e) => setEmailForm((f) => ({ ...f, body_html: e.target.value }))}
                      placeholder="<h1>Hello!</h1><p>Your email content here...</p>"
                      rows={10}
                      className="font-mono text-sm"
                    />
                  </div>
                  {emailForm.body_html && (
                    <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Preview Email
                    </Button>
                  )}
                </div>

                <DialogFooter className="mt-6 gap-2">
                  <Button variant="outline" onClick={() => handleSendBroadcast(true)} disabled={isSending}>
                    Send Test
                  </Button>
                  <Button onClick={() => handleSendBroadcast(false)} disabled={isSending}>
                    {isSending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Campaign
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="leads" className="space-y-4">
          <TabsList>
            <TabsTrigger value="leads">
              <Users className="h-4 w-4 mr-2" />
              Leads ({leads.length})
            </TabsTrigger>
            <TabsTrigger value="campaigns">
              <Target className="h-4 w-4 mr-2" />
              Campaigns ({campaigns.length})
            </TabsTrigger>
            <TabsTrigger value="broadcasts">
              <Mail className="h-4 w-4 mr-2" />
              Broadcasts ({broadcasts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="space-y-4">
            {/* Segment Filter */}
            <LeadSegmentFilter
              activeSegment={activeSegment}
              onSegmentChange={setActiveSegment}
              counts={segmentCounts}
            />

            {/* Upload and Add buttons */}
            <div className="flex gap-4 flex-wrap">
              <Card className="flex-1 min-w-[250px]">
                <CardContent className="pt-6">
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Drop CSV/Excel file here</p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="flex-1 min-w-[250px]">
                <CardContent className="pt-6">
                  <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
                    <DialogTrigger asChild>
                      <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
                        <UserPlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm font-medium">Add Lead Manually</p>
                        <p className="text-xs text-muted-foreground mt-1">Enter email and details</p>
                      </div>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Lead</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div>
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            value={newLead.email}
                            onChange={(e) => setNewLead((l) => ({ ...l, email: e.target.value }))}
                            placeholder="lead@example.com"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Name</Label>
                            <Input
                              value={newLead.name}
                              onChange={(e) => setNewLead((l) => ({ ...l, name: e.target.value }))}
                              placeholder="John Doe"
                            />
                          </div>
                          <div>
                            <Label>Company</Label>
                            <Input
                              value={newLead.company}
                              onChange={(e) => setNewLead((l) => ({ ...l, company: e.target.value }))}
                              placeholder="Acme Corp"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Industry</Label>
                            <Select
                              value={newLead.industry}
                              onValueChange={(v) => setNewLead((l) => ({ ...l, industry: v }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="saas">SaaS</SelectItem>
                                <SelectItem value="fintech">FinTech</SelectItem>
                                <SelectItem value="healthcare">Healthcare</SelectItem>
                                <SelectItem value="ecommerce">E-commerce</SelectItem>
                                <SelectItem value="professional_services">Professional Services</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Company Size</Label>
                            <Select
                              value={newLead.company_size}
                              onValueChange={(v) => setNewLead((l) => ({ ...l, company_size: v }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1-10">1-10</SelectItem>
                                <SelectItem value="11-50">11-50</SelectItem>
                                <SelectItem value="51-200">51-200</SelectItem>
                                <SelectItem value="201-500">201-500</SelectItem>
                                <SelectItem value="500+">500+</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label>Source</Label>
                          <Select
                            value={newLead.source}
                            onValueChange={(v) => setNewLead((l) => ({ ...l, source: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">Manual Entry</SelectItem>
                              <SelectItem value="website">Website</SelectItem>
                              <SelectItem value="referral">Referral</SelectItem>
                              <SelectItem value="linkedin">LinkedIn</SelectItem>
                              <SelectItem value="event">Event</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter className="mt-6">
                        <Button
                          onClick={() => addLeadMutation.mutate(newLead)}
                          disabled={!newLead.email || addLeadMutation.isPending}
                        >
                          {addLeadMutation.isPending ? "Adding..." : "Add Lead"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </div>

            {/* Leads table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Marketing Leads</CardTitle>
                  <CardDescription>
                    {selectedLeads.length > 0 
                      ? `${selectedLeads.length} selected${activeSelectedLeads.length < selectedLeads.length ? ` (${selectedLeads.length - activeSelectedLeads.length} unsubscribed)` : ""}`
                      : `${filteredLeads.length} leads shown`}
                    {segmentCounts.unsubscribed > 0 && selectedLeads.length === 0 && (
                      <span className="text-amber-600 ml-2">• {segmentCounts.unsubscribed} unsubscribed</span>
                    )}
                  </CardDescription>
                </div>
                {selectedLeads.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setShowSendEmail(true)}
                      disabled={activeSelectedLeads.length === 0}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Send Email ({activeSelectedLeads.length})
                    </Button>
                    {campaigns.filter(c => c.status !== "completed").length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAssignToCampaign(true)}
                      >
                        <Target className="h-4 w-4 mr-1" />
                        Assign to Campaign
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteLeadsMutation.mutate(selectedLeads)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No leads found. Upload a CSV or add manually.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Lead</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Added</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeads.slice(0, 100).map((lead) => {
                        const isUnsubscribed = lead.status === "unsubscribed";
                        return (
                          <TableRow 
                            key={lead.id} 
                            className={`cursor-pointer hover:bg-muted/50 ${isUnsubscribed ? "opacity-60 bg-muted/30" : ""}`}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedLeads.includes(lead.id)}
                                onCheckedChange={() => toggleLead(lead.id)}
                                disabled={isUnsubscribed}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div>
                                  <p className="font-medium">{lead.name || lead.email}</p>
                                  {lead.name && <p className="text-xs text-muted-foreground">{lead.email}</p>}
                                </div>
                                {isUnsubscribed && (
                                  <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                    <BellOff className="h-3 w-3 mr-1" />
                                    Unsubscribed
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{lead.company || "-"}</p>
                                {lead.industry && (
                                  <p className="text-xs text-muted-foreground capitalize">{lead.industry}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <LeadScoreBadge score={lead.lead_score || 0} size="sm" />
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {lead.lifecycle_stage || "lead"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{lead.source || "unknown"}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {format(new Date(lead.created_at), "MMM d, yyyy")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
                {filteredLeads.length > 100 && (
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Showing first 100 of {filteredLeads.length} leads
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6">
            {/* Pricing Tier Campaigns */}
            <PricingTierCampaigns
              existingCampaigns={campaigns.map(c => ({ id: c.id, name: c.name }))}
              onCreateCampaign={(campaign) => {
                createCampaignMutation.mutate({
                  name: campaign.name,
                  description: campaign.description,
                  campaign_type: campaign.campaign_type,
                  target_segment: campaign.target_segment,
                  target_industry: "all",
                  target_company_size: "all",
                  min_lead_score: 0,
                });
              }}
              isCreating={createCampaignMutation.isPending}
              leadsCountByTier={leadsCountByTier}
            />

            {/* Other Campaigns */}
            {campaignsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Campaigns Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create pricing tier campaigns above to start engaging leads
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">All Campaigns</h3>
                  <Button variant="outline" size="sm" onClick={() => setShowCreateCampaign(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Custom Campaign
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {campaigns.map((campaign) => (
                    <MarketingCampaignCard
                      key={campaign.id}
                      campaign={campaign}
                      onToggleStatus={(id, status) => updateCampaignStatus.mutate({ id, status })}
                      onViewDetails={(c) => {
                        const fullCampaign = campaigns.find(camp => camp.id === c.id);
                        if (fullCampaign) setShowCampaignDetails(fullCampaign);
                      }}
                      onDelete={(id) => setShowDeleteCampaign(id)}
                      onDuplicate={(c) => {
                        setShowCreateCampaign(true);
                        toast.info("Edit campaign details to duplicate");
                      }}
                      onSendToLeads={(c) => {
                        setSelectedCampaignId(c.id);
                        setShowCompose(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="broadcasts" className="space-y-4">
            <BroadcastActionsCard
              broadcasts={broadcasts}
              campaigns={campaigns.map(c => ({ id: c.id, name: c.name }))}
              isLoading={broadcastsLoading}
              onDelete={(ids) => deleteBroadcastsMutation.mutate(ids)}
              onResend={handleResendBroadcast}
              onDuplicate={handleDuplicateBroadcast}
              onEdit={handleEditDraft}
              isDeleting={deleteBroadcastsMutation.isPending}
            />
          </TabsContent>
        </Tabs>

        {/* Email Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Email Preview</DialogTitle>
              <DialogDescription>Subject: {emailForm.subject}</DialogDescription>
            </DialogHeader>
            <div
              className="mt-4 p-4 border rounded-lg bg-white"
              dangerouslySetInnerHTML={{ __html: emailForm.body_html }}
            />
          </DialogContent>
        </Dialog>

        {/* Bulk Import Modal */}
        <BulkEmailImportModal
          open={showBulkImport}
          onOpenChange={setShowBulkImport}
          onImport={bulkImportLeads}
          isImporting={isImporting}
          campaigns={campaigns.filter(c => c.status !== "completed").map(c => ({ id: c.id, name: c.name }))}
          onAssignToCampaign={assignEmailsToCampaign}
        />

        {/* Delete Campaign Confirmation */}
        <AlertDialog open={!!showDeleteCampaign} onOpenChange={() => setShowDeleteCampaign(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this campaign. Leads assigned to this campaign will be unassigned but not deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => showDeleteCampaign && deleteCampaignMutation.mutate(showDeleteCampaign)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Create Campaign Modal */}
        <CreateCampaignModal
          open={showCreateCampaign}
          onOpenChange={setShowCreateCampaign}
          onCreateCampaign={(data) => createCampaignMutation.mutate(data)}
          isCreating={createCampaignMutation.isPending}
        />

        {/* Campaign Details Modal */}
        <CampaignDetailsModal
          open={!!showCampaignDetails}
          onOpenChange={(open) => !open && setShowCampaignDetails(null)}
          campaign={showCampaignDetails}
          leads={campaignLeads}
          activities={campaignActivities}
          isLoadingLeads={leadsLoading}
          isLoadingActivities={activitiesLoading}
          onRemoveLeads={(leadIds) => removeLeadsFromCampaign.mutate(leadIds)}
          onSendOutreach={(leadIds) => {
            setSelectedLeads(leadIds);
            setShowSendEmail(true);
          }}
          isRemovingLeads={removeLeadsFromCampaign.isPending}
        />

        {/* Send Email Modal */}
        <SendEmailModal
          open={showSendEmail}
          onOpenChange={setShowSendEmail}
          selectedLeads={leads.filter(l => selectedLeads.includes(l.id))}
          campaigns={campaigns.map(c => ({ id: c.id, name: c.name }))}
          defaultCampaignId={showCampaignDetails?.id || selectedCampaignId}
          onSuccess={() => {
            setSelectedLeads([]);
            queryClient.invalidateQueries({ queryKey: ["email-broadcasts", "marketing-leads", "marketing-campaigns"] });
          }}
        />

        {/* Assign Leads to Campaign Modal */}
        <AssignLeadsToCampaignModal
          open={showAssignToCampaign}
          onOpenChange={setShowAssignToCampaign}
          campaigns={campaigns.filter(c => c.status !== "completed").map(c => ({
            id: c.id,
            name: c.name,
            total_leads: c.total_leads,
            status: c.status,
          }))}
          selectedLeadsCount={selectedLeads.length}
          onAssign={(campaignId) => {
            assignLeadsToCampaign.mutate(
              { leadIds: selectedLeads, campaignId },
              {
                onSuccess: () => {
                  setShowAssignToCampaign(false);
                },
              }
            );
          }}
          isAssigning={assignLeadsToCampaign.isPending}
        />
      </div>
    </AdminLayout>
  );
}
