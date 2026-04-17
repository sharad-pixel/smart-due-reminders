import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PersonaAvatar } from "@/components/ai/PersonaAvatar";
import { personaConfig } from "@/lib/personaConfig";
import { FileText, CheckCircle2, Mail, Phone, AlertTriangle, Sparkles } from "lucide-react";

// Lifecycle order: Sam → James → Katy → Troy → Jimmy → Rocco
const lifecycle = [
  {
    persona: personaConfig.sam,
    bucket: "0–30 days",
    action: "Friendly reminder sent",
    icon: Mail,
    collectedPct: 42,
  },
  {
    persona: personaConfig.james,
    bucket: "31–60 days",
    action: "Direct follow-up dispatched",
    icon: Mail,
    collectedPct: 28,
  },
  {
    persona: personaConfig.katy,
    bucket: "61–90 days",
    action: "Assertive call + email",
    icon: Phone,
    collectedPct: 15,
  },
  {
    persona: personaConfig.troy,
    bucket: "91–120 days",
    action: "Final warning issued",
    icon: AlertTriangle,
    collectedPct: 8,
  },
  {
    persona: personaConfig.jimmy,
    bucket: "121–150 days",
    action: "Pre-escalation notice",
    icon: AlertTriangle,
    collectedPct: 5,
  },
  {
    persona: personaConfig.rocco,
    bucket: "151+ days",
    action: "Final internal demand",
    icon: AlertTriangle,
    collectedPct: 2,
  },
];

const InvoiceLifecycleAnimation = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [collectedSteps, setCollectedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => {
        const next = (prev + 1) % lifecycle.length;
        if (next === 0) {
          // Reset cycle
          setCollectedSteps(new Set());
        } else {
          setCollectedSteps((s) => new Set(s).add(prev));
        }
        return next;
      });
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const active = lifecycle[activeStep];
  const ActionIcon = active.icon;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Lifecycle rail */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute top-7 left-0 right-0 h-0.5 bg-border/40" aria-hidden />
        <motion.div
          className="absolute top-7 left-0 h-0.5 bg-gradient-to-r from-primary via-accent to-primary"
          initial={{ width: "0%" }}
          animate={{
            width: `${((activeStep + 1) / lifecycle.length) * 100}%`,
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          aria-hidden
        />

        {/* Persona stops */}
        <div className="relative flex justify-between items-start">
          {lifecycle.map((step, i) => {
            const isActive = i === activeStep;
            const isCollected = collectedSteps.has(i);
            const isPast = i < activeStep;

            return (
              <div
                key={step.persona.name}
                className="flex flex-col items-center gap-2 flex-1 min-w-0"
              >
                {/* Avatar with active indicator */}
                <motion.div
                  className="relative"
                  animate={{
                    scale: isActive ? 1.15 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div
                    className="rounded-full p-0.5 transition-all"
                    style={{
                      boxShadow: isActive
                        ? `0 0 24px ${step.persona.color}66`
                        : "none",
                      border: isActive
                        ? `2px solid ${step.persona.color}`
                        : isPast
                          ? `2px solid ${step.persona.color}66`
                          : "2px solid hsl(var(--border))",
                    }}
                  >
                    <PersonaAvatar persona={step.persona} size="md" />
                  </div>

                  {/* Invoice traveling to this avatar */}
                  {isActive && (
                    <motion.div
                      key={`invoice-${activeStep}`}
                      className="absolute -top-2 -right-2"
                      initial={{ opacity: 0, y: -20, scale: 0.5 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    >
                      <div className="bg-card border border-primary/40 rounded-md p-1 shadow-lg">
                        <FileText className="h-3 w-3 text-primary" />
                      </div>
                    </motion.div>
                  )}

                  {/* Collected stamp */}
                  <AnimatePresence>
                    {isCollected && (
                      <motion.div
                        className="absolute -bottom-1 -right-1 bg-background rounded-full"
                        initial={{ opacity: 0, scale: 0, rotate: -45 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 15,
                        }}
                      >
                        <CheckCircle2
                          className="h-4 w-4"
                          style={{ color: step.persona.color }}
                          fill="hsl(var(--background))"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Name + bucket */}
                <div className="text-center">
                  <p
                    className="text-xs md:text-sm font-semibold leading-tight"
                    style={{
                      color: isActive || isPast ? step.persona.color : undefined,
                    }}
                  >
                    {step.persona.name}
                  </p>
                  <p className="text-[10px] md:text-xs text-muted-foreground leading-tight">
                    {step.bucket}
                  </p>
                </div>

                {/* Collected % chip */}
                <AnimatePresence>
                  {(isActive || isCollected) && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] md:text-xs font-semibold"
                      style={{
                        backgroundColor: `${step.persona.color}1A`,
                        color: step.persona.color,
                      }}
                    >
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {step.collectedPct}% collected
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active action card */}
      <div className="relative mt-8 h-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.persona.name}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <div
              className="inline-flex items-center gap-3 px-4 py-3 rounded-xl border bg-card/70 backdrop-blur-sm shadow-lg max-w-md"
              style={{ borderColor: `${active.persona.color}55` }}
            >
              <div
                className="rounded-lg p-2"
                style={{ backgroundColor: `${active.persona.color}1A` }}
              >
                <ActionIcon
                  className="h-4 w-4"
                  style={{ color: active.persona.color }}
                />
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-primary shrink-0" />
                  <span style={{ color: active.persona.color }}>
                    {active.persona.name}
                  </span>
                  <span className="text-muted-foreground font-normal">
                    · {active.bucket}
                  </span>
                </p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">
                  {active.action} — "{active.persona.punchline}"
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default InvoiceLifecycleAnimation;
