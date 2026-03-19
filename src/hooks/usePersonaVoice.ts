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
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const IOS_SILENT_WAV =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
  const isIOSDeviceRef = useRef(
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );

  const updateAmplitude = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length) / 255;

    setAmplitude((prev) => prev * 0.3 + rms * 0.7);
    setIsSpeaking(rms > 0.05);

    animationFrameRef.current = requestAnimationFrame(updateAmplitude);
  }, []);

  const revokeCurrentAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const ensureAudioContextReady = useCallback(async () => {
    if (!audioContextRef.current) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextCtor) {
        throw new Error("Web Audio API is not supported on this device");
      }

      audioContextRef.current = new AudioContextCtor();
    }

    if (audioContextRef.current.state === "suspended") {
      try {
        await audioContextRef.current.resume();
      } catch (resumeError) {
        console.warn("AudioContext resume blocked:", resumeError);
      }
    }

    return audioContextRef.current;
  }, []);

  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.src = "";
      audioRef.current.load();
      audioRef.current = null;
    }

    revokeCurrentAudioUrl();

    setIsPlaying(false);
    setIsSpeaking(false);
    setAmplitude(0);
  }, [revokeCurrentAudioUrl]);

  const play = useCallback(
    async (personaKey: string, text: string) => {
      stop();
      setIsLoading(true);

      try {
        // Create/unlock media element immediately in user gesture context
        const audio = new Audio();
        audio.preload = "auto";
        audio.setAttribute("playsinline", "true");
        audio.setAttribute("webkit-playsinline", "true");
        audio.volume = 1;
        audio.muted = false;
        audioRef.current = audio;

        // Prime with a tiny silent clip to preserve iOS user-gesture playback permissions
        audio.src = IOS_SILENT_WAV;
        const unlockPromise = audio.play();
        if (unlockPromise) {
          unlockPromise
            .then(() => {
              audio.pause();
              audio.currentTime = 0;
            })
            .catch(() => {
              // Ignore unlock failures; we'll still attempt regular playback
            });
        }

        const shouldUseAnalyser = !isIOSDeviceRef.current;
        const context = shouldUseAnalyser ? await ensureAudioContextReady() : null;

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
        const audioUrl = URL.createObjectURL(audioBlob);
        audioUrlRef.current = audioUrl;
        audio.src = audioUrl;
        audio.load();

        // Use analyzer where reliable; on iOS prioritize playback reliability over visual metering
        if (context) {
          try {
            const analyser = context.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;

            const source = context.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(context.destination);
            analyserRef.current = analyser;
          } catch (analysisError) {
            console.warn("Audio analyzer setup skipped:", analysisError);
            analyserRef.current = null;
          }
        } else {
          analyserRef.current = null;
        }

        audio.onended = () => {
          stop();
        };

        audio.onerror = (event) => {
          console.error("Audio playback element error:", event);
          stop();
        };

        setIsLoading(false);
        setIsPlaying(true);

        try {
          if (context?.state === "suspended") {
            await context.resume();
          }
          await audio.play();
        } catch (playError) {
          console.warn("Initial playback blocked, retrying once:", playError);
          if (context) {
            await ensureAudioContextReady();
          }
          await audio.play();
        }

        if (analyserRef.current) {
          updateAmplitude();
        }
      } catch (error) {
        console.error("Voice playback error:", error);
        setIsLoading(false);
        stop();
      }
    },
    [ensureAudioContextReady, stop, updateAmplitude]
  );

  useEffect(() => {
    return () => {
      stop();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stop]);

  return { isPlaying, isLoading, isSpeaking, amplitude, play, stop };
};
