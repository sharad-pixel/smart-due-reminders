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
  const sourceCreatedRef = useRef(false);

  const updateAmplitude = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate RMS amplitude (0-1)
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length) / 255;

    // Smooth the amplitude for animation
    setAmplitude((prev) => prev * 0.3 + rms * 0.7);
    setIsSpeaking(rms > 0.05);

    animationFrameRef.current = requestAnimationFrame(updateAmplitude);
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsPlaying(false);
    setIsSpeaking(false);
    setAmplitude(0);
    sourceCreatedRef.current = false;
  }, []);

  const play = useCallback(
    async (personaKey: string, text: string) => {
      // Stop any currently playing audio
      stop();
      setIsLoading(true);

      try {
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

        // Create audio element
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        // Set up Web Audio API for amplitude analysis
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }

        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        const source = audioContextRef.current.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioContextRef.current.destination);

        audio.onended = () => {
          stop();
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = () => {
          stop();
          URL.revokeObjectURL(audioUrl);
        };

        setIsLoading(false);
        setIsPlaying(true);
        await audio.play();

        // Start amplitude tracking
        updateAmplitude();
      } catch (error) {
        console.error("Voice playback error:", error);
        setIsLoading(false);
        stop();
      }
    },
    [stop, updateAmplitude]
  );

  // Cleanup on unmount
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
