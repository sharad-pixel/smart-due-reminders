import { useState, useRef, useCallback, useEffect } from "react";

interface UsePersonaVoiceReturn {
  isPlaying: boolean;
  isLoading: boolean;
  isSpeaking: boolean;
  amplitude: number;
  play: (personaKey: string, text: string) => Promise<void>;
  stop: () => void;
}

export const usePersonaVoice = (): UsePersonaVoiceReturn => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [amplitude, setAmplitude] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const speakingPulseRef = useRef<number | null>(null);

  const IOS_SILENT_WAV =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

  const clearSpeakingPulse = useCallback(() => {
    if (speakingPulseRef.current) {
      window.clearInterval(speakingPulseRef.current);
      speakingPulseRef.current = null;
    }
  }, []);

  const revokeCurrentAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const startSpeakingPulse = useCallback(() => {
    clearSpeakingPulse();
    setIsSpeaking(true);

    speakingPulseRef.current = window.setInterval(() => {
      // Keep animation lively even without WebAudio analyser on mobile browsers.
      setAmplitude(0.2 + Math.random() * 0.6);
    }, 90);
  }, [clearSpeakingPulse]);

  const stop = useCallback(() => {
    clearSpeakingPulse();

    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.onpause = null;
        audioRef.current.src = "";
        audioRef.current.load();
      } catch (error) {
        console.warn("Audio stop cleanup warning:", error);
      }
      audioRef.current = null;
    }

    revokeCurrentAudioUrl();

    setIsLoading(false);
    setIsPlaying(false);
    setIsSpeaking(false);
    setAmplitude(0);
  }, [clearSpeakingPulse, revokeCurrentAudioUrl]);

  const play = useCallback(
    async (personaKey: string, text: string) => {
      stop();
      setIsLoading(true);

      try {
        // Create and unlock Audio element immediately in user-gesture context.
        const audio = new Audio();
        audio.preload = "auto";
        audio.setAttribute("playsinline", "true");
        audio.setAttribute("webkit-playsinline", "true");
        audio.muted = false;
        audio.volume = 1;
        audioRef.current = audio;

        // iOS/Safari unlock step (must happen before async work).
        audio.src = IOS_SILENT_WAV;
        void audio
          .play()
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
          })
          .catch(() => {
            // Unlock can fail silently; we still continue with normal playback.
          });

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ text, personaKey }),
          }
        );

        if (!response.ok) {
          throw new Error(`TTS request failed: ${response.status}`);
        }

        const audioBlob = await response.blob();
        if (!audioBlob.size) {
          throw new Error("TTS response was empty");
        }

        const audioUrl = URL.createObjectURL(audioBlob);
        audioUrlRef.current = audioUrl;
        audio.src = audioUrl;
        audio.load();

        audio.onended = () => {
          stop();
        };

        audio.onpause = () => {
          // Keep stopped state in sync if browser pauses playback.
          if (audio.currentTime > 0 && !audio.ended) {
            setIsPlaying(false);
            setIsSpeaking(false);
            clearSpeakingPulse();
            setAmplitude(0);
          }
        };

        audio.onerror = (event) => {
          console.error("Audio playback element error:", event);
          stop();
        };

        setIsLoading(false);
        setIsPlaying(true);
        startSpeakingPulse();

        try {
          await audio.play();
        } catch (playError) {
          console.warn("Initial playback blocked, retrying once:", playError);
          await new Promise((resolve) => setTimeout(resolve, 40));
          await audio.play();
        }
      } catch (error) {
        console.error("Voice playback error:", error);
        stop();
      }
    },
    [clearSpeakingPulse, startSpeakingPulse, stop]
  );

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { isPlaying, isLoading, isSpeaking, amplitude, play, stop };
};
