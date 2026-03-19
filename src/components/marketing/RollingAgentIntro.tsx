import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PersonaConfig, personaConfig } from "@/lib/personaConfig";
import { SpeakingAvatar } from "@/components/ai/SpeakingAvatar";
import { usePersonaVoice } from "@/hooks/usePersonaVoice";
import { Volume2, VolumeX } from "lucide-react";

const agents = Object.values(personaConfig);
const agentKeys = Object.keys(personaConfig);

// Short intro lines each persona speaks when selected
const personaIntroLines: Record<string, string> = {
  nicolas: "Hi, I'm Nicolas. I'm your dedicated account manager, working around the clock to strengthen your customer relationships and keep revenue flowing.",
  sam: "Hey there! I'm Sam. I work 24/7 as your friendly first-touch agent, gently nudging customers in the first 30 days so invoices get paid on time.",
  james: "I'm James. When invoices hit 31 to 60 days, I'm on the job day and night with clear, professional communication to get things resolved for your business.",
  katy: "I'm Katy. At 61 to 90 days past due, I bring serious urgency around the clock, making sure your customers understand the importance of settling up.",
  troy: "I'm Troy. I work for your business 24/7. When accounts reach 91 to 120 days overdue, I deliver firm final warnings before escalation.",
  jimmy: "I'm Jimmy. At 121 to 150 days, I bring the legal pressure nonstop. Consider me your always-on last line before formal remedies.",
  rocco: "I'm Rocco. I'm your final collections agent, working day and night. When I reach out, it's the absolute last step before external action.",
};

const RollingAgentIntro = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const { isPlaying, isLoading, isSpeaking, amplitude, play, stop } = usePersonaVoice();
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  useEffect(() => {
    // Only auto-rotate when not playing audio
    if (isPlaying) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % agents.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const active = agents[activeIndex];
  const activeKey = agentKeys[activeIndex];

  const handleVoiceClick = useCallback(
    (index: number) => {
      const key = agentKeys[index];
      setActiveIndex(index);

      if (isPlaying && playingKey === key) {
        stop();
        setPlayingKey(null);
      } else {
        setPlayingKey(key);
        play(key, personaIntroLines[key]);
      }
    },
    [isPlaying, playingKey, play, stop]
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Agent avatars row */}
      <div className="flex justify-center items-center gap-2 md:gap-3 mb-6">
        {agents.map((agent, i) => {
          const key = agentKeys[i];
          const isThisPlaying = isPlaying && playingKey === key;
          const isThisLoading = isLoading && playingKey === key;

          return (
            <motion.div
              key={agent.name}
              className="relative"
              style={{
                boxShadow:
                  i === activeIndex ? `0 0 20px ${agent.color}40` : "none",
              }}
              animate={{
                scale: i === activeIndex ? 1.2 : 0.85,
                opacity: i === activeIndex ? 1 : 0.5,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <SpeakingAvatar
                persona={agent}
                size="md"
                amplitude={isThisPlaying ? amplitude : 0}
                isSpeaking={isThisPlaying && isSpeaking}
                isLoading={isThisLoading}
                isPlaying={isThisPlaying}
                onClick={() => handleVoiceClick(i)}
              />
            </motion.div>
          );
        })}
      </div>

      {/* Rolling intro card */}
      <div className="relative h-24 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.name}
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div className="flex items-center gap-2">
              <motion.h3
                className="text-lg md:text-xl font-bold"
                style={{ color: active.color }}
              >
                Meet {active.name}
              </motion.h3>
              {isPlaying && playingKey === activeKey && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-0.5"
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-0.5 rounded-full"
                      style={{ backgroundColor: active.color }}
                      animate={{
                        height: isSpeaking
                          ? [4, 12 + amplitude * 16, 4]
                          : 4,
                      }}
                      transition={{
                        duration: 0.4,
                        repeat: Infinity,
                        delay: i * 0.15,
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </div>
            <p className="text-sm md:text-base text-muted-foreground mt-1 max-w-md">
              {active.description}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1 italic">
              Tone: {active.tone}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 mt-2">
        {agents.map((agent, i) => (
          <motion.div
            key={i}
            className="h-1 rounded-full cursor-pointer"
            style={{
              backgroundColor: i === activeIndex ? agent.color : undefined,
            }}
            animate={{
              width: i === activeIndex ? 24 : 8,
              opacity: i === activeIndex ? 1 : 0.3,
            }}
            onClick={() => handleVoiceClick(i)}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>

      {/* Hint text */}
      <motion.p
        className="text-center text-xs text-muted-foreground/50 mt-3 flex items-center justify-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        <Volume2 className="h-3 w-3" />
        Click any agent to hear them speak
      </motion.p>
    </div>
  );
};

export default RollingAgentIntro;
