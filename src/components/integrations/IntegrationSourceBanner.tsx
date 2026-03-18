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
  
  const sizeClasses = size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";

  if (sourceValue === "recouply_manual") {
    return (
      <Badge 
        variant="outline" 
        className={`bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300 ${sizeClasses}`}
      >
        📝 Recouply
      </Badge>
    );
  }

  if (sourceValue === "csv_upload") {
    return (
      <Badge 
        variant="outline" 
        className={`bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300 ${sizeClasses}`}
      >
        📊 CSV
      </Badge>
    );
  }

  if (sourceValue === "stripe") {
    return (
      <Badge 
        variant="outline" 
        className={`${hasOverrides 
          ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300" 
          : "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-300"
        } ${sizeClasses}`}
      >
        {hasOverrides ? "⚠️" : "🔗"} Stripe
      </Badge>
    );
  }

  if (sourceValue === "quickbooks") {
    return (
      <Badge 
        variant="outline" 
        className={`bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-300 ${sizeClasses}`}
      >
        🔗 QuickBooks
      </Badge>
    );
  }

  if (sourceValue === "xero") {
    return (
      <Badge 
        variant="outline" 
        className={`bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-950/30 dark:border-teal-800 dark:text-teal-300 ${sizeClasses}`}
      >
        🔗 Xero
      </Badge>
    );
  }

  return null;
};

export default IntegrationSourceBanner;
