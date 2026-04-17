import { useEffect, useRef, useState, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, TrendingUp, ShieldCheck, Sparkles } from "lucide-react";

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

const ACCOUNTS = [
  { id: "a1", x: 120, y: 120, label: "Acme Co", invoices: 3 },
  { id: "a2", x: 520, y: 90, label: "Globex", invoices: 4 },
  { id: "a3", x: 760, y: 200, label: "Initech", invoices: 2 },
  { id: "a4", x: 140, y: 320, label: "Umbrella", invoices: 5 },
  { id: "a5", x: 620, y: 360, label: "Wayne Ent", invoices: 3 },
  { id: "a6", x: 320, y: 240, label: "Soylent", invoices: 4 },
];

const CENTER = { x: 450, y: 230 };

const CinematicHero = () => {
  const navigate = useNavigate();
  const prefersReduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("chaos");
  const [hoveredAccount, setHoveredAccount] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-6 backdrop-blur"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Collections & Risk Command Center
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-foreground mb-5"
          >
            Turn Revenue Risk Into{" "}
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              Predictable Cash Flow
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-base md:text-lg text-muted-foreground mb-8 leading-relaxed"
          >
            AI-powered collections, risk intelligence, and automated outreach — all in one system of record.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="flex flex-wrap gap-3"
          >
            <Button
              size="lg"
              onClick={() => navigate("/collections-assessment")}
              className="text-base px-6 py-6 shadow-lg shadow-primary/30 group"
            >
              Start Your Risk Assessment
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/demo")}
              className="text-base px-6 py-6 border-primary/30 hover:bg-primary/5"
            >
              See Live Demo
            </Button>
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
          <div className="relative rounded-2xl border border-primary/20 bg-[hsl(222_47%_7%)]/80 backdrop-blur-xl shadow-2xl shadow-primary/10 overflow-hidden">
            {/* Top bar (command center chrome) */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10 bg-[hsl(222_47%_8%)]/80">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive/70" />
                <div className="w-2 h-2 rounded-full bg-amber-500/70" />
                <div className="w-2 h-2 rounded-full bg-emerald-500/70" />
                <span className="ml-3 text-[11px] uppercase tracking-widest text-muted-foreground font-mono">
                  recouply.ai · live
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-primary">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                {phase === "chaos" && "scanning AR"}
                {phase === "orchestration" && "AI orchestrating"}
                {phase === "stable" && "cash flow stable"}
              </div>
            </div>

            {/* Stage */}
            <div className="relative aspect-[16/10] w-full">
              <Stage phase={phase} hovered={hoveredAccount} setHovered={setHoveredAccount} />

              {/* Metrics overlay */}
              <div className="absolute top-3 left-3 right-3 flex flex-wrap gap-2 pointer-events-none">
                <MetricChip label="Recovered" value={`$${formatNum(metrics.recovered)}`} tone="emerald" />
                <MetricChip label="At-Risk Accts" value={`${metrics.atRisk}`} tone={metrics.atRisk > 10 ? "red" : "amber"} />
                <MetricChip label="AI Actions" value={`${metrics.actions}`} tone="primary" />
              </div>

              {/* Risk score meter */}
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                <RiskScoreMeter score={metrics.score} phase={phase} />
                <HoverPanel hovered={hoveredAccount} phase={phase} />
              </div>
            </div>
          </div>

          {/* Floating quick stats */}
          <motion.div
            className="hidden md:flex absolute -left-6 top-1/3 -translate-y-1/2 flex-col gap-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <FloatingStat icon={Brain} label="6 AI Agents" />
            <FloatingStat icon={ShieldCheck} label="Audit-Ready" />
            <FloatingStat icon={TrendingUp} label="↓ 42% DSO" />
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
        {/* Brain glyph */}
        <text
          textAnchor="middle"
          dominantBaseline="central"
          y={1}
          fontSize={11}
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          fill="hsl(var(--primary))"
          fontWeight={700}
          letterSpacing={1.5}
        >
          AI
        </text>
      </g>

      {/* Account nodes */}
      {ACCOUNTS.map((a, i) => {
        const isHovered = hovered === a.id;
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
          >
            {/* Halo */}
            <motion.circle
              r={isHovered ? 26 : 18}
              fill={tone}
              fillOpacity={0.12}
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
                {[30, 60, 90, 60, 90, 30][i]}d
              </motion.text>
            )}
            {/* Account label */}
            <text
              y={42}
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
      <div className="hidden md:block rounded-lg border border-primary/10 bg-[hsl(222_47%_6%)]/60 backdrop-blur px-3 py-2 text-[10px] text-muted-foreground font-mono max-w-[200px]">
        hover an account node to inspect
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-primary/30 bg-[hsl(222_47%_6%)]/90 backdrop-blur px-3 py-2 min-w-[180px]"
    >
      <div className="text-[10px] uppercase tracking-widest text-primary font-medium">{account.label}</div>
      <div className="text-xs font-mono mt-0.5 text-foreground">
        {account.invoices} invoices · {phase === "stable" ? "↓ 64% risk" : phase === "chaos" ? "↑ high risk" : "AI engaged"}
      </div>
    </motion.div>
  );
};

const FloatingStat = ({ icon: Icon, label }: { icon: typeof Brain; label: string }) => (
  <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-[hsl(222_47%_8%)]/90 backdrop-blur px-3 py-1.5 shadow-lg shadow-primary/10">
    <Icon className="w-3.5 h-3.5 text-primary" />
    <span className="text-xs font-medium text-foreground whitespace-nowrap">{label}</span>
  </div>
);

const PhaseDot = ({ phase, target, label }: { phase: Phase; target: Phase; label: string }) => {
  const active = phase === target;
  return (
    <span className={`inline-flex items-center gap-1.5 transition-opacity ${active ? "opacity-100" : "opacity-40"}`}>
      <motion.span
        className="w-1.5 h-1.5 rounded-full"
        animate={{
          backgroundColor: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
          scale: active ? [1, 1.4, 1] : 1,
        }}
        transition={{ duration: 1.4, repeat: active ? Infinity : 0 }}
      />
      <span className={active ? "text-foreground font-medium" : ""}>{label}</span>
    </span>
  );
};

/* ──────────────────────────────────────────────────────────────────────── */

const formatNum = (n: number) => {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toString();
};

export default CinematicHero;
