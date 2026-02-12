import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Brain, Zap, Shield, MessageSquare, TrendingUp } from "lucide-react";

const agents = [
  {
    name: "Sam",
    role: "Friendly Reminder Agent",
    range: "1–30 Days",
    tone: "Soft & Supportive",
    description: "Sam reaches out with gentle, collaborative messages to help resolve outstanding balances early — no pressure, just helpful reminders.",
    icon: <MessageSquare className="h-6 w-6" />,
    color: "from-blue-500 to-cyan-500",
  },
  {
    name: "James",
    role: "Professional Follow-Up Agent",
    range: "31–60 Days",
    tone: "Firm & Professional",
    description: "James escalates the tone with clear, professional communication emphasizing the importance of timely resolution.",
    icon: <TrendingUp className="h-6 w-6" />,
    color: "from-violet-500 to-purple-500",
  },
  {
    name: "Katy",
    role: "Resolution Specialist",
    range: "61–90 Days",
    tone: "Empathetic & Solution-Oriented",
    description: "Katy focuses on finding solutions — payment plans, settlements, and flexible arrangements to help debtors get back on track.",
    icon: <Brain className="h-6 w-6" />,
    color: "from-amber-500 to-orange-500",
  },
  {
    name: "Jimmy",
    role: "Escalation Agent",
    range: "91–120 Days",
    tone: "Direct & Urgent",
    description: "Jimmy communicates with urgency, clearly outlining consequences while still offering paths to resolution.",
    icon: <Zap className="h-6 w-6" />,
    color: "from-red-400 to-rose-500",
  },
  {
    name: "Troy",
    role: "Final Notice Agent",
    range: "121–150 Days",
    tone: "Authoritative",
    description: "Troy delivers final notices with authority, making it clear that immediate action is required to avoid further escalation.",
    icon: <Shield className="h-6 w-6" />,
    color: "from-slate-600 to-slate-800",
  },
  {
    name: "Rocco",
    role: "Collections Enforcer",
    range: "150+ Days",
    tone: "Decisive & Final",
    description: "Rocco handles the most delinquent accounts with decisive action, representing the last step before external collections.",
    icon: <Bot className="h-6 w-6" />,
    color: "from-gray-700 to-gray-900",
  },
];

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
      {/* Agent dots */}
      <div className="flex justify-center gap-2 mb-6">
        {agents.map((a, i) => (
          <button
            key={a.name}
            onClick={() => setActiveIndex(i)}
            className="relative"
          >
            <motion.div
              className={`h-10 w-10 rounded-full bg-gradient-to-br ${a.color} flex items-center justify-center text-white text-xs font-bold cursor-pointer`}
              animate={{
                scale: i === activeIndex ? 1.2 : 0.85,
                opacity: i === activeIndex ? 1 : 0.5,
              }}
              whileHover={{ scale: 1.1, opacity: 0.9 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              {a.name[0]}
            </motion.div>
            {i === activeIndex && (
              <motion.div
                layoutId="agent-indicator"
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-1 w-6 rounded-full bg-primary"
              />
            )}
          </button>
        ))}
      </div>

      {/* Agent card */}
      <div className="min-h-[180px] relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={agent.name}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className={`rounded-2xl bg-gradient-to-br ${agent.color} p-6 text-white shadow-xl`}
          >
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                {agent.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-xl font-bold">{agent.name}</h3>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{agent.range}</span>
                </div>
                <p className="text-white/80 text-sm font-medium mb-2">{agent.role} · {agent.tone}</p>
                <p className="text-white/70 text-sm leading-relaxed">{agent.description}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
