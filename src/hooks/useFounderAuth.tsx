import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const FOUNDER_EMAIL = "sharad@recouply.ai";

export const useFounderAuth = () => {
  const [isFounder, setIsFounder] = useState(false);
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

      // Strict check: only founder email has access
      if (user.email?.toLowerCase() !== FOUNDER_EMAIL.toLowerCase()) {
        console.warn("Unauthorized admin access attempt:", user.email);
        navigate("/dashboard");
        return;
      }

      // Verify is_admin flag in database as secondary check
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, name, is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        console.warn("Admin flag not set for founder");
        navigate("/dashboard");
        return;
      }

      setFounderProfile({
        id: profile.id,
        email: profile.email,
        name: profile.name,
      });
      setIsFounder(true);
    } catch (error) {
      console.error("Error checking founder access:", error);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return { isFounder, loading, founderProfile, refetch: checkFounderAccess };
};
