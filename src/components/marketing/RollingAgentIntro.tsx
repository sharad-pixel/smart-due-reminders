import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { personaConfig, PersonaConfig } from "@/lib/personaConfig";

const agents = Object.values(personaConfig);

const RollingAgentIntro = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % agents.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const active = agents[activeIndex];

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Agent avatars row */}
      <div className="flex justify-center items-center gap-2 md:gap-3 mb-6">
        {agents.map((agent, i) => (
          <motion.button
            key={agent.name}
            onClick={() => setActiveIndex(i)}
            className="relative rounded-full p-0.5 transition-all duration-300"
            style={{
              boxShadow: i === activeIndex ? `0 0 20px ${agent.color}40` : "none",
              border: i === activeIndex ? `2px solid ${agent.color}` : "2px solid transparent",
            }}
            animate={{
              scale: i === activeIndex ? 1.2 : 0.85,
              opacity: i === activeIndex ? 1 : 0.5,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <PersonaAvatar persona={agent} size="md" />
          </motion.button>
        ))}
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
            <motion.h3
              className="text-lg md:text-xl font-bold"
              style={{ color: active.color }}
            >
              Meet {active.name}
            </motion.h3>
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
            style={{ backgroundColor: i === activeIndex ? agent.color : undefined }}
            animate={{
              width: i === activeIndex ? 24 : 8,
              opacity: i === activeIndex ? 1 : 0.3,
            }}
            onClick={() => setActiveIndex(i)}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </div>
  );
};

export default RollingAgentIntro;
