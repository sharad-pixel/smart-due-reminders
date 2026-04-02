import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Undo2, FileText, Upload, Link2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface OverrideLog {
  id: string;
  field_name: string;
  original_value: string | null;
  new_value: string | null;
  created_at: string;
}

interface IntegrationSourceBannerProps {
  integrationSource: string | null;
  integrationUrl: string | null;
  hasLocalOverrides: boolean;
  overrideCount: number;
  lastSyncedAt: string | null;
  invoiceId: string;
  onSync?: () => void;
  onDiscardOverrides?: () => void;
}

export const IntegrationSourceBanner = ({
  integrationSource,
  integrationUrl,
  hasLocalOverrides,
  overrideCount,
  lastSyncedAt,
  invoiceId,
  onSync,
  onDiscardOverrides,
}: IntegrationSourceBannerProps) => {
  const [discarding, setDiscarding] = useState(false);
  const [overrideLogs, setOverrideLogs] = useState<OverrideLog[]>([]);
  const [showOverrides, setShowOverrides] = useState(false);

  const handleDiscardOverrides = async () => {
    setDiscarding(true);
    try {
      // Reset to original values
      const { error } = await supabase
        .from("invoices")
        .update({
          has_local_overrides: false,
          override_count: 0,
        })
        .eq("id", invoiceId);

      if (error) throw error;
      toast.success("Local overrides discarded. Next sync will restore original values.");
      onDiscardOverrides?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to discard overrides");
    } finally {
      setDiscarding(false);
    }
  };

  const fetchOverrideLogs = async () => {
    const { data } = await supabase
      .from("invoice_override_log")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false })
      .limit(5);
    
    setOverrideLogs(data || []);
    setShowOverrides(!showOverrides);
  };

  const source = integrationSource || "recouply_manual";

  // Recouply Manual Invoice
  if (source === "recouply_manual") {
    return (
      <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800">
        <FileText className="h-4 w-4 text-green-600" />
        <AlertDescription className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="font-medium text-green-800 dark:text-green-200">
              📝 Recouply Invoice
            </span>
            <span className="text-green-700 dark:text-green-300">
              — Full editing enabled
            </span>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // CSV Import
  if (source === "csv_upload") {
    return (
      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
        <Upload className="h-4 w-4 text-blue-600" />
        <AlertDescription className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="font-medium text-blue-800 dark:text-blue-200">
              📊 CSV Imported Invoice
            </span>
            <span className="text-blue-700 dark:text-blue-300">
              — Editable, changes won't sync to source file
            </span>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Stripe - No Local Overrides
  if (source === "stripe" && !hasLocalOverrides) {
    return (
      <Alert className="bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800">
        <Link2 className="h-4 w-4 text-orange-600" />
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="font-medium text-orange-800 dark:text-orange-200">
              🔗 Stripe Integrated Invoice
            </span>
            <span className="text-orange-700 dark:text-orange-300">
              — Syncs from Stripe
            </span>
            {lastSyncedAt && (
              <span className="text-xs text-orange-600 dark:text-orange-400">
                Last synced: {format(new Date(lastSyncedAt), "MMM d, h:mm a")}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {integrationUrl && (
              <Button
                variant="outline"
                size="sm"
                className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300"
                onClick={() => window.open(integrationUrl, "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View in Stripe
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Stripe - With Local Overrides
  if (source === "stripe" && hasLocalOverrides) {
    return (
      <div className="space-y-2">
        <Alert className="bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex flex-col gap-3 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="font-medium text-amber-800 dark:text-amber-200">
                  ⚠️ Stripe Invoice (Modified Locally)
                </span>
                <Badge variant="outline" className="border-amber-400 text-amber-700 w-fit">
                  {overrideCount} field{overrideCount !== 1 ? "s" : ""} modified
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {integrationUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300"
                    onClick={() => window.open(integrationUrl, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View in Stripe
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-600 dark:text-red-300"
                  onClick={handleDiscardOverrides}
                  disabled={discarding}
                >
                  <Undo2 className="h-3 w-3 mr-1" />
                  {discarding ? "Discarding..." : "Discard Overrides"}
                </Button>
              </div>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Next sync will overwrite your local changes with Stripe data.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-amber-700 hover:bg-amber-100 w-fit p-0 h-auto"
              onClick={fetchOverrideLogs}
            >
              {showOverrides ? "Hide modified fields" : "Show modified fields"}
            </Button>
          </AlertDescription>
        </Alert>
        
        {showOverrides && overrideLogs.length > 0 && (
          <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-md p-3 border border-amber-200 dark:border-amber-800">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">Recent Modifications:</p>
            <div className="space-y-1">
              {overrideLogs.map((log) => (
                <div key={log.id} className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <span className="font-medium">{log.field_name}:</span>
                  <span className="line-through text-amber-500">{log.original_value || "—"}</span>
                  <span>→</span>
                  <span>{log.new_value || "—"}</span>
                  <span className="text-amber-500 ml-auto">
                    {format(new Date(log.created_at), "MMM d")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // QuickBooks / Xero (future)
  if (source === "quickbooks" || source === "xero") {
    return (
      <Alert className="bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800">
        <Link2 className="h-4 w-4 text-purple-600" />
        <AlertDescription className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="font-medium text-purple-800 dark:text-purple-200">
              🔗 {source === "quickbooks" ? "QuickBooks" : "Xero"} Integrated Invoice
            </span>
            <span className="text-purple-700 dark:text-purple-300">
              — Syncs from {source === "quickbooks" ? "QuickBooks" : "Xero"}
            </span>
          </div>
          <div className="flex gap-2">
            {integrationUrl && (
              <Button
                variant="outline"
                size="sm"
                className="border-purple-300 text-purple-700 hover:bg-purple-100"
                onClick={() => window.open(integrationUrl, "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View in {source === "quickbooks" ? "QuickBooks" : "Xero"}
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // AI Smart Ingestion (Google Drive)
  if (source === "google_drive" || source === "ai_ingestion") {
    return (
      <Alert className="bg-cyan-50 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-800">
        <FileText className="h-4 w-4 text-cyan-600" />
        <AlertDescription className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="font-medium text-cyan-800 dark:text-cyan-200">
              🤖 Smart Ingestion Invoice
            </span>
            <span className="text-cyan-700 dark:text-cyan-300">
              — Extracted from Google Drive PDF
            </span>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

// Badge component for Invoice List
export const IntegrationSourceBadge = ({ 
  source, 
  hasOverrides = false,
  size = "sm" 
}: { 
  source: string | null; 
  hasOverrides?: boolean;
  size?: "sm" | "xs";
}) => {
  const sourceValue = source || "recouply_manual";
  
  const sizeClasses = size === "xs" 
    ? "text-[10px] px-1.5 py-0.5 gap-1" 
    : "text-xs px-2.5 py-1 gap-1.5";

  const iconSize = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";

  const configs: Record<string, { label: string; icon: React.ReactNode; classes: string }> = {
    recouply_manual: {
      label: "Manual",
      icon: <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>,
      classes: "bg-emerald-50 border-emerald-200/80 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800/60 dark:text-emerald-300",
    },
    csv_upload: {
      label: "CSV Import",
      icon: <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 12l-2 4h4l-2 4"/></svg>,
      classes: "bg-blue-50 border-blue-200/80 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800/60 dark:text-blue-300",
    },
    stripe: {
      label: hasOverrides ? "Stripe ⚡" : "Stripe",
      icon: <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>,
      classes: hasOverrides 
        ? "bg-amber-50 border-amber-300/80 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700/60 dark:text-amber-300" 
        : "bg-violet-50 border-violet-200/80 text-violet-700 dark:bg-violet-950/30 dark:border-violet-800/60 dark:text-violet-300",
    },
    quickbooks: {
      label: "QuickBooks",
      icon: <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="12" fill="#2CA01C"/><path d="M7.5 7a3 3 0 0 0-3 3v4a3 3 0 0 0 3 3h1v-1.5h-1a1.5 1.5 0 0 1-1.5-1.5v-4A1.5 1.5 0 0 1 7.5 8.5H9V15a2 2 0 0 0 4 0V7H7.5zm9 10a3 3 0 0 0 3-3v-4a3 3 0 0 0-3-3h-1v1.5h1a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H15V9a2 2 0 0 0-4 0v8h5.5z" fill="white"/></svg>,
      classes: "bg-green-50 border-green-200/80 text-green-700 dark:bg-green-950/30 dark:border-green-800/60 dark:text-green-300",
    },
    xero: {
      label: "Xero",
      icon: <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="12" fill="#13B5EA"/><path d="M7.5 8.5l4 3.5-4 3.5M12.5 8.5l4 3.5-4 3.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      classes: "bg-sky-50 border-sky-200/80 text-sky-700 dark:bg-sky-950/30 dark:border-sky-800/60 dark:text-sky-300",
    },
    ai_ingestion: {
      label: "AI Scan",
      icon: <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>,
      classes: "bg-cyan-50 border-cyan-200/80 text-cyan-700 dark:bg-cyan-950/30 dark:border-cyan-800/60 dark:text-cyan-300",
    },
    netsuite: {
      label: "NetSuite",
      icon: <svg className={iconSize} viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#1A1A2E"/><path d="M6 7h2.5l3.5 6V7h2.5v10h-2.5l-3.5-6v6H6V7z" fill="#00A1E0"/></svg>,
      classes: "bg-indigo-50 border-indigo-200/80 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-800/60 dark:text-indigo-300",
    },
    sage: {
      label: "Sage",
      icon: <svg className={iconSize} viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="4" fill="#00DC00"/><path d="M8 15c0-.8.6-1.3 1.5-1.6 1-.4 2.2-.5 3-1.2.4-.3.6-.8.6-1.3 0-1-.8-1.7-1.9-1.7-1.2 0-2 .8-2.1 1.9H7.4c.2-2 1.6-3.4 3.8-3.4 2.1 0 3.6 1.3 3.6 3 0 1.1-.5 1.9-1.4 2.5-.8.5-1.8.7-2.6 1-.4.2-.7.4-.7.8v.2h4.6V17H8v-2z" fill="white"/></svg>,
      classes: "bg-lime-50 border-lime-200/80 text-lime-700 dark:bg-lime-950/30 dark:border-lime-800/60 dark:text-lime-300",
    },
  };

  // Map google_drive to ai_ingestion
  const key = sourceValue === "google_drive" ? "ai_ingestion" : sourceValue;
  const config = configs[key];
  if (!config) return null;

  return (
    <Badge 
      variant="outline" 
      className={`inline-flex items-center font-medium ${config.classes} ${sizeClasses}`}
    >
      {config.icon}
      {config.label}
    </Badge>
  );
};

export default IntegrationSourceBanner;
