import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CheckCircle2, Mail, Zap } from "lucide-react";

type Persona = {
  name: string;
  role: string;
  tone: "Friendly" | "Professional" | "Firm";
  toneColor: string;
  accent: string;
  avatar: string;
  draft: string;
  meta: string;
};

const personas: Persona[] = [
  {
    name: "Sam",
    role: "1–30 days past due",
    tone: "Friendly",
    toneColor: "hsl(142 76% 45%)",
    accent: "from-emerald-400/30 to-emerald-600/10",
    avatar: "S",
    draft:
      "Hi Maya — quick nudge that invoice #4821 ($12,400) is now 6 days past due. Already paid? Ignore this. Otherwise, here's a one-click pay link 👇",
    meta: "Acme Corp · low risk · paydex 78",
  },
  {
    name: "James",
    role: "31–60 days past due",
    tone: "Professional",
    toneColor: "hsl(38 92% 50%)",
    accent: "from-amber-400/30 to-orange-500/10",
    avatar: "J",
    draft:
      "Maya, following up on invoice #4821 — now 38 days past due. Could you confirm the expected payment date today, or let me know if there's an issue we should resolve?",
    meta: "Acme Corp · medium risk · escalation queued",
  },
  {
    name: "Katy",
    role: "61–90 days past due",
    tone: "Firm",
    toneColor: "hsl(0 84% 60%)",
    accent: "from-rose-500/30 to-red-600/10",
    avatar: "K",
    draft:
      "Maya — invoice #4821 is now 67 days past due. Per our terms, this account is at risk of suspension. Please remit payment by Friday or contact us today to arrange a payment plan.",
    meta: "Acme Corp · high risk · CFO CC'd",
  },
];

const AIPersonaChatStream = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [isTypingDone, setIsTypingDone] = useState(false);
  const [sentBubbles, setSentBubbles] = useState<number[]>([]);
  const cancelRef = useRef(false);

  // Cycle through personas
  useEffect(() => {
    cancelRef.current = false;
    setTypedText("");
    setIsTypingDone(false);

    const persona = personas[activeIdx];
    const fullText = persona.draft;
    let i = 0;

    const typer = setInterval(() => {
      if (cancelRef.current) return;
      i++;
      setTypedText(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(typer);
        setIsTypingDone(true);
        // Mark as sent after a beat
        setTimeout(() => {
          if (cancelRef.current) return;
          setSentBubbles((prev) => [...prev, activeIdx]);
        }, 700);
        // Move to next persona
        setTimeout(() => {
          if (cancelRef.current) return;
          setActiveIdx((prev) => (prev + 1) % personas.length);
        }, 2400);
      }
    }, 22);

    return () => {
      cancelRef.current = true;
      clearInterval(typer);
    };
  }, [activeIdx]);

  // Reset sent bubbles when we loop back
  useEffect(() => {
    if (activeIdx === 0 && sentBubbles.length >= personas.length) {
      setSentBubbles([]);
    }
  }, [activeIdx, sentBubbles.length]);

  const persona = personas[activeIdx];

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Cinematic glow backdrop */}
      <motion.div
        aria-hidden
        className={`absolute -inset-8 bg-gradient-to-br ${persona.accent} blur-3xl rounded-[3rem] -z-10`}
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Floating particles */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden rounded-3xl pointer-events-none">
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/60"
            style={{
              left: `${(i * 73) % 100}%`,
              top: `${(i * 41) % 100}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0, 0.8, 0],
              scale: [0.5, 1.2, 0.5],
            }}
            transition={{
              duration: 4 + (i % 3),
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Console frame */}
      <div className="relative bg-card/80 backdrop-blur-xl border border-border/60 rounded-3xl shadow-2xl shadow-primary/10 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
            <span className="ml-3 text-xs font-mono text-muted-foreground">
              recouply.ai · live outreach console
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-emerald-500"
              animate={{ opacity: [1, 0.3, 1], scale: [1, 1.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="font-medium">AI agents online</span>
          </div>
        </div>

        {/* Persona switcher rail */}
        <div className="flex items-center gap-2 px-5 pt-4">
          {personas.map((p, idx) => (
            <button
              key={p.name}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                idx === activeIdx
                  ? "bg-primary/15 text-foreground border border-primary/30"
                  : "bg-muted/40 text-muted-foreground border border-transparent hover:text-foreground"
              }`}
              aria-label={`Switch to ${p.name}`}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: p.toneColor }}
              >
                {p.avatar}
              </span>
              {p.name} · {p.tone}
            </button>
          ))}
        </div>

        {/* Chat area */}
        <div className="relative p-5 pt-4 min-h-[280px]">
          {/* Context line */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`ctx-${activeIdx}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-between mb-4 text-xs"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span>Risk-scored · workflow step {activeIdx + 1}/3 · {persona.role}</span>
              </div>
              <div className="text-muted-foreground/80 font-mono">{persona.meta}</div>
            </motion.div>
          </AnimatePresence>

          {/* Active draft bubble */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`draft-${activeIdx}`}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex gap-3"
            >
              {/* Avatar */}
              <motion.div
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg"
                style={{
                  backgroundColor: persona.toneColor,
                  boxShadow: `0 0 24px ${persona.toneColor}55`,
                }}
                animate={{
                  boxShadow: [
                    `0 0 20px ${persona.toneColor}40`,
                    `0 0 36px ${persona.toneColor}80`,
                    `0 0 20px ${persona.toneColor}40`,
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {persona.avatar}
              </motion.div>

              {/* Bubble */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-foreground">{persona.name}</span>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{
                      color: persona.toneColor,
                      backgroundColor: `${persona.toneColor}15`,
                    }}
                  >
                    {persona.tone}
                  </span>
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI draft · human approved
                  </span>
                </div>

                <div className="relative bg-background border border-border/80 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-foreground leading-relaxed text-left shadow-sm">
                  {typedText}
                  {!isTypingDone && (
                    <motion.span
                      className="inline-block w-[2px] h-[1.1em] bg-primary ml-0.5 align-middle"
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                    />
                  )}

                  {/* Sent confirmation */}
                  <AnimatePresence>
                    {sentBubbles.includes(activeIdx) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute -bottom-2.5 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-semibold shadow-lg"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Sent
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Channel indicator */}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </span>
                  <span>·</span>
                  <span>Logged to audit trail</span>
                  <span>·</span>
                  <span>Tone shifts automatically as DPD increases</span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Progress bar */}
          <div className="mt-6 flex items-center gap-2">
            {personas.map((_, idx) => (
              <div
                key={idx}
                className="h-1 flex-1 rounded-full bg-muted overflow-hidden"
              >
                <motion.div
                  className="h-full"
                  style={{ backgroundColor: personas[idx].toneColor }}
                  initial={{ width: "0%" }}
                  animate={{
                    width:
                      idx < activeIdx || sentBubbles.includes(idx)
                        ? "100%"
                        : idx === activeIdx
                        ? isTypingDone
                          ? "100%"
                          : "60%"
                        : "0%",
                  }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Caption under console */}
      <p className="text-xs text-muted-foreground mt-4 text-center">
        Six AI agents draft tone-perfect outreach. Your team approves and ships — every message logged, every outcome tracked.
      </p>
    </div>
  );
};

export default AIPersonaChatStream;
