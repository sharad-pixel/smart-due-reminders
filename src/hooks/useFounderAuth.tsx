import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const FOUNDER_EMAIL = "sharad@recouply.ai";

export const useFounderAuth = () => {
  const [isFounder, setIsFounder] = useState(false);
  const [isSupportUser, setIsSupportUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [founderProfile, setFounderProfile] = useState<{
    id: string;
    email: string;
    name: string | null;
  } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkFounderAccess();
  }, []);

  const checkFounderAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, name, is_admin, is_support_user")
        .eq("id", user.id)
        .single();

      const isFounderEmail = user.email?.toLowerCase() === FOUNDER_EMAIL.toLowerCase();
      const { data: activeSupportUser } = await (supabase as any).rpc("is_active_support_user", { p_user_id: user.id });

      if ((!isFounderEmail || !profile?.is_admin) && !activeSupportUser) {
        console.warn("Unauthorized admin/support access attempt:", user.email);
        navigate("/dashboard");
        return;
      }

      setFounderProfile({
        id: profile.id,
        email: profile.email,
        name: profile.name,
      });
      setIsFounder(isFounderEmail && !!profile?.is_admin);
      setIsSupportUser(!!activeSupportUser || !!profile?.is_support_user);
    } catch (error) {
      console.error("Error checking founder access:", error);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return { isFounder, isSupportUser, loading, founderProfile, refetch: checkFounderAccess };
};
