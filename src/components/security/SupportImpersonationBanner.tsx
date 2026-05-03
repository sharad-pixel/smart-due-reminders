import { useEffect, useState } from "react";
import { LogOut, ShieldAlert, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getImpersonatedAccountId, setImpersonatedAccountId } from "@/lib/supportImpersonation";
import { supabase } from "@/integrations/supabase/client";

interface AccountInfo {
  email: string | null;
  business_name: string | null;
  company_name: string | null;
}

interface GrantInfo {
  expires_at: string;
  reason: string | null;
}

function formatRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}d ${rh}h left`;
  }
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export const SupportImpersonationBanner = () => {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [grant, setGrant] = useState<GrantInfo | null>(null);
  const [tick, setTick] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const sync = () => setAccountId(getImpersonatedAccountId());
    sync();
    window.addEventListener("support-impersonation-change", sync);
    return () => window.removeEventListener("support-impersonation-change", sync);
  }, []);

  // Re-render every minute for countdown
  useEffect(() => {
    if (!accountId) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [accountId]);

  useEffect(() => {
    if (!accountId) {
      setInfo(null);
      setGrant(null);
      return;
    }
    (async () => {
      // Owner profile (admin-safe view)
      const { data: profile } = await supabase
        .from("profiles_admin_safe")
        .select("email, business_name, company_name")
        .eq("id", accountId)
        .maybeSingle();
      setInfo(profile as AccountInfo | null);

      // Active grant for this account
      const { data: grantRow } = await supabase
        .from("support_access_grants")
        .select("expires_at, reason")
        .eq("account_id", accountId)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setGrant(grantRow as GrantInfo | null);
    })();
  }, [accountId]);

  if (!accountId) return null;
  const label = info?.business_name || info?.company_name || info?.email || accountId.slice(0, 8);
  const remaining = grant ? formatRemaining(grant.expires_at) : null;
  void tick; // re-render trigger

  const exit = () => {
    setImpersonatedAccountId(null);
    navigate("/admin/support-access");
  };

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 text-sm flex flex-wrap items-center justify-center gap-x-3 gap-y-1 shadow-sm font-medium">
      <ShieldAlert className="h-4 w-4 flex-shrink-0" />
      <span>
        Support Mode — viewing <strong>{label}</strong>'s workspace as Recouply Support
      </span>
      {remaining && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-700/40 px-2 py-0.5 text-xs">
          <Clock className="h-3 w-3" />
          Access {remaining}
        </span>
      )}
      <Button
        size="sm"
        variant="outline"
        className="h-7 bg-white/90 hover:bg-white border-amber-700 text-amber-950"
        onClick={exit}
      >
        <LogOut className="h-3 w-3 mr-1" /> Exit Support Mode
      </Button>
    </div>
  );
};
