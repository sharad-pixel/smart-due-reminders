import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";

const agents = Object.entries(personaConfig)
  .filter(([key]) => key !== "nicolas")
  .map(([key, persona]) => ({
    key,
    ...persona,
    range: persona.bucketMax ? `${persona.bucketMin}–${persona.bucketMax} Days` : `${persona.bucketMin}+ Days`,
  }));

export function AIAgentCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % agents.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const agent = agents[activeIndex];

  return (
    <div className="relative">
      {/* Agent avatars */}
      <div className="flex justify-center items-center gap-3 md:gap-4 mb-8">
        {agents.map((a, i) => (
          <motion.button
            key={a.key}
            onClick={() => setActiveIndex(i)}
            className="relative rounded-full p-0.5"
            style={{
              boxShadow: i === activeIndex ? `0 0 24px ${a.color}50` : "none",
              border: i === activeIndex ? `2px solid ${a.color}` : "2px solid transparent",
            }}
            animate={{
              scale: i === activeIndex ? 1.25 : 0.85,
              opacity: i === activeIndex ? 1 : 0.5,
            }}
            whileHover={{ scale: 1.1, opacity: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <PersonaAvatar persona={a.key} size="xl" />
          </motion.button>
        ))}
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
              <div className="flex-shrink-0" style={{ filter: `drop-shadow(0 0 12px ${agent.color}30)` }}>
                <PersonaAvatar persona={agent.key} size="xl" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-xl font-bold" style={{ color: agent.color }}>{agent.name}</h3>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{agent.range}</span>
                </div>
                <p className="text-muted-foreground text-sm font-medium mb-2">{agent.description} · {agent.tone}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
