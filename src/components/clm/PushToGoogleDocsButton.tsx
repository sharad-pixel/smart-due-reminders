import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileUp, ExternalLink, Loader2, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";

export const PushToGoogleDocsButton = ({
  instanceId,
  gdocUrl,
  gdocSyncedAt,
}: {
  instanceId: string;
  gdocUrl?: string | null;
  gdocSyncedAt?: string | null;
}) => {
  const [pushing, setPushing] = useState(false);
  const qc = useQueryClient();

  const startReconsent = async () => {
    const { data, error } = await supabase.functions.invoke("google-drive-auth", {
      body: { origin: window.location.origin, include_docs_scope: true },
    });
    if (error || !data?.authUrl) {
      toast.error(error?.message || "Could not start Google sign-in");
      return;
    }
    window.location.href = data.authUrl;
  };

  const push = async () => {
    setPushing(true);
    try {
      const { data, error } = await supabase.functions.invoke("clm-push-to-gdocs", {
        body: { instanceId },
      });
      if (error) throw error;
      if (data?.needs_connection) {
        toast.message("Connect Google Drive first", {
          description: "Open Data Center → Google Drive to connect.",
        });
        return;
      }
      if (data?.needs_reconsent) {
        toast.message("Google Docs access needed", {
          description: "Reconnecting Google to grant the documents scope…",
          action: { label: "Reconnect", onClick: () => startReconsent() },
        });
        return;
      }
      if (data?.success) {
        toast.success("Pushed to Google Docs", {
          description: "Your contract is synced.",
          action: { label: "Open", onClick: () => window.open(data.url, "_blank") },
        });
        qc.invalidateQueries({ queryKey: ["clm-instance", instanceId] });
      }
    } catch (e: any) {
      toast.error(e?.message || "Push to Google Docs failed");
    } finally {
      setPushing(false);
    }
  };

  if (!gdocUrl) {
    return (
      <Button size="sm" variant="outline" onClick={push} disabled={pushing}>
        {pushing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5 mr-1.5" />}
        Push to Google Docs
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={pushing}>
          {pushing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5 mr-1.5" />}
          Google Docs
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">
          {gdocSyncedAt
            ? `Synced ${formatDistanceToNow(new Date(gdocSyncedAt), { addSuffix: true })}`
            : "Linked"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => window.open(gdocUrl!, "_blank")}>
          <ExternalLink className="h-3.5 w-3.5 mr-2" /> Open in Google Docs
        </DropdownMenuItem>
        <DropdownMenuItem onClick={push}>
          <RefreshCcw className="h-3.5 w-3.5 mr-2" /> Re-sync latest content
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
