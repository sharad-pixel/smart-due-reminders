import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { UserCog, Send, BellRing, BellOff } from "lucide-react";

interface InternalAccountOwnerBadgeProps {
  debtorId: string;
  salesRepName: string | null;
  salesRepEmail: string | null;
  alertsEnabled: boolean;
}

/**
 * Compact header badge for the assigned Internal Account Owner (sales rep).
 * Shows on the Debtor dashboard so reps are visible at a glance, with a
 * one-click "Send Account Health Score Card" action.
 */
export const InternalAccountOwnerBadge = ({
  debtorId,
  salesRepName,
  salesRepEmail,
  alertsEnabled,
}: InternalAccountOwnerBadgeProps) => {
  const [sending, setSending] = useState(false);

  if (!salesRepEmail && !salesRepName) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 text-muted-foreground border-dashed">
              <UserCog className="h-3 w-3" />
              No Account Owner
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            Assign an internal owner below to enable rep alerts.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  async function handleSend() {
    if (!salesRepEmail) {
      toast.error("This rep has no email on file");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-rep-weekly-summary",
        { body: { debtorId } }
      );
      if (error) throw error;
      if ((data as any)?.errors?.length) {
        throw new Error((data as any).errors.join("; "));
      }
      toast.success(`Health score card sent to ${salesRepEmail}`);
    } catch (err: any) {
      console.error("Failed to send health score card", err);
      toast.error(err.message || "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1">
        <UserCog className="h-4 w-4 text-primary shrink-0" />
        <div className="flex flex-col leading-tight">
          <span className="text-xs text-muted-foreground">Account Owner</span>
          <span className="text-sm font-medium">
            {salesRepName || salesRepEmail}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              {alertsEnabled ? (
                <Badge variant="secondary" className="gap-1 ml-1">
                  <BellRing className="h-3 w-3" />
                  Weekly
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 ml-1 text-muted-foreground">
                  <BellOff className="h-3 w-3" />
                  Off
                </Badge>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {alertsEnabled
              ? "Weekly summary emails are enabled"
              : "Weekly summary emails are disabled"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSend}
              disabled={sending || !salesRepEmail}
              className="ml-1 h-8"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {sending ? "Sending…" : "Send Health Score"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Email the current Account Health Score Card to {salesRepEmail || "this rep"}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
