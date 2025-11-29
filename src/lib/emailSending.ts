import { supabase } from "@/integrations/supabase/client";

export interface SendingIdentity {
  senderName: string;
  senderEmail: string;
  domain: string;
  isVerified: boolean;
  useRecouplyDomain: boolean;
  replyToEmail?: string;
}

/**
 * Get the active sending identity for the current user's workspace
 * Falls back to Recouply.ai default domain if no custom domain is verified
 */
export async function getActiveSendingIdentity(): Promise<SendingIdentity> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Try to get verified custom domain
    const { data: profile, error } = await supabase
      .from("email_sending_profiles")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Error fetching email profile:", error);
    }

    // Get inbound email for reply-to
    const { data: inboundAccount } = await supabase
      .from("email_accounts")
      .select("email_address")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .eq("email_type", "inbound")
      .maybeSingle();

    const replyToEmail = inboundAccount?.email_address;

    // If custom domain exists and is verified, use it
    if (profile && !profile.use_recouply_domain && profile.verification_status === "verified") {
      return {
        senderName: profile.sender_name,
        senderEmail: profile.sender_email,
        domain: profile.domain,
        isVerified: true,
        useRecouplyDomain: false,
        replyToEmail,
      };
    }

    // If user explicitly chose Recouply domain, use it
    if (profile && profile.use_recouply_domain) {
      return {
        senderName: profile.sender_name,
        senderEmail: profile.sender_email,
        domain: profile.domain,
        isVerified: true,
        useRecouplyDomain: true,
        replyToEmail,
      };
    }

    // Fallback to Recouply.ai default domain
    return {
      senderName: "Recouply Collections",
      senderEmail: `workspace-${user.id.substring(0, 8)}@send.recouply.ai`,
      domain: "send.recouply.ai",
      isVerified: true,
      useRecouplyDomain: true,
      replyToEmail,
    };
  } catch (error) {
    console.error("Error getting sending identity:", error);
    
    // Safe fallback
    return {
      senderName: "Recouply Collections",
      senderEmail: "notifications@recouply.ai",
      domain: "recouply.ai",
      isVerified: true,
      useRecouplyDomain: true,
    };
  }
}

/**
 * Check if user has a verified custom domain
 */
export async function hasVerifiedCustomDomain(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from("email_sending_profiles")
      .select("verification_status, use_recouply_domain")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    return profile && !profile.use_recouply_domain && profile.verification_status === "verified";
  } catch (error) {
    console.error("Error checking custom domain:", error);
    return false;
  }
}
