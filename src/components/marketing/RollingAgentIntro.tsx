import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Briefcase, Building2 } from "lucide-react";
import { PersonaAvatar } from "@/components/ai/PersonaAvatar";
import { personaConfig, type PersonaConfig } from "@/lib/personaConfig";

type PlanSlide = {
  kind: "plan";
  name: string;
  color: string;
  icon: typeof Rocket;
  headline: string;
  punchline: string;
  description: string;
};

type AgentSlide = {
  kind: "agent";
  agent: PersonaConfig;
};

type Slide = PlanSlide | AgentSlide;

const planSlides: PlanSlide[] = [
  {
    kind: "plan",
    name: "Solo",
    color: "#69B7FF",
    icon: Rocket,
    headline: "Solo Plan",
    punchline: "A collections intelligence platform for everyone — start solo.",
    description: "Built for founders & freelancers · Recover faster on day one",
  },
  {
    kind: "plan",
    name: "Pro",
    color: "#14B5B0",
    icon: Briefcase,
    headline: "Pro Plan",
    punchline: "Scale your AR team with AI agents and full risk intelligence.",
    description: "For growing finance teams · Workflows, automations & analytics",
  },
  {
    kind: "plan",
    name: "Enterprise",
    color: "#8b5cf6",
    icon: Building2,
    headline: "Enterprise Plan",
    punchline: "From solo to enterprise — collections intelligence at every scale.",
    description: "For large organizations · SSO, custom integrations & dedicated support",
  },
];

const agentSlides: AgentSlide[] = Object.values(personaConfig).map((agent) => ({
  kind: "agent" as const,
  agent,
}));

// Interleave: agent, agent, plan, agent, agent, plan ...
const slides: Slide[] = (() => {
  const out: Slide[] = [];
  let planIdx = 0;
  agentSlides.forEach((a, i) => {
    out.push(a);
    if ((i + 1) % 2 === 0 && planIdx < planSlides.length) {
      out.push(planSlides[planIdx++]);
    }
  });
  while (planIdx < planSlides.length) out.push(planSlides[planIdx++]);
  return out;
})();

const RollingAgentIntro = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const active = slides[activeIndex];

  // For the avatar selector row, show only agents (plans are auto-rotated in)
  const agents = agentSlides.map((s) => s.agent);
  const activeAgentIndex =
    active.kind === "agent" ? agents.findIndex((a) => a.name === active.agent.name) : -1;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Agent avatars row */}
      <div className="flex justify-center items-center gap-2 md:gap-3 mb-6">
        {agents.map((agent, i) => (
          <motion.button
            key={agent.name}
            onClick={() => {
              const slideIdx = slides.findIndex(
                (s) => s.kind === "agent" && s.agent.name === agent.name,
              );
              if (slideIdx >= 0) setActiveIndex(slideIdx);
            }}
            className="relative rounded-full p-0.5 transition-all duration-300"
            style={{
              boxShadow: i === activeAgentIndex ? `0 0 20px ${agent.color}40` : "none",
              border: i === activeAgentIndex ? `2px solid ${agent.color}` : "2px solid transparent",
            }}
            animate={{
              scale: i === activeAgentIndex ? 1.2 : 0.85,
              opacity: i === activeAgentIndex ? 1 : 0.5,
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
            key={activeIndex}
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            {active.kind === "agent" ? (
              <>
                <motion.h3
                  className="text-lg md:text-xl font-bold"
                  style={{ color: active.agent.color }}
                >
                  Meet {active.agent.name}
                </motion.h3>
                <p className="text-sm md:text-base text-muted-foreground mt-1 max-w-md">
                  "{active.agent.punchline}"
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {active.agent.description} · {active.agent.tone}
                </p>
              </>
            ) : (
              <>
                <motion.h3
                  className="inline-flex items-center gap-2 text-lg md:text-xl font-bold"
                  style={{ color: active.color }}
                >
                  <active.icon className="w-5 h-5" />
                  {active.headline}
                </motion.h3>
                <p className="text-sm md:text-base text-foreground/90 mt-1 max-w-md font-medium">
                  {active.punchline}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">{active.description}</p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 mt-2">
        {slides.map((slide, i) => {
          const color = slide.kind === "agent" ? slide.agent.color : slide.color;
          return (
            <motion.div
              key={i}
              className="h-1 rounded-full cursor-pointer"
              style={{ backgroundColor: i === activeIndex ? color : undefined }}
              animate={{
                width: i === activeIndex ? 24 : 8,
                opacity: i === activeIndex ? 1 : 0.3,
              }}
              onClick={() => setActiveIndex(i)}
              transition={{ duration: 0.3 }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default RollingAgentIntro;
