import { useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { PersonaAvatar } from "./PersonaAvatar";
import { PersonaConfig } from "@/lib/personaConfig";
import { Volume2, Loader2 } from "lucide-react";

interface SpeakingAvatarProps {
  persona: PersonaConfig;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  amplitude?: number;
  isSpeaking?: boolean;
  isLoading?: boolean;
  isPlaying?: boolean;
  onClick?: () => void;
  className?: string;
}

type AvatarSize = NonNullable<SpeakingAvatarProps["size"]>;

const mouthSizeMap: Record<AvatarSize, { width: number; top: number }> = {
  xs: { width: 6, top: 66 },
  sm: { width: 7, top: 66 },
  md: { width: 8, top: 66 },
  lg: { width: 9, top: 66 },
  xl: { width: 10, top: 67 },
  "2xl": { width: 16, top: 67 },
};

const personaMouthOffset: Record<string, number> = {
  sam: -1,
  james: 0,
  katy: 1,
  troy: 0,
  jimmy: 0,
  rocco: 1,
  nicolas: 0,
};

export const SpeakingAvatar = ({
  persona,
  size = "md",
  amplitude = 0,
  isSpeaking = false,
  isLoading = false,
  isPlaying = false,
  onClick,
  className,
}: SpeakingAvatarProps) => {
  const glowIntensity = 0.15 + amplitude * 0.6;
  const pulseScale = 1 + amplitude * 0.15;
  const lastInteractionRef = useRef(0);
  const mouth = mouthSizeMap[size] || mouthSizeMap.md;
  const mouthOpenHeight = Math.max(2, amplitude * mouth.width * 0.6);

  const triggerInteraction = useCallback(() => {
    const now = Date.now();
    if (now - lastInteractionRef.current < 350) return;
    lastInteractionRef.current = now;
    onClick?.();
  }, [onClick]);

  return (
    <motion.div
      className={`relative cursor-pointer group ${className || ""}`}
      onTouchStart={triggerInteraction}
      onMouseDown={triggerInteraction}
      onClick={triggerInteraction}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Outer pulse ring - visible when speaking */}
      {isSpeaking && (
        <motion.div
          className="absolute inset-[-8px] rounded-full"
          style={{
            border: `2px solid ${persona.color}`,
            opacity: 0.3,
          }}
          animate={{
            scale: [1, 1.2 + amplitude * 0.3, 1],
            opacity: [0.3, 0.1, 0.3],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Inner glow */}
      <motion.div
        className="absolute inset-[-4px] rounded-full blur-md"
        style={{ background: persona.color }}
        animate={{
          opacity: isPlaying ? glowIntensity : 0,
          scale: isPlaying ? pulseScale : 1,
        }}
        transition={{ duration: 0.1 }}
      />

      {/* Avatar with scale animation */}
      <motion.div
        className="relative"
        animate={{
          scale: isSpeaking ? pulseScale : 1,
        }}
        transition={{ duration: 0.1 }}
      >
        <PersonaAvatar persona={persona} size={size} />

        {/* Talking mouth overlay */}
        {isSpeaking && (
          <motion.div
            className="absolute left-1/2 rounded-[50%]"
            style={{
              bottom: mouth.bottom,
              width: mouth.width,
              marginLeft: -(mouth.width / 2),
              backgroundColor: "#1a0a0a",
              border: "1px solid #400",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.6)",
            }}
            animate={{
              height: [mouthOpenHeight * 0.3, mouthOpenHeight, mouthOpenHeight * 0.3],
              scaleX: [0.85, 1.1, 0.85],
            }}
            transition={{
              duration: 0.25,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </motion.div>

      {/* Play/loading overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-full flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ opacity: isLoading ? 1 : undefined }}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 text-white animate-spin" />
        ) : !isPlaying ? (
          <Volume2 className="h-4 w-4 text-white" />
        ) : null}
      </motion.div>
    </motion.div>
  );
};
