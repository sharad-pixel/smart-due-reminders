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
  const playRequestIdRef = useRef(0);
  const fetchAbortRef = useRef<AbortController | null>(null);

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
      setAmplitude(0.2 + Math.random() * 0.6);
    }, 90);
  }, [clearSpeakingPulse]);

  const clearActivePlayback = useCallback(() => {
    clearSpeakingPulse();

    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
      fetchAbortRef.current = null;
    }

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

  const stop = useCallback(() => {
    playRequestIdRef.current += 1;
    clearActivePlayback();
  }, [clearActivePlayback]);

  const play = useCallback(
    async (personaKey: string, text: string) => {
      const requestId = ++playRequestIdRef.current;
      clearActivePlayback();
      setIsLoading(true);

      let controller: AbortController | null = null;

      try {
        const audio = new Audio();
        audio.preload = "auto";
        audio.setAttribute("playsinline", "true");
        audio.setAttribute("webkit-playsinline", "true");
        audio.muted = false;
        audio.volume = 1;
        audioRef.current = audio;

        audio.src = IOS_SILENT_WAV;
        void audio
          .play()
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
          })
          .catch(() => {
            // unlock can fail silently; continue with normal playback
          });

        controller = new AbortController();
        fetchAbortRef.current = controller;

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
            signal: controller.signal,
          }
        );

        if (requestId !== playRequestIdRef.current) {
          return;
        }

        if (!response.ok) {
          throw new Error(`TTS request failed: ${response.status}`);
        }

        const audioBlob = await response.blob();

        if (requestId !== playRequestIdRef.current) {
          return;
        }

        if (!audioBlob.size) {
          throw new Error("TTS response was empty");
        }

        const audioUrl = URL.createObjectURL(audioBlob);

        if (requestId !== playRequestIdRef.current) {
          URL.revokeObjectURL(audioUrl);
          return;
        }

        audioUrlRef.current = audioUrl;
        audio.src = audioUrl;
        audio.load();

        audio.onended = () => {
          if (requestId === playRequestIdRef.current) {
            stop();
          }
        };

        audio.onpause = () => {
          if (requestId !== playRequestIdRef.current) return;

          if (audio.currentTime > 0 && !audio.ended) {
            setIsPlaying(false);
            setIsSpeaking(false);
            clearSpeakingPulse();
            setAmplitude(0);
          }
        };

        audio.onerror = (event) => {
          if (requestId !== playRequestIdRef.current) return;
          console.error("Audio playback element error:", event);
          stop();
        };

        setIsLoading(false);
        setIsPlaying(true);
        startSpeakingPulse();

        try {
          await audio.play();
        } catch (playError) {
          if (requestId !== playRequestIdRef.current) return;
          console.warn("Initial playback blocked, retrying once:", playError);
          await new Promise((resolve) => setTimeout(resolve, 40));
          await audio.play();
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (requestId !== playRequestIdRef.current) {
          return;
        }

        console.error("Voice playback error:", error);
        stop();
      } finally {
        if (fetchAbortRef.current === controller) {
          fetchAbortRef.current = null;
        }
      }
    },
    [clearActivePlayback, clearSpeakingPulse, startSpeakingPulse, stop]
  );

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { isPlaying, isLoading, isSpeaking, amplitude, play, stop };
};
