import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
const MODERATION_THRESHOLD = 0.7;

interface ModerationResult {
  safe: boolean;
  categories: Record<string, number>;
  rejectionReason?: string;
}

async function moderateImage(imageBase64: string, fileType: string): Promise<ModerationResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    throw new Error("Moderation service unavailable");
  }

  // SVG files can't be analyzed by vision models - do basic text check
  if (fileType === "image/svg+xml") {
    const svgContent = atob(imageBase64);
    const suspiciousPatterns = [
      /onload\s*=/i,
      /onerror\s*=/i,
      /<script/i,
      /javascript:/i,
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(svgContent)) {
        return {
          safe: false,
          categories: { malicious_content: 1.0 },
          rejectionReason: "SVG contains potentially malicious content"
        };
      }
    }
    
    return { safe: true, categories: {} };
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an image moderation system. Analyze the provided image and determine if it contains inappropriate content. You must respond ONLY with a valid JSON object, no other text.

Categories to check:
- nudity: Sexual or explicit nudity
- violence: Graphic violence or gore
- hate: Hate symbols, harassment imagery
- self_harm: Self-harm or suicide imagery
- drugs: Illegal drug use imagery
- offensive: Generally offensive or inappropriate for business use

Respond with this exact JSON structure:
{
  "safe": true/false,
  "categories": {
    "nudity": 0.0-1.0,
    "violence": 0.0-1.0,
    "hate": 0.0-1.0,
    "self_harm": 0.0-1.0,
    "drugs": 0.0-1.0,
    "offensive": 0.0-1.0
  },
  "reason": "brief explanation if unsafe, empty string if safe"
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this image for inappropriate content. Return only the JSON response."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${fileType};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Moderation API error:", response.status, errorText);
      throw new Error("Moderation service error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    console.log("Moderation raw response:", content);
    
    // Parse the JSON response
    let parsed;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse moderation response:", parseError);
      // Default to safe if we can't parse (fail open for non-critical)
      return { safe: true, categories: {} };
    }

    // Check if any category exceeds threshold
    const categories = parsed.categories || {};
    let isUnsafe = false;
    let highestCategory = "";
    let highestScore = 0;

    for (const [category, score] of Object.entries(categories)) {
      const numScore = Number(score);
      if (numScore > MODERATION_THRESHOLD) {
        isUnsafe = true;
        if (numScore > highestScore) {
          highestScore = numScore;
          highestCategory = category;
        }
      }
    }

    return {
      safe: !isUnsafe && parsed.safe !== false,
      categories,
      rejectionReason: isUnsafe ? (parsed.reason || `Content flagged for ${highestCategory}`) : undefined
    };
  } catch (error) {
    console.error("Moderation error:", error);
    throw new Error("We're having trouble processing this image right now. Please try again later.");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const purpose = formData.get("purpose") as string || "unknown";
    const bucket = formData.get("bucket") as string || "org-logos";
    const storagePath = formData.get("storagePath") as string;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return new Response(JSON.stringify({ 
        error: "Invalid file type. Please upload a PNG, JPG, SVG, or WebP image." 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ 
        error: "File size must be less than 2MB" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert file to base64 for moderation
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binaryString);

    // Run moderation
    let moderationResult: ModerationResult;
    try {
      moderationResult = await moderateImage(base64, file.type);
    } catch (modError) {
      // Log the failed moderation attempt
      await supabase.from("image_moderation_logs").insert({
        user_id: user.id,
        image_purpose: purpose,
        moderation_status: "rejected",
        categories: { error: String(modError) },
        rejection_reason: "Moderation service unavailable",
        file_name: file.name,
        file_size: file.size,
      });

      return new Response(JSON.stringify({ 
        error: "We're having trouble processing this image right now. Please try again later." 
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If image is unsafe, reject it
    if (!moderationResult.safe) {
      // Log the rejection
      await supabase.from("image_moderation_logs").insert({
        user_id: user.id,
        image_purpose: purpose,
        moderation_status: "rejected",
        categories: moderationResult.categories,
        rejection_reason: moderationResult.rejectionReason,
        file_name: file.name,
        file_size: file.size,
      });

      return new Response(JSON.stringify({ 
        error: "We couldn't accept this image. Please upload a different image that doesn't contain explicit or inappropriate content.",
        rejected: true
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Image is safe - upload to storage
    const finalPath = storagePath || `${user.id}/${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(finalPath, uint8Array, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(JSON.stringify({ 
        error: "Failed to upload image. Please try again." 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(finalPath);

    // Log the successful upload
    await supabase.from("image_moderation_logs").insert({
      user_id: user.id,
      image_purpose: purpose,
      storage_path: finalPath,
      moderation_status: "accepted",
      categories: moderationResult.categories,
      file_name: file.name,
      file_size: file.size,
    });

    return new Response(JSON.stringify({ 
      success: true,
      publicUrl,
      storagePath: finalPath
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Upload error:", error);
    return new Response(JSON.stringify({ 
      error: "An unexpected error occurred. Please try again." 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
