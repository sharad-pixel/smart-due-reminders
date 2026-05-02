import { useEffect, useState } from "react";
import { LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getImpersonatedAccountId, setImpersonatedAccountId } from "@/lib/supportImpersonation";
import { supabase } from "@/integrations/supabase/client";

interface AccountInfo {
  email: string | null;
  business_name: string | null;
  company_name: string | null;
}

export const SupportImpersonationBanner = () => {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const sync = () => setAccountId(getImpersonatedAccountId());
    sync();
    window.addEventListener("support-impersonation-change", sync);
    return () => window.removeEventListener("support-impersonation-change", sync);
  }, []);

  useEffect(() => {
    if (!accountId) { setInfo(null); return; }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("email, business_name, company_name")
        .eq("id", accountId)
        .maybeSingle();
      setInfo(data as AccountInfo | null);
    })();
  }, [accountId]);

  if (!accountId) return null;
  const label = info?.business_name || info?.company_name || info?.email || accountId.slice(0, 8);

  const exit = () => {
    setImpersonatedAccountId(null);
    navigate("/admin/support-access");
  };

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 text-sm flex items-center justify-center gap-3 shadow-sm font-medium">
      <ShieldAlert className="h-4 w-4 flex-shrink-0" />
      <span>
        Support Mode — viewing <strong>{label}</strong>'s workspace as Recouply Support
      </span>
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
