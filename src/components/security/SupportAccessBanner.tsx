import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LifeBuoy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Grant {
  id: string;
  expires_at: string;
  scope: string;
}

export const SupportAccessBanner = () => {
  const [grant, setGrant] = useState<Grant | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: membership } = await supabase
        .from("account_users")
        .select("account_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("is_owner", { ascending: false })
        .limit(1)
        .maybeSingle();
      const accountId = membership?.account_id || user.id;
      const { data } = await supabase
        .from("support_access_grants")
        .select("id, expires_at, scope")
        .eq("account_id", accountId)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (mounted) setGrant(data as Grant | null);
    };
    check();
    const id = setInterval(check, 60000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  if (!grant) return null;

  return (
    <div className="bg-primary text-primary-foreground px-4 py-2 text-sm flex items-center justify-center gap-3 shadow-sm">
      <LifeBuoy className="h-4 w-4 flex-shrink-0" />
      <span>
        Recouply Support has <strong>{grant.scope === "write" ? "full" : "view-only"}</strong> access to your workspace —
        expires {formatDistanceToNow(new Date(grant.expires_at), { addSuffix: true })}.
      </span>
      <Button
        variant="secondary"
        size="sm"
        className="h-7"
        onClick={() => navigate("/team")}
      >
        Manage
      </Button>
    </div>
  );
};
