import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { profileId } = await req.json();

    if (!profileId) {
      throw new Error("Profile ID is required");
    }

    // Fetch the email profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("email_sending_profiles")
      .select("*")
      .eq("id", profileId)
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    console.log(`Verifying DNS records for domain: ${profile.domain}`);

    // In production, you would use DNS lookup services or APIs here
    // For now, we'll simulate verification with a delay and mock results
    const verificationResults = {
      spf: await verifySpfRecord(profile.domain),
      dkim: await verifyDkimRecord(profile.domain),
      dmarc: await verifyDmarcRecord(profile.domain),
    };

    console.log("Verification results:", verificationResults);

    // Update the profile with verification results
    const { error: updateError } = await supabaseClient
      .from("email_sending_profiles")
      .update({
        spf_validated: verificationResults.spf,
        dkim_validated: verificationResults.dkim,
        dmarc_validated: verificationResults.dmarc,
        verification_status: verificationResults.spf && verificationResults.dkim && verificationResults.dmarc 
          ? "verified" 
          : "warning",
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", profileId);

    if (updateError) throw updateError;

    // Log verification attempts
    const logPromises = Object.entries(verificationResults).map(([recordType, result]) =>
      supabaseClient.from("dns_verification_logs").insert({
        email_profile_id: profileId,
        record_type: recordType.toUpperCase(),
        verification_result: result,
        error_message: result ? null : `${recordType.toUpperCase()} record not found or invalid`,
      })
    );

    await Promise.all(logPromises);

    const allVerified = Object.values(verificationResults).every((v) => v === true);

    return new Response(
      JSON.stringify({
        success: true,
        results: verificationResults,
        allVerified,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in verify-dns-records function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to verify DNS records" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// Simulated DNS verification functions
// In production, use actual DNS lookup services like Google DNS API, Cloudflare DNS, or dns.resolve()
async function verifySpfRecord(domain: string): Promise<boolean> {
  try {
    // Simulate DNS lookup delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // In production: Query TXT records for the domain and check for SPF
    // const records = await dns.resolveTxt(domain);
    // return records.some(record => record.join('').includes('v=spf1'));
    
    // For demo: return true for any domain
    console.log(`SPF verification for ${domain}: simulated as verified`);
    return true;
  } catch (error) {
    console.error(`SPF verification failed for ${domain}:`, error);
    return false;
  }
}

async function verifyDkimRecord(domain: string): Promise<boolean> {
  try {
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // In production: Query CNAME records for pm._domainkey.{domain}
    // const records = await dns.resolveCname(`pm._domainkey.${domain}`);
    // return records.length > 0;
    
    console.log(`DKIM verification for ${domain}: simulated as verified`);
    return true;
  } catch (error) {
    console.error(`DKIM verification failed for ${domain}:`, error);
    return false;
  }
}

async function verifyDmarcRecord(domain: string): Promise<boolean> {
  try {
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // In production: Query TXT records for _dmarc.{domain}
    // const records = await dns.resolveTxt(`_dmarc.${domain}`);
    // return records.some(record => record.join('').includes('v=DMARC1'));
    
    console.log(`DMARC verification for ${domain}: simulated as verified`);
    return true;
  } catch (error) {
    console.error(`DMARC verification failed for ${domain}:`, error);
    return false;
  }
}
