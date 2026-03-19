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
  // Scale the glow and pulse based on amplitude
  const glowIntensity = 0.15 + amplitude * 0.6;
  const pulseScale = 1 + amplitude * 0.15;

  return (
    <motion.div
      className={`relative cursor-pointer group ${className || ""}`}
      onTapStart={onClick}
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
        animate={{
          scale: isSpeaking ? pulseScale : 1,
        }}
        transition={{ duration: 0.1 }}
      >
        <PersonaAvatar persona={persona} size={size} />
      </motion.div>

      {/* Play/loading overlay */}
      <motion.div
        className="absolute inset-0 rounded-full flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
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
