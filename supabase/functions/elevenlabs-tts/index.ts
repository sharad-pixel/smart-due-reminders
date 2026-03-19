import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Map persona keys to ElevenLabs voice IDs
const personaVoiceMap: Record<string, string> = {
  nicolas: "onwK4e9ZLuTAKqWW03F9", // Daniel - professional, warm
  sam: "EXAVITQu4vr4xnSDxMaL",     // Sarah - friendly, warm
  james: "JBFqnCBsd6RMkjVDRZzb",   // George - confident, professional
  katy: "cgSgspJ2msm6clMCkdW9",    // Jessica - assertive, focused
  troy: "TX3LPaxmHKxFdv7VOQHJ",    // Liam - firm, authoritative
  jimmy: "nPczCjzI2devNBz1zQrb",   // Brian - serious, commanding
  rocco: "cjVigY5qzO86Huf0OWal",   // Eric - deep, final authority
};

// Voice settings per persona for tone differentiation
const personaVoiceSettings: Record<string, { stability: number; similarity_boost: number; style: number; speed: number }> = {
  nicolas: { stability: 0.6, similarity_boost: 0.75, style: 0.3, speed: 1.0 },
  sam: { stability: 0.4, similarity_boost: 0.75, style: 0.5, speed: 1.05 },
  james: { stability: 0.6, similarity_boost: 0.8, style: 0.3, speed: 0.95 },
  katy: { stability: 0.7, similarity_boost: 0.8, style: 0.4, speed: 0.95 },
  troy: { stability: 0.8, similarity_boost: 0.85, style: 0.2, speed: 0.9 },
  jimmy: { stability: 0.85, similarity_boost: 0.9, style: 0.15, speed: 0.88 },
  rocco: { stability: 0.9, similarity_boost: 0.95, style: 0.05, speed: 0.78 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, personaKey } = await req.json();

    if (!text || !personaKey) {
      return new Response(
        JSON.stringify({ error: "text and personaKey are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ElevenLabs API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const voiceId = personaVoiceMap[personaKey];
    if (!voiceId) {
      return new Response(
        JSON.stringify({ error: `Unknown persona: ${personaKey}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const voiceSettings = personaVoiceSettings[personaKey] || personaVoiceSettings.sam;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: voiceSettings.stability,
            similarity_boost: voiceSettings.similarity_boost,
            style: voiceSettings.style,
            use_speaker_boost: true,
            speed: voiceSettings.speed,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs API error [${response.status}]: ${errorText}`);
      return new Response(
        JSON.stringify({ error: `TTS generation failed: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("TTS edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
