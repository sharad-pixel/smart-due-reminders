import { useEffect, useRef, useState, useMemo } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { ArrowRight, Brain, TrendingUp, ShieldCheck, Sparkles, FileSignature, CalendarClock, Receipt, ShieldAlert, Bell } from "lucide-react";
import { personaConfig } from "@/lib/personaConfig";
import StripeLogo from "@/components/brand/StripeLogo";

type Workflow = "collections" | "contracts";

/**
 * CinematicHero
 * A premium, cinematic SVG-based hero that visualizes:
 *   chaos (overdue invoices, risk) -> AI orchestration -> predictable cash flow
 *
 * Pure SVG + Framer Motion. Lightweight, responsive, themed via design tokens.
 */

type Phase = "chaos" | "orchestration" | "stable";

const PHASE_DURATIONS: Record<Phase, number> = {
  chaos: 3200,
  orchestration: 3600,
  stable: 4200,
};

const HEADLINES: string[] = [
  "Turn Revenue Risk Into Predictable Cash Flow",
  "Your Revenue Intelligence Platform — Powered by AI",
  "Centralized Receivables. Prioritized by Risk.",
  "AI-Powered Collections Workflows That Recover Cash",
  "Six AI Agents. Full Audit Trail. Zero Gaps.",
  "Risk-Based Prioritization. Predictable Cash Flow.",
  "From Overdue to Recovered — With Full Visibility",
  "Manage Risk. Recover Revenue. One Platform.",
  "Stop Chasing. Start Managing. Recover More.",
  "Turn Receivables Into Revenue — Systematically",
  "Know the Risk Before You Grow the Account",
];

// Map each account node to a persona by aging bucket
const ACCOUNTS = [
  { id: "a1", x: 110, y: 90, label: "Acme Co", invoices: 3, daysPastDue: 12, persona: "sam" },
  { id: "a2", x: 520, y: 70, label: "Globex", invoices: 4, daysPastDue: 45, persona: "james" },
  { id: "a3", x: 780, y: 150, label: "Initech", invoices: 2, daysPastDue: 78, persona: "katy" },
  { id: "a4", x: 80, y: 260, label: "Umbrella", invoices: 5, daysPastDue: 105, persona: "troy" },
  { id: "a5", x: 640, y: 380, label: "Wayne Ent", invoices: 3, daysPastDue: 140, persona: "jimmy" },
  { id: "a6", x: 290, y: 220, label: "Soylent", invoices: 4, daysPastDue: 22, persona: "sam" },
  { id: "a7", x: 800, y: 340, label: "Stark Ind", invoices: 6, daysPastDue: 165, persona: "rocco" },
  { id: "a8", x: 200, y: 400, label: "Hooli", invoices: 3, daysPastDue: 58, persona: "james" },
  { id: "a9", x: 460, y: 410, label: "Pied Piper", invoices: 2, daysPastDue: 95, persona: "troy" },
  { id: "a10", x: 360, y: 130, label: "Massive Dyn", invoices: 5, daysPastDue: 8, persona: "nicolas" },
  { id: "a11", x: 680, y: 230, label: "Tyrell Corp", invoices: 4, daysPastDue: 72, persona: "katy" },
  { id: "a12", x: 180, y: 170, label: "Cyberdyne", invoices: 3, daysPastDue: 38, persona: "james" },
  { id: "a13", x: 860, y: 50, label: "Aperture Sci", invoices: 2, daysPastDue: 18, persona: "sam" },
  { id: "a14", x: 380, y: 360, label: "Oscorp", invoices: 6, daysPastDue: 118, persona: "troy" },
  { id: "a15", x: 860, y: 430, label: "Weyland", invoices: 4, daysPastDue: 195, persona: "rocco" },
];

const CENTER = { x: 450, y: 230 };

// Auto-scrolling content for the floating activity cards
const AGENT_ITEMS = [
  { primary: "Sam · 0–30d", secondary: "Sent 24 reminders" },
  { primary: "James · 31–60d", secondary: "Negotiating 8 plans" },
  { primary: "Katy · 61–90d", secondary: "Escalated 5 accts" },
  { primary: "Troy · 91–120d", secondary: "Final notice ×3" },
  { primary: "Jimmy · 121–150d", secondary: "Legal review queue" },
  { primary: "Rocco · 151+", secondary: "Internal collections" },
  { primary: "Nicolas · Account", secondary: "Strategic outreach" },
];

const EXPANSION_ITEMS = [
  { primary: "Stark Ind", secondary: "Credit hold · $48k saved" },
  { primary: "Hooli", secondary: "Term tightened to NET15" },
  { primary: "Pied Piper", secondary: "Expansion paused" },
  { primary: "Wayne Ent", secondary: "Risk tier · High → Medium" },
  { primary: "Globex", secondary: "Limit reduced 30%" },
  { primary: "Initech", secondary: "Pre-bill review enabled" },
];

const PERFORMANCE_ITEMS = [
  { primary: "DSO", secondary: "↓ 42% in 90 days" },
  { primary: "Recovery Rate", secondary: "↑ 68%" },
  { primary: "Avg Days to Pay", secondary: "23d (was 41d)" },
  { primary: "Audit Trail", secondary: "100% documented" },
  { primary: "Auto-Sent", secondary: "1,284 messages / mo" },
  { primary: "Disputes Resolved", secondary: "94% within SLA" },
];

const CONTRACT_EXTRACTION_ITEMS = [
  { primary: "Acme_MSA_v3.pdf", secondary: "TCV $1.24M · 100% parsed" },
  { primary: "Globex_Order_2026.pdf", secondary: "ARR $412K · Net 45" },
  { primary: "Initech_SOW.docx", secondary: "3 perf obligations identified" },
  { primary: "Wayne_Renewal.pdf", secondary: "+5% escalator yr 2 / yr 3" },
  { primary: "Stark_Ind_MSA.pdf", secondary: "Auto-renew · 90d notice" },
];

const CONTRACT_TRIGGER_ITEMS = [
  { primary: "Acme · Non-renewal in 14d", secondary: "Notify CSM + Finance" },
  { primary: "Globex · Milestone due", secondary: "Phase 2 · $92K recapture" },
  { primary: "Initech · True-up window", secondary: "+18% usage detected" },
  { primary: "Wayne · Price escalator", secondary: "+$20.6K MRR yr 2" },
  { primary: "Stark · Liability cap flag", secondary: "Legal review queued" },
];

const CONTRACT_REVENUE_ITEMS = [
  { primary: "Backlog Recaptured", secondary: "$187K not yet billed" },
  { primary: "ARR Aligned", secondary: "$2.4M synced to AR" },
  { primary: "Missed Bills Found", secondary: "12 invoices · $64K" },
  { primary: "Renewals Watched", secondary: "47 contracts · auto" },
  { primary: "Audit Trail", secondary: "100% extraction logged" },
];


const CinematicHero = () => {
  const navigate = useNavigate();
  const prefersReduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("chaos");
  const [workflow, setWorkflow] = useState<Workflow>("collections");
  const [hoveredAccount, setHoveredAccount] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Workflow auto-cycle (every ~13s)
  useEffect(() => {
    if (prefersReduced) return;
    const id = setInterval(() => {
      setWorkflow((w) => (w === "collections" ? "contracts" : "collections"));
    }, 13000);
    return () => clearInterval(id);
  }, [prefersReduced]);


  // Phase loop
  useEffect(() => {
    if (prefersReduced) {
      setPhase("stable");
      return;
    }
    const next: Record<Phase, Phase> = {
      chaos: "orchestration",
      orchestration: "stable",
      stable: "chaos",
    };
    timerRef.current = setTimeout(() => setPhase(next[phase]), PHASE_DURATIONS[phase]);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, prefersReduced]);

  // Headline cycler — independent of phase loop
  const [headlineIdx, setHeadlineIdx] = useState(0);
  useEffect(() => {
    if (prefersReduced) return;
    const id = setInterval(() => {
      setHeadlineIdx((i) => (i + 1) % HEADLINES.length);
    }, 4200);
    return () => clearInterval(id);
  }, [prefersReduced]);

  // Animated metrics
  const metrics = useMemo(() => {
    if (phase === "chaos") {
      return { recovered: 0, atRisk: 18, actions: 0, score: 38 };
    }
    if (phase === "orchestration") {
      return { recovered: 142000, atRisk: 11, actions: 47, score: 62 };
    }
    return { recovered: 386500, atRisk: 3, actions: 128, score: 87 };
  }, [phase]);

  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden bg-[hsl(222_47%_5%)]">
      {/* Ambient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--accent)/0.12),transparent_55%)]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10 grid lg:grid-cols-2 gap-10 items-center py-16">
        {/* Left: Copy */}
        <div className="text-left max-w-xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            whileHover={{ scale: 1.04, y: -2 }}
            className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-6 backdrop-blur cursor-default transition-all duration-300 hover:border-primary/70 hover:bg-primary/20 hover:shadow-[0_0_24px_-2px_hsl(var(--primary)/0.5)]"
          >
            <Sparkles className="w-3.5 h-3.5 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
            <span className="transition-colors duration-300 group-hover:text-accent">
              AI-Powered Revenue Intelligence Command Center
            </span>
          </motion.div>

          {(() => {
            const phaseGradient =
              phase === "chaos"
                ? "from-rose-200 via-rose-300 to-destructive"
                : phase === "orchestration"
                  ? "from-amber-100 via-amber-200 to-primary"
                  : "from-emerald-100 via-emerald-200 to-emerald-400";
            return (
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-[1.15] tracking-tight mb-5 min-h-[3.8em]">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={headlineIdx}
                    initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -14, filter: "blur(6px)" }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className={`block px-1 bg-gradient-to-r ${phaseGradient} bg-clip-text text-transparent transition-colors duration-700`}
                  >
                    {HEADLINES[headlineIdx]}
                  </motion.span>
                </AnimatePresence>
              </h1>
            );
          })()}

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-base md:text-lg text-muted-foreground mb-8 leading-relaxed"
          >
            AI-powered collections, risk intelligence, and automated outreach — all in one system of record.
          </motion.p>

          <PlanCycler navigate={navigate} />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="flex flex-col items-start gap-3"
          >
            <button
              type="button"
              onClick={() => navigate("/stripe-collections")}
              className="group relative flex items-center gap-4 rounded-2xl border border-primary/20 bg-[hsl(222_47%_8%)]/80 px-5 py-4 shadow-lg shadow-primary/10 backdrop-blur transition-all hover:border-primary/50 hover:shadow-[0_0_36px_-6px_hsl(var(--primary)/0.45)]"
              aria-label="Set it and forget it with Stripe"
            >
              {/* Stripe tile */}
              <div className="flex items-center justify-center h-14 w-20 rounded-xl border border-[#635BFF]/30 bg-gradient-to-br from-[#635BFF]/15 to-[#635BFF]/5 transition-all group-hover:border-[#635BFF]/70 group-hover:shadow-[0_0_24px_-4px_#635BFF80]">
                <StripeLogo className="h-5 w-auto text-[#635BFF]" />
              </div>

              {/* Animated connector */}
              <div className="relative flex items-center w-10 h-px bg-gradient-to-r from-[#635BFF]/40 via-primary/60 to-primary/40">
                <motion.span
                  className="absolute -top-[3px] h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
                  animate={{ left: ["0%", "100%"] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>

              {/* Recouply tile */}
              <div className="flex items-center justify-center h-14 w-14 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 to-accent/5 transition-all group-hover:border-primary/70 group-hover:shadow-[0_0_24px_-4px_hsl(var(--primary)/0.6)]">
                <Brain className="h-6 w-6 text-primary" />
              </div>

              {/* Right-side label */}
              <div className="flex flex-col pl-1 pr-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
                  Stripe × Recouply.ai
                </span>
                <span className="text-base font-semibold text-foreground leading-tight">
                  Set it and forget it
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-primary mt-0.5 group-hover:gap-1.5 transition-all">
                  See how it works
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </button>
          </motion.div>

          {/* Phase pill */}
          <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
            <PhaseDot phase={phase} target="chaos" label="Detect risk" />
            <span className="opacity-30">→</span>
            <PhaseDot phase={phase} target="orchestration" label="AI orchestrates" />
            <span className="opacity-30">→</span>
            <PhaseDot phase={phase} target="stable" label="Recover cash" />
          </div>
        </div>

        {/* Right: Cinematic SVG Stage */}
        <div className="relative">
          {/* Workflow switcher */}
          <div className="mb-3 flex items-center gap-1 p-1 rounded-xl border border-primary/20 bg-[hsl(222_47%_7%)]/80 backdrop-blur w-fit">
            <WorkflowTab
              active={workflow === "collections"}
              onClick={() => setWorkflow("collections")}
              icon={Brain}
              label="Collections Intelligence"
            />
            <WorkflowTab
              active={workflow === "contracts"}
              onClick={() => setWorkflow("contracts")}
              icon={FileSignature}
              label="Contract Intelligence"
            />
          </div>

          <div className="relative rounded-2xl border border-primary/20 bg-[hsl(222_47%_7%)]/80 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden">
            {/* Top bar (command center chrome) */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10 bg-[hsl(222_47%_8%)]/80">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive/70" />
                <div className="w-2 h-2 rounded-full bg-amber-500/70" />
                <div className="w-2 h-2 rounded-full bg-emerald-500/70" />
                <span className="ml-3 text-[11px] uppercase tracking-widest text-muted-foreground font-mono">
                  recouply.ai · {workflow === "contracts" ? "contracts" : "live"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-primary">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                {workflow === "contracts"
                  ? phase === "chaos" ? "ingesting MSA" : phase === "orchestration" ? "extracting terms" : "triggers armed"
                  : phase === "chaos" ? "scanning AR" : phase === "orchestration" ? "AI orchestrating" : "cash flow stable"}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {workflow === "collections" ? (
                <motion.div key="collections" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                  <div className="border-b border-primary/10 bg-[hsl(222_47%_6%)]/60 px-4 py-3 min-h-[72px] flex items-center gap-4 flex-wrap">
                    <RiskScoreMeter score={metrics.score} phase={phase} />
                    <div className="h-10 w-px bg-primary/15 hidden md:block" />
                    <div className="flex-1 min-w-0">
                      <HoverPanel hovered={hoveredAccount} phase={phase} />
                    </div>
                  </div>
                  <div className="relative aspect-[16/10] w-full">
                    <Stage phase={phase} hovered={hoveredAccount} setHovered={setHoveredAccount} />
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 pointer-events-none">
                      <MetricChip label="Recovered" value={`$${formatNum(metrics.recovered)}`} tone="emerald" />
                      <MetricChip label="At-Risk Accts" value={`${metrics.atRisk}`} tone={metrics.atRisk > 10 ? "red" : "amber"} />
                      <MetricChip label="AI Actions" value={`${metrics.actions}`} tone="primary" />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="contracts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                  <ContractTopBar phase={phase} />
                  <div className="relative aspect-[16/10] w-full">
                    <ContractStage phase={phase} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Auto-scrolling activity cards — below the live stage */}
          <motion.div
            className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            {workflow === "collections" ? (
              <>
                <FloatingStat icon={Brain} label="AI Agents" items={AGENT_ITEMS} accent="primary" />
                <FloatingStat icon={ShieldCheck} label="Expansion Risk Mitigated" items={EXPANSION_ITEMS} accent="emerald" />
                <FloatingStat icon={TrendingUp} label="Performance" items={PERFORMANCE_ITEMS} accent="primary" />
              </>
            ) : (
              <>
                <FloatingStat icon={Sparkles} label="AI Extraction" items={CONTRACT_EXTRACTION_ITEMS} accent="primary" />
                <FloatingStat icon={CalendarClock} label="Key Date Triggers" items={CONTRACT_TRIGGER_ITEMS} accent="emerald" />
                <FloatingStat icon={Receipt} label="Revenue Recapture" items={CONTRACT_REVENUE_ITEMS} accent="primary" />
              </>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

/* ──────────────────────────────────────────────────────────────────────── */
/* Stage: the SVG cinematic scene                                          */
/* ──────────────────────────────────────────────────────────────────────── */

const Stage = ({
  phase,
  hovered,
  setHovered,
}: {
  phase: Phase;
  hovered: string | null;
  setHovered: (id: string | null) => void;
}) => {
  return (
    <svg
      viewBox="0 0 900 460"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
          <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="flowLine" x1="0" x2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="cashStream" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="hsl(142 70% 45%)" stopOpacity="0" />
          <stop offset="100%" stopColor="hsl(142 70% 55%)" stopOpacity="0.95" />
        </linearGradient>
        <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Connection lines (account -> center) */}
      {ACCOUNTS.map((a, i) => {
        const visible = phase !== "chaos";
        return (
          <motion.line
            key={`line-${a.id}`}
            x1={a.x}
            y1={a.y}
            x2={CENTER.x}
            y2={CENTER.y}
            stroke="url(#flowLine)"
            strokeWidth={hovered === a.id ? 2.2 : 1.2}
            strokeDasharray="4 6"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              pathLength: visible ? 1 : 0,
              opacity: visible ? (hovered === a.id ? 1 : 0.55) : 0,
            }}
            transition={{ duration: 1.1, delay: 0.05 * i, ease: "easeInOut" }}
          />
        );
      })}

      {/* Data pulses traveling from accounts to center (orchestration) */}
      {phase === "orchestration" &&
        ACCOUNTS.map((a, i) => (
          <motion.circle
            key={`pulse-${a.id}`}
            r={3}
            fill="hsl(var(--primary))"
            filter="url(#softGlow)"
            initial={{ cx: a.x, cy: a.y, opacity: 0 }}
            animate={{
              cx: [a.x, CENTER.x],
              cy: [a.y, CENTER.y],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.6,
              delay: 0.15 * i,
              repeat: Infinity,
              repeatDelay: 0.4,
              ease: "easeInOut",
            }}
          />
        ))}

      {/* Cash inflow streams (stable phase): account -> center, green/upward */}
      {phase === "stable" &&
        ACCOUNTS.map((a, i) => (
          <motion.circle
            key={`cash-${a.id}`}
            r={4}
            fill="hsl(142 70% 55%)"
            filter="url(#softGlow)"
            initial={{ cx: a.x, cy: a.y, opacity: 0 }}
            animate={{
              cx: [a.x, CENTER.x],
              cy: [a.y, CENTER.y],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2,
              delay: 0.2 * i,
              repeat: Infinity,
              repeatDelay: 0.5,
              ease: "easeInOut",
            }}
          />
        ))}

      {/* Drifting "broken" cash lines (chaos) */}
      {phase === "chaos" &&
        [0, 1, 2, 3].map((i) => (
          <motion.path
            key={`broken-${i}`}
            d={`M${50 + i * 200},${380 - i * 30} q60,-40 120,0 t120,0`}
            stroke="hsl(var(--destructive))"
            strokeOpacity={0.35}
            strokeWidth={1.4}
            strokeDasharray="3 8"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.5 }}
            transition={{ duration: 1.4, delay: i * 0.15, repeat: Infinity, repeatType: "reverse" }}
          />
        ))}

      {/* Central AI Core */}
      <g transform={`translate(${CENTER.x}, ${CENTER.y})`}>
        <motion.circle
          r={70}
          fill="url(#coreGlow)"
          animate={{
            scale: phase === "chaos" ? [0.6, 0.7, 0.6] : phase === "orchestration" ? [1, 1.15, 1] : [1, 1.05, 1],
            opacity: phase === "chaos" ? 0.45 : 1,
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.circle
          r={28}
          fill="hsl(222 47% 8%)"
          stroke="hsl(var(--primary))"
          strokeWidth={1.5}
          animate={{
            strokeOpacity: phase === "chaos" ? 0.3 : 1,
            r: phase === "orchestration" ? [28, 32, 28] : 28,
          }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Rotating ring */}
        <motion.g
          animate={{ rotate: phase === "chaos" ? 0 : 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        >
          <circle
            r={42}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeOpacity={0.5}
            strokeWidth={1}
            strokeDasharray="2 8"
          />
        </motion.g>
        <motion.g
          animate={{ rotate: phase === "chaos" ? 0 : -360 }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        >
          <circle
            r={56}
            fill="none"
            stroke="hsl(var(--accent))"
            strokeOpacity={0.35}
            strokeWidth={1}
            strokeDasharray="1 6"
          />
        </motion.g>
        {/* Recouply.ai brain logo */}
        <motion.g
          animate={{
            scale: phase === "orchestration" ? [1, 1.08, 1] : [1, 1.03, 1],
          }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Lucide Brain icon path, centered at 0,0 — original 24x24 viewBox, scaled ~1.5x */}
          <g
            transform="translate(-18, -18) scale(1.5)"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
            <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
            <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
            <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
            <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
            <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
            <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
            <path d="M6 18a4 4 0 0 1-1.967-.516" />
            <path d="M19.967 17.484A4 4 0 0 1 18 18" />
          </g>
        </motion.g>
      </g>

      {/* Persona avatar clip paths (defined once per account) */}
      <defs>
        {ACCOUNTS.map((a) => (
          <clipPath key={`clip-${a.id}`} id={`avatar-clip-${a.id}`}>
            <circle r={11} cx={a.x + 22} cy={a.y - 22} />
          </clipPath>
        ))}
      </defs>

      {/* Account nodes */}
      {ACCOUNTS.map((a, i) => {
        const isHovered = hovered === a.id;
        const persona = personaConfig[a.persona];
        const tone =
          phase === "chaos"
            ? "hsl(var(--destructive))"
            : phase === "orchestration"
              ? "hsl(38 92% 55%)"
              : "hsl(142 70% 50%)";
        return (
          <g
            key={a.id}
            transform={`translate(${a.x}, ${a.y})`}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHovered(a.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => setHovered(isHovered ? null : a.id)}
          >
            {/* Halo */}
            <motion.circle
              r={18}
              fill={tone}
              fillOpacity={isHovered ? 0.22 : 0.12}
              animate={{
                r: phase === "stable" ? [18, 22, 18] : 18,
              }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
            />
            <motion.circle
              r={9}
              fill="hsl(222 47% 9%)"
              stroke={tone}
              strokeWidth={1.6}
              animate={{ stroke: tone }}
              transition={{ duration: 0.8 }}
            />
            {/* Invoice mini-stack */}
            {Array.from({ length: Math.min(a.invoices, 4) }).map((_, k) => (
              <motion.rect
                key={k}
                x={-20 + k * 7}
                y={-30}
                width={6}
                height={9}
                rx={1}
                fill={phase === "stable" ? "hsl(142 60% 45%)" : "hsl(var(--muted-foreground))"}
                fillOpacity={phase === "chaos" ? 0.5 : 0.85}
                initial={{ y: -30, opacity: 0 }}
                animate={{
                  y: phase === "chaos" ? [-30, -34, -30] : -30,
                  opacity: 1,
                }}
                transition={{
                  duration: 1.6,
                  delay: i * 0.1 + k * 0.05,
                  repeat: phase === "chaos" ? Infinity : 0,
                }}
              />
            ))}

            {/* AI Persona avatar — appears during orchestration & stable */}
            {persona && (
              <motion.g
                initial={false}
                animate={{
                  opacity: phase === "chaos" ? 0 : 1,
                  scale: phase === "chaos" ? 0.6 : isHovered ? 1.15 : 1,
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{ transformOrigin: `22px -22px`, transformBox: "fill-box" } as React.CSSProperties}
              >
                {/* Outreach pulse ring (orchestration) */}
                {phase === "orchestration" && (
                  <motion.circle
                    cx={22}
                    cy={-22}
                    r={12}
                    fill="none"
                    stroke={persona.color}
                    strokeWidth={1.2}
                    initial={{ r: 12, opacity: 0.8 }}
                    animate={{ r: [12, 22, 12], opacity: [0.8, 0, 0.8] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.2 }}
                  />
                )}
                {/* Avatar background ring */}
                <circle
                  cx={22}
                  cy={-22}
                  r={12}
                  fill="hsl(222 47% 9%)"
                  stroke={persona.color}
                  strokeWidth={1.5}
                />
                <image
                  href={persona.avatar}
                  x={22 - 11}
                  y={-22 - 11}
                  width={22}
                  height={22}
                  clipPath={`url(#avatar-clip-${a.id})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              </motion.g>
            )}

            {/* Aging label (chaos only) */}
            {phase === "chaos" && (
              <motion.text
                y={26}
                textAnchor="middle"
                fontSize={9}
                fontFamily="ui-monospace, monospace"
                fill="hsl(var(--destructive))"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.15 }}
              >
                {a.daysPastDue}d
              </motion.text>
            )}

            {/* Persona tag (orchestration & stable) */}
            {phase !== "chaos" && persona && (
              <motion.text
                y={26}
                textAnchor="middle"
                fontSize={8.5}
                fontFamily="ui-monospace, monospace"
                fill={persona.color}
                fontWeight={600}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
              >
                {persona.name.toUpperCase()}
              </motion.text>
            )}

            {/* Account label */}
            <text
              y={40}
              textAnchor="middle"
              fontSize={9.5}
              fontFamily="ui-sans-serif, system-ui"
              fill="hsl(var(--muted-foreground))"
              opacity={isHovered ? 1 : 0.7}
            >
              {a.label}
            </text>
          </g>
        );
      })}

      {/* Floating dollar amounts (chaos -> orchestration) */}
      {phase !== "stable" &&
        [
          { x: 220, y: 60, v: "$4,200" },
          { x: 700, y: 130, v: "$12.8k" },
          { x: 80, y: 220, v: "$890" },
          { x: 820, y: 320, v: "$6,500" },
          { x: 380, y: 410, v: "$22,100" },
        ].map((d, i) => (
          <motion.text
            key={`dollar-${i}`}
            x={d.x}
            y={d.y}
            fontSize={11}
            fontFamily="ui-monospace, monospace"
            fill={phase === "chaos" ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
            fillOpacity={0.7}
            initial={{ opacity: 0, y: d.y + 10 }}
            animate={{
              opacity: [0, 0.8, 0],
              y: phase === "chaos" ? [d.y + 10, d.y - 10] : [d.y, CENTER.y],
              x: phase === "orchestration" ? [d.x, CENTER.x] : d.x,
            }}
            transition={{
              duration: phase === "chaos" ? 3 : 2,
              delay: i * 0.3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {d.v}
          </motion.text>
        ))}

      {/* Upward cash streams to dashboard top (stable) */}
      {phase === "stable" &&
        [200, 360, 540, 700].map((x, i) => (
          <motion.rect
            key={`stream-${i}`}
            x={x}
            width={2}
            height={40}
            fill="url(#cashStream)"
            initial={{ y: 460, opacity: 0 }}
            animate={{ y: [-50, -50], opacity: [0, 1, 0] }}
            transition={{
              duration: 1.6,
              delay: i * 0.25,
              repeat: Infinity,
              ease: "easeOut",
            }}
            style={{
              animationName: "rise",
            }}
          />
        ))}
    </svg>
  );
};

/* ──────────────────────────────────────────────────────────────────────── */
/* Sub-components                                                          */
/* ──────────────────────────────────────────────────────────────────────── */

const MetricChip = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "red" | "amber" | "primary";
}) => {
  const toneClass = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    red: "border-destructive/40 bg-destructive/10 text-destructive",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    primary: "border-primary/30 bg-primary/10 text-primary",
  }[tone];
  return (
    <motion.div
      key={value}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1 backdrop-blur ${toneClass}`}
    >
      <span className="text-[10px] uppercase tracking-wider opacity-80 font-medium">{label}</span>
      <span className="text-xs font-mono font-bold tabular-nums">{value}</span>
    </motion.div>
  );
};

const RiskScoreMeter = ({ score, phase }: { score: number; phase: Phase }) => {
  const tone =
    score < 50 ? "hsl(var(--destructive))" : score < 75 ? "hsl(38 92% 55%)" : "hsl(142 70% 50%)";
  return (
    <div className="rounded-lg border border-primary/20 bg-[hsl(222_47%_6%)]/80 backdrop-blur px-3 py-2 min-w-[180px]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
          Portfolio Risk Score
        </span>
        <motion.span
          key={score}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-mono font-bold tabular-nums"
          style={{ color: tone }}
        >
          {score}
        </motion.span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted/20 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: tone }}
          initial={false}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
      <div className="mt-1 text-[9px] text-muted-foreground font-mono">
        {phase === "chaos" ? "elevated · investigate" : phase === "orchestration" ? "ai stabilizing" : "healthy · trending up"}
      </div>
    </div>
  );
};

const HoverPanel = ({ hovered, phase }: { hovered: string | null; phase: Phase }) => {
  const account = ACCOUNTS.find((a) => a.id === hovered);
  if (!account) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse" />
        hover any account node above to inspect persona, aging & AI status
      </div>
    );
  }
  const persona = personaConfig[account.persona];
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 flex-wrap"
    >
      {persona && (
        <img
          src={persona.avatar}
          alt={persona.name}
          className="w-7 h-7 rounded-full ring-1 flex-shrink-0"
          style={{ borderColor: persona.color, boxShadow: `0 0 0 1px ${persona.color}` }}
        />
      )}
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase tracking-widest text-primary font-semibold leading-tight">
          {account.label}
        </span>
        {persona && (
          <span className="text-[10px] font-mono leading-tight" style={{ color: persona.color }}>
            {persona.name} · {account.daysPastDue}d past due
          </span>
        )}
      </div>
      <div className="h-6 w-px bg-primary/15 hidden sm:block" />
      <div className="text-[11px] font-mono text-foreground">
        {account.invoices} invoices ·{" "}
        <span className={phase === "stable" ? "text-emerald-400" : phase === "chaos" ? "text-destructive" : "text-amber-400"}>
          {phase === "stable" ? "↓ 64% risk" : phase === "chaos" ? "↑ high risk" : "AI engaged"}
        </span>
      </div>
    </motion.div>
  );
};

const FloatingStat = ({
  icon: Icon,
  label,
  items,
  accent = "primary",
}: {
  icon: typeof Brain;
  label: string;
  items: { primary: string; secondary: string }[];
  accent?: "primary" | "emerald";
}) => {
  const [idx, setIdx] = useState(0);
  const prefersReduced = useReducedMotion();
  useEffect(() => {
    if (prefersReduced) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % items.length), 2400);
    return () => clearInterval(id);
  }, [items.length, prefersReduced]);

  const accentClass =
    accent === "emerald"
      ? "border-emerald-500/30 shadow-emerald-500/10"
      : "border-primary/20 shadow-primary/10";
  const iconClass = accent === "emerald" ? "text-emerald-400" : "text-primary";
  const item = items[idx];

  return (
    <div
      className={`group flex items-center gap-2.5 rounded-xl border bg-[hsl(222_47%_8%)]/90 backdrop-blur px-3 py-2 shadow-lg w-full overflow-hidden ${accentClass}`}
    >
      <div className={`flex-shrink-0 rounded-md bg-background/40 p-1.5 ${iconClass}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium leading-tight mb-0.5 truncate">
          {label}
        </div>
        <div className="relative h-[28px] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
            >
              <div className="text-xs font-semibold text-white truncate leading-tight">
                {item.primary}
              </div>
              <div className={`text-[10px] font-mono truncate leading-tight ${iconClass}`}>
                {item.secondary}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const PhaseDot = ({ phase, target, label }: { phase: Phase; target: Phase; label: string }) => {
  const active = phase === target;
  return (
    <span className={`inline-flex items-center gap-1.5 transition-opacity ${active ? "opacity-100" : "opacity-80"}`}>
      <motion.span
        className="w-1.5 h-1.5 rounded-full"
        animate={{
          backgroundColor: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
          scale: active ? [1, 1.4, 1] : 1,
        }}
        transition={{ duration: 1.4, repeat: active ? Infinity : 0 }}
      />
      <span className={active ? "text-foreground font-medium" : "text-slate-300"}>{label}</span>
    </span>
  );
};

/* ──────────────────────────────────────────────────────────────────────── */

const formatNum = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toString();
};

type PlanCyclerProps = { navigate: (path: string) => void };

const PLANS = [
  { name: "Solo Pro", tagline: "Independents who bill on credit", path: "/solutions/solo-pro" },
  { name: "Startups", tagline: "Scale collections from day one", path: "/startups" },
  { name: "SMB", tagline: "Right-sized for growing finance teams", path: "/smb" },
  { name: "Enterprise", tagline: "Full-scale AR & risk deployment", path: "/enterprise" },
];

const PlanCycler = ({ navigate }: PlanCyclerProps) => {
  const [planIdx, setPlanIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPlanIdx((i) => (i + 1) % PLANS.length), 3200);
    return () => clearInterval(id);
  }, []);

  const current = PLANS[planIdx];

  return (
    <>
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight tracking-tight"
      >
        Plans for{" "}
        <span className="relative inline-block min-w-[10ch] align-baseline">
          <AnimatePresence mode="wait">
            <motion.button
              key={current.name}
              onClick={() => navigate(current.path)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent hover:opacity-80 transition-opacity"
            >
              {current.name}
            </motion.button>
          </AnimatePresence>
        </span>
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.22 }}
        className="flex items-center gap-3 mb-6 min-h-[1.75rem]"
      >
        <AnimatePresence mode="wait">
          <motion.p
            key={current.tagline}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45 }}
            className="text-base md:text-lg text-muted-foreground"
          >
            {current.tagline}
          </motion.p>
        </AnimatePresence>
        <button
          onClick={() => navigate("/pricing")}
          className="text-sm md:text-base font-semibold text-primary hover:underline underline-offset-4 whitespace-nowrap"
        >
          See pricing →
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.24 }}
        className="flex flex-wrap items-center gap-2 mb-8"
      >
        {PLANS.map((p, i) => (
          <button
            key={p.path}
            onClick={() => {
              setPlanIdx(i);
              navigate(p.path);
            }}
            className={`text-xs md:text-sm px-3 py-1.5 rounded-full border transition-all ${
              i === planIdx
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-background/40 border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30"
            }`}
          >
            {p.name}
          </button>
        ))}
      </motion.div>
    </>
  );
};

/* ──────────────────────────────────────────────────────────────────────── */
/* Workflow switcher + Contract Intelligence stage                          */
/* ──────────────────────────────────────────────────────────────────────── */

const WorkflowTab = ({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Brain;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
      active
        ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.4)]"
        : "text-muted-foreground hover:text-foreground"
    }`}
  >
    <Icon className="h-3.5 w-3.5" />
    <span className="hidden sm:inline">{label}</span>
    <span className="sm:hidden">{label.split(" ")[0]}</span>
    {active && (
      <motion.span
        layoutId="workflow-tab-glow"
        className="absolute inset-0 rounded-lg ring-1 ring-primary/40 pointer-events-none"
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      />
    )}
  </button>
);

const ContractTopBar = ({ phase }: { phase: Phase }) => {
  const parsed = phase === "chaos" ? 0 : phase === "orchestration" ? 64 : 100;
  const triggers = phase === "chaos" ? 0 : phase === "orchestration" ? 6 : 14;
  return (
    <div className="border-b border-primary/10 bg-[hsl(222_47%_6%)]/60 px-4 py-3 min-h-[72px] flex items-center gap-4 flex-wrap">
      <div className="rounded-lg border border-primary/20 bg-[hsl(222_47%_6%)]/80 backdrop-blur px-3 py-2 min-w-[180px]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
            MSA · Extraction
          </span>
          <motion.span
            key={parsed}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-mono font-bold tabular-nums text-primary"
          >
            {parsed}%
          </motion.span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted/20 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-primary"
            initial={false}
            animate={{ width: `${parsed}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </div>
        <div className="mt-1 text-[9px] text-muted-foreground font-mono">
          {phase === "chaos" ? "ingesting document" : phase === "orchestration" ? "parsing terms" : "indexed · searchable"}
        </div>
      </div>
      <div className="h-10 w-px bg-primary/15 hidden md:block" />
      <div className="flex items-center gap-3 text-[11px] font-mono text-foreground flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <FileSignature className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-indigo-300">Acme_MSA_v3.pdf</span>
        </div>
        <span className="opacity-30">·</span>
        <span className="text-muted-foreground">{triggers} triggers armed</span>
        <span className="opacity-30 hidden sm:inline">·</span>
        <span className="text-emerald-400 hidden sm:inline">$1.24M TCV</span>
      </div>
    </div>
  );
};

// Contract Intelligence cinematic stage
const ContractStage = ({ phase }: { phase: Phase }) => {
  const visible = phase !== "chaos";
  const fields = [
    { k: "TCV", v: "$1.24M" },
    { k: "ARR", v: "$412K" },
    { k: "MRR", v: "$34.3K" },
    { k: "ACV", v: "$412K" },
    { k: "Term", v: "36 mo · auto" },
    { k: "Notice", v: "90 days" },
    { k: "Escalator", v: "+5% / +5%" },
    { k: "Payment", v: "Net 45" },
  ];
  const obligations = [
    { name: "Platform license", pct: 62, amt: "$255K" },
    { name: "Implementation", pct: 22, amt: "$92K" },
    { name: "Premium support", pct: 16, amt: "$65K" },
  ];
  const triggers = [
    { icon: CalendarClock, label: "Non-renewal · 14d", tone: "hsl(38 92% 55%)" },
    { icon: ShieldAlert, label: "Liability cap < 1x ARR", tone: "hsl(var(--destructive))" },
    { icon: Receipt, label: "Milestone · Phase 2", tone: "hsl(var(--primary))" },
    { icon: Bell, label: "Backlog: $187K", tone: "hsl(142 70% 50%)" },
  ];

  return (
    <div className="absolute inset-0 p-4 grid grid-cols-12 gap-3 overflow-hidden">
      {/* Ambient grid */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Left: contract document being scanned */}
      <div className="col-span-4 relative rounded-lg border border-indigo-400/25 bg-[hsl(222_47%_8%)]/70 overflow-hidden">
        <div className="px-2.5 py-1.5 border-b border-indigo-400/20 flex items-center gap-1.5">
          <FileSignature className="h-3 w-3 text-indigo-300" />
          <span className="text-[9px] font-mono text-indigo-200 uppercase tracking-wider truncate">
            Acme_MSA_v3.pdf
          </span>
        </div>
        <div className="relative p-2 space-y-1">
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.div
              key={i}
              className="h-1 rounded-full bg-muted-foreground/30"
              style={{ width: `${50 + ((i * 37) % 45)}%` }}
              initial={{ opacity: 0.2 }}
              animate={{
                opacity: phase === "chaos" ? [0.2, 0.6, 0.2] : phase === "orchestration" ? [0.4, 0.9, 0.4] : 0.6,
                backgroundColor:
                  phase === "stable" ? "hsl(var(--primary) / 0.5)" : "hsl(var(--muted-foreground) / 0.3)",
              }}
              transition={{ duration: 1.4, repeat: phase !== "stable" ? Infinity : 0, delay: i * 0.05 }}
            />
          ))}
          {/* Scan line */}
          {phase !== "stable" && (
            <motion.div
              className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_12px_hsl(238_84%_67%)]"
              initial={{ top: 0 }}
              animate={{ top: ["0%", "100%", "0%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>
      </div>

      {/* Center: AI core + flow lines */}
      <div className="col-span-4 relative flex items-center justify-center">
        <svg viewBox="0 0 200 300" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <radialGradient id="contractCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(238 84% 67%)" stopOpacity="0.85" />
              <stop offset="60%" stopColor="hsl(238 84% 67%)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="hsl(238 84% 67%)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Inflow lines from doc (left) */}
          {[60, 120, 180, 240].map((y, i) => (
            <motion.line
              key={`in-${i}`}
              x1={0}
              y1={y}
              x2={100}
              y2={150}
              stroke="hsl(238 84% 67%)"
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeDasharray="3 5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: visible ? 1 : 0.2 }}
              transition={{ duration: 1, delay: i * 0.1 }}
            />
          ))}
          {/* Outflow lines to triggers (right) */}
          {[60, 120, 180, 240].map((y, i) => (
            <motion.line
              key={`out-${i}`}
              x1={100}
              y1={150}
              x2={200}
              y2={y}
              stroke="hsl(var(--primary))"
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeDasharray="3 5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: phase === "stable" ? 1 : phase === "orchestration" ? 0.7 : 0 }}
              transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
            />
          ))}

          {/* Data pulses inbound */}
          {phase === "orchestration" &&
            [60, 120, 180, 240].map((y, i) => (
              <motion.circle
                key={`pulse-in-${i}`}
                r={2.5}
                fill="hsl(238 84% 70%)"
                initial={{ cx: 0, cy: y, opacity: 0 }}
                animate={{ cx: [0, 100], cy: [y, 150], opacity: [0, 1, 0] }}
                transition={{ duration: 1.4, delay: i * 0.2, repeat: Infinity, repeatDelay: 0.3 }}
              />
            ))}
          {/* Data pulses outbound */}
          {phase !== "chaos" &&
            [60, 120, 180, 240].map((y, i) => (
              <motion.circle
                key={`pulse-out-${i}`}
                r={2.5}
                fill="hsl(var(--primary))"
                initial={{ cx: 100, cy: 150, opacity: 0 }}
                animate={{ cx: [100, 200], cy: [150, y], opacity: [0, 1, 0] }}
                transition={{ duration: 1.4, delay: 0.4 + i * 0.2, repeat: Infinity, repeatDelay: 0.3 }}
              />
            ))}

          {/* Core */}
          <g transform="translate(100, 150)">
            <motion.circle
              r={50}
              fill="url(#contractCore)"
              animate={{ scale: phase === "orchestration" ? [1, 1.15, 1] : [1, 1.05, 1] }}
              transition={{ duration: 2.4, repeat: Infinity }}
            />
            <motion.g animate={{ rotate: 360 }} transition={{ duration: 22, repeat: Infinity, ease: "linear" }}>
              <circle r={32} fill="none" stroke="hsl(238 84% 67%)" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="2 6" />
            </motion.g>
            <circle r={22} fill="hsl(222 47% 8%)" stroke="hsl(238 84% 67%)" strokeWidth={1.5} />
            <g
              transform="translate(-10, -10)"
              fill="none"
              stroke="hsl(238 84% 75%)"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* FileSignature glyph */}
              <path d="M14 0H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6Z" />
              <path d="M14 0v6h6" />
              <path d="M5 14c1.5-1 2.5-1 4 0s2.5 1 4 0" />
            </g>
          </g>
        </svg>
      </div>

      {/* Right: extracted fields + triggers */}
      <div className="col-span-4 relative flex flex-col gap-2 min-h-0">
        {/* Extracted fields card */}
        <div className="rounded-lg border border-primary/20 bg-[hsl(222_47%_8%)]/80 backdrop-blur p-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">
              Extracted fields
            </span>
            <Sparkles className="h-3 w-3 text-indigo-300" />
          </div>
          <div className="grid grid-cols-2 gap-1">
            {fields.slice(0, 6).map((f, i) => (
              <motion.div
                key={f.k}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: visible ? 1 : 0.2, x: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex items-center justify-between gap-1 rounded bg-muted/10 px-1.5 py-0.5"
              >
                <span className="text-[8px] text-muted-foreground truncate">{f.k}</span>
                <span className="text-[8.5px] font-mono font-semibold text-foreground truncate">{f.v}</span>
              </motion.div>
            ))}
          </div>
          {/* Performance obligations */}
          <div className="mt-2 pt-1.5 border-t border-primary/10 space-y-1">
            {obligations.map((o, i) => (
              <div key={o.name}>
                <div className="flex justify-between text-[8px] mb-0.5">
                  <span className="text-muted-foreground truncate">{o.name}</span>
                  <span className="font-mono text-foreground/80">{o.amt}</span>
                </div>
                <div className="h-1 rounded-full bg-muted/20 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-primary"
                    initial={{ width: 0 }}
                    animate={{ width: visible ? `${o.pct}%` : "0%" }}
                    transition={{ duration: 1.1, delay: 0.3 + i * 0.1, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Triggers card */}
        <div className="rounded-lg border border-primary/20 bg-[hsl(222_47%_8%)]/80 backdrop-blur p-2 flex-1 min-h-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium">
              Custom triggers
            </span>
            <Bell className="h-3 w-3 text-indigo-300" />
          </div>
          <div className="space-y-1">
            {triggers.map((t, i) => (
              <motion.div
                key={t.label}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: phase === "chaos" ? 0.2 : 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-1.5 rounded bg-muted/10 px-1.5 py-1"
              >
                <div
                  className="h-4 w-4 rounded flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${t.tone.replace(")", " / 0.15)")}`, color: t.tone }}
                >
                  <t.icon className="h-2.5 w-2.5" />
                </div>
                <span className="text-[9px] font-medium text-foreground truncate flex-1">{t.label}</span>
                {phase === "stable" && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_hsl(142_70%_50%)]"
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CinematicHero;
