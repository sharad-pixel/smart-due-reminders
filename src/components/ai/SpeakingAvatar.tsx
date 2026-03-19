import { useCallback, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { PersonaAvatar } from "./PersonaAvatar";
import { PersonaConfig } from "@/lib/personaConfig";

interface SpeakingAvatarProps {
  persona: PersonaConfig;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  onClick?: () => void;
  className?: string;
}

// Stagger idle animations so each avatar feels unique
const getIdleDelay = (name: string) => {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (hash % 20) * 0.1; // 0 – 2s offset
};

// Each persona gets a unique blink interval
const getBlinkInterval = (name: string) => {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return 2.8 + (hash % 30) * 0.12; // 2.8 – 6.4s between blinks
};

export const SpeakingAvatar = ({
  persona,
  size = "md",
  onClick,
  className,
}: SpeakingAvatarProps) => {
  const lastInteractionRef = useRef(0);
  const idleDelay = useMemo(() => getIdleDelay(persona.name), [persona.name]);
  const blinkInterval = useMemo(() => getBlinkInterval(persona.name), [persona.name]);

  const triggerInteraction = useCallback(() => {
    const now = Date.now();
    if (now - lastInteractionRef.current < 350) return;
    lastInteractionRef.current = now;
    onClick?.();
  }, [onClick]);

  return (
    <motion.div
      className={`relative cursor-pointer group ${className || ""}`}
      onTouchStart={onClick ? triggerInteraction : undefined}
      onMouseDown={onClick ? triggerInteraction : undefined}
      onClick={onClick ? triggerInteraction : undefined}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Avatar container with idle breathing + floating */}
      <motion.div
        className="relative"
        animate={{
          scale: [1, 1.025, 1],
          y: [0, -2, 0],
        }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: idleDelay,
        }}
      >
        {/* Avatar image */}
        <PersonaAvatar persona={persona} size={size} />

        {/* Eye-blink: brief brightness dip */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-full bg-black"
          style={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.25, 0],
          }}
          transition={{
            duration: 0.15,
            repeat: Infinity,
            repeatDelay: blinkInterval,
            ease: "easeInOut",
          }}
        />
      </motion.div>
    </motion.div>
  );
};
