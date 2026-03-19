import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PersonaAvatar } from "@/components/ai/PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";
import { SpeakingAvatar } from "@/components/ai/SpeakingAvatar";
import { usePersonaVoice } from "@/hooks/usePersonaVoice";
import { Volume2 } from "lucide-react";

const agents = Object.entries(personaConfig)
  .filter(([key]) => key !== "nicolas")
  .map(([key, persona]) => ({
    key,
    ...persona,
    range: persona.bucketMax
      ? `${persona.bucketMin}–${persona.bucketMax} Days`
      : `${persona.bucketMin}+ Days`,
  }));

// Short intro lines each persona speaks when selected
const personaIntroLines: Record<string, string> = {
  sam: "Hey there! I'm Sam. I work 24/7 as your friendly first-touch agent, gently nudging customers in the first 30 days so invoices get paid on time.",
  james:
    "I'm James. When invoices hit 31 to 60 days, I'm on the job day and night with clear, professional communication to get things resolved for your business.",
  katy: "I'm Katy. At 61 to 90 days past due, I bring serious urgency around the clock, making sure your customers understand the importance of settling up.",
  troy: "I'm Troy. I work for your business 24/7. When accounts reach 91 to 120 days overdue, I deliver firm final warnings before escalation.",
  jimmy:
    "I'm Jimmy. At 121 to 150 days, I bring the legal pressure nonstop. Consider me your always-on last line before formal remedies.",
  rocco:
    "I'm Rocco. I'm your final collections agent, working day and night. When I reach out, it's the absolute last step before external action.",
};

export function AIAgentCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const { isPlaying, isLoading, isSpeaking, amplitude, play, stop } =
    usePersonaVoice();
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  useEffect(() => {
    if (isPlaying) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % agents.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const agent = agents[activeIndex];

  const handleVoiceClick = useCallback(
    (index: number) => {
      const key = agents[index].key;
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
    <div className="relative">
      {/* Agent avatars */}
      <div className="flex justify-center items-center gap-3 md:gap-4 mb-8">
        {agents.map((a, i) => {
          const isThisPlaying = isPlaying && playingKey === a.key;
          const isThisLoading = isLoading && playingKey === a.key;

          return (
            <motion.div
              key={a.key}
              className="relative rounded-full p-0.5"
              style={{
                boxShadow:
                  i === activeIndex ? `0 0 24px ${a.color}50` : "none",
                border:
                  i === activeIndex
                    ? `2px solid ${a.color}`
                    : "2px solid transparent",
              }}
              animate={{
                scale: i === activeIndex ? 1.25 : 0.85,
                opacity: i === activeIndex ? 1 : 0.5,
              }}
              whileHover={{ scale: 1.1, opacity: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <SpeakingAvatar
                persona={a}
                size="xl"
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

      {/* Agent card */}
      <div className="min-h-[200px] relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={agent.key}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl bg-card border border-border/50 p-6 shadow-xl"
          >
            <div className="flex items-start gap-5">
              <div
                className="flex-shrink-0"
                style={{
                  filter: `drop-shadow(0 0 12px ${agent.color}30)`,
                }}
              >
                <PersonaAvatar persona={agent.key} size="xl" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3
                    className="text-xl font-bold"
                    style={{ color: agent.color }}
                  >
                    {agent.name}
                  </h3>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                    {agent.range}
                  </span>
                  {isPlaying && playingKey === agent.key && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-0.5"
                    >
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-0.5 rounded-full"
                          style={{ backgroundColor: agent.color }}
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
                <p className="text-muted-foreground text-sm font-medium mb-2">
                  {agent.description} · {agent.tone}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Hint text */}
      <motion.p
        className="text-center text-xs text-muted-foreground/50 mt-4 flex items-center justify-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        <Volume2 className="h-3 w-3" />
        Click any agent to hear them speak
      </motion.p>
    </div>
  );
}
