import { useState, useEffect, useRef } from "react";
import { PersonaAvatar } from "@/components/PersonaAvatar";
import { Badge } from "@/components/ui/badge";
import MarketingLayout from "@/components/MarketingLayout";
import { personaConfig } from "@/lib/personaConfig";
import { MessageSquare, Target, Clock, TrendingUp, Slack, ChevronDown } from "lucide-react";
import { motion, AnimatePresence, useInView } from "framer-motion";

const sampleMessages: Record<string, string[]> = {
  nicolas: [
    "Hi [Customer Name], I'm reaching out regarding your account with [Business Name]. You currently have [X] open invoices totaling $[AMOUNT]. I wanted to check in and see if there's anything we can help with – whether that's answering questions, providing documentation, or discussing payment options.",
    "Hello [Customer Name], this is a friendly account summary. Your current balance is $[AMOUNT] across [X] invoices. Please let us know if you'd like to discuss your account or need any assistance.",
  ],
  sam: [
    "Hi [Customer Name], just a friendly reminder that Invoice #[NUMBER] for $[AMOUNT] was due on [DATE]. We'd love to help you get this sorted! Let us know if you need a payment link or have any questions. 😊",
    "Hey [Customer Name], checking in on Invoice #[NUMBER]. We know things can get busy – is there anything we can do to make payment easier for you?",
  ],
  james: [
    "Hi [Customer Name], Invoice #[NUMBER] for $[AMOUNT] is now [X] days overdue. Please remit payment at your earliest convenience. We're here if you need assistance or payment arrangements.",
    "Following up on Invoice #[NUMBER] – we haven't received payment yet. Let's work together to resolve this. Reply to discuss payment options.",
  ],
  katy: [
    "Urgent: Invoice #[NUMBER] for $[AMOUNT] is [X] days overdue. Immediate payment is required to avoid additional actions. Contact us today to resolve this matter.",
    "[Customer Name], this is a serious notice regarding Invoice #[NUMBER]. Payment is significantly overdue. We must resolve this within 24 hours or escalate next steps.",
  ],
  troy: [
    "URGENT ACTION REQUIRED: Invoice #[NUMBER] for $[AMOUNT] is critically overdue ([X] days). Payment must be received immediately or we will proceed with formal collection proceedings.",
    "[Customer Name], Invoice #[NUMBER] remains unpaid after multiple attempts. This is your final opportunity to settle before we pursue legal remedies.",
  ],
  jimmy: [
    "LEGAL NOTICE: Invoice #[NUMBER] for $[AMOUNT] is [X] days overdue. This matter will be referred to our legal team within 48 hours unless full payment is received.",
    "DEMAND FOR PAYMENT: Invoice #[NUMBER] ($[AMOUNT]) – Final notice before legal action. We are prepared to file suit and pursue all available remedies.",
  ],
  rocco: [
    "Your account with [Business Name] has an overdue balance of $[AMOUNT] associated with Invoice #[NUMBER], which remains unpaid despite multiple prior requests. Please submit payment today.",
    "This is a follow-up on your overdue balance of $[AMOUNT] for Invoice #[NUMBER], which has now entered our Final Internal Collections stage.",
  ],
};

const strategies: Record<string, { approach: string; tactics: string[]; goal: string }> = {
  nicolas: {
    approach: "Supportive and relationship-building",
    tactics: [
      "Account-level communication (not invoice-specific)",
      "Proactive support and assistance offers",
      "Summarize total balance across all invoices",
      "Answer questions and provide documentation",
      "Build trust and maintain long-term relationships",
      "Connect users to Support on Slack for escalations",
    ],
    goal: "Provide helpful account support and encourage engagement before escalation",
  },
  sam: {
    approach: "Friendly and relationship-focused",
    tactics: [
      "Use warm, conversational language",
      "Assume good intent and simple oversight",
      "Offer help and assistance proactively",
      "Include easy payment options",
      "Maintain positive customer relationship",
    ],
    goal: "Gentle reminder that preserves goodwill and encourages quick payment",
  },
  james: {
    approach: "Professional and direct",
    tactics: [
      "Clear business communication tone",
      "State facts without emotion",
      "Provide deadline expectations",
      "Offer structured payment solutions",
      "Balance firmness with professionalism",
    ],
    goal: "Create urgency while maintaining professional relationship",
  },
  katy: {
    approach: "Assertive and serious",
    tactics: [
      "Emphasize severity of situation",
      "Use urgent language and deadlines",
      "Reference consequences clearly",
      "Require immediate response",
      "Escalation warnings included",
    ],
    goal: "Drive immediate action through serious but professional pressure",
  },
  troy: {
    approach: "Firm and consequential",
    tactics: [
      "Final notice language",
      "Legal terminology introduced",
      "Clear escalation timeline",
      "Emphasize additional costs coming",
      "Last chance positioning",
    ],
    goal: "Secure payment through formal pressure before legal action",
  },
  jimmy: {
    approach: "Legal and uncompromising",
    tactics: [
      "Legal notice format and language",
      "Reference specific legal remedies",
      "Attorney involvement mentioned",
      "Precise deadlines with consequences",
      "Full compliance requirements stated",
    ],
    goal: "Final opportunity before litigation with maximum legal pressure",
  },
  rocco: {
    approach: "Final internal collections - firm and compliance-focused",
    tactics: [
      "White-labeled as the business, never threatens",
      "Clearly states service access is revoked",
      "Demands immediate resolution without legal language",
      "Never implies 3rd-party collections involvement",
      "Maintains professional, compliant communication",
    ],
    goal: "Last-resort internal recovery before potential external referral",
  },
};

const displayOrder = ["nicolas", "sam", "james", "katy", "troy", "jimmy", "rocco"];

/** Animated section for each persona */
function PersonaSection({
  personaKey,
  index,
}: {
  personaKey: string;
  index: number;
}) {
  const persona = personaConfig[personaKey];
  const strategy = strategies[personaKey];
  const messages = sampleMessages[personaKey];
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const isEven = index % 2 === 0;

  if (!persona || !strategy) return null;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
      transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
      className="relative"
    >
      {/* Decorative glow behind the card */}
      <div
        className="absolute -inset-1 rounded-3xl opacity-20 blur-2xl pointer-events-none"
        style={{ background: persona.color }}
      />

      <div className="relative bg-card border border-border/60 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-500">
        {/* Main intro: image left / right + description */}
        <div
          className={`flex flex-col ${isEven ? "lg:flex-row" : "lg:flex-row-reverse"} items-stretch`}
        >
          {/* Large avatar panel */}
          <motion.div
            className="lg:w-[340px] xl:w-[400px] shrink-0 flex flex-col items-center justify-center p-8 lg:p-10 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${persona.color}18 0%, ${persona.color}08 100%)`,
            }}
            initial={{ opacity: 0, x: isEven ? -40 : 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            {/* Floating particle accents */}
            <div
              className="absolute top-4 right-6 w-16 h-16 rounded-full opacity-10 blur-xl"
              style={{ background: persona.color }}
            />
            <div
              className="absolute bottom-8 left-8 w-24 h-24 rounded-full opacity-10 blur-2xl"
              style={{ background: persona.color }}
            />

            <motion.div
              whileHover={{ scale: 1.08, rotate: 2 }}
              transition={{ type: "spring", stiffness: 200, damping: 12 }}
              className="relative"
            >
              <div
                className="absolute inset-0 rounded-full blur-xl opacity-30"
                style={{ background: persona.color }}
              />
              <PersonaAvatar persona={persona} size="2xl" />
            </motion.div>

            <motion.h2
              className="text-2xl md:text-3xl font-extrabold mt-5 tracking-tight"
              style={{ color: persona.color }}
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.4 }}
            >
              {persona.name}
            </motion.h2>

            <Badge
              variant="outline"
              className="mt-2 text-xs font-medium"
              style={{ borderColor: persona.color, color: persona.color }}
            >
              {personaKey === "nicolas"
                ? "Account-Level Support"
                : `${persona.bucketMin}–${persona.bucketMax ?? "∞"} Days Past Due`}
            </Badge>
          </motion.div>

          {/* Description & strategy panel */}
          <motion.div
            className="flex-1 p-6 lg:p-10 flex flex-col justify-center"
            initial={{ opacity: 0, x: isEven ? 40 : -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <p className="text-lg md:text-xl text-foreground/90 font-medium leading-relaxed mb-4">
              {persona.description}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              <span className="font-semibold text-foreground/80">Tone:</span>{" "}
              {persona.tone}
            </p>

            {/* Strategy cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Target, label: "Approach", value: strategy.approach },
                {
                  icon: Clock,
                  label: "Timing",
                  value:
                    personaKey === "nicolas"
                      ? "Any time (Account-level)"
                      : `Days ${persona.bucketMin}–${persona.bucketMax ?? "∞"}`,
                },
                { icon: TrendingUp, label: "Goal", value: strategy.goal },
              ].map(({ icon: Icon, label, value }) => (
                <motion.div
                  key={label}
                  className="bg-muted/40 rounded-xl p-4 border border-border/40"
                  whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: `${persona.color}20` }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: persona.color }} />
                    </div>
                    <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                      {label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-snug">
                    {value}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Expandable details section */}
        <div className="border-t border-border/40">
          <motion.button
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded(!expanded)}
            whileTap={{ scale: 0.98 }}
          >
            <span>{expanded ? "Hide" : "Show"} Tactics & Sample Messages</span>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronDown className="h-4 w-4" />
            </motion.div>
          </motion.button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="px-6 lg:px-10 pb-8 space-y-6">
                  {/* Tactics */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2 text-foreground/80">
                      <MessageSquare className="h-4 w-4" />
                      Key Tactics & Features
                    </h4>
                    <ul className="grid md:grid-cols-2 gap-2">
                      {strategy.tactics.map((tactic, i) => {
                        const isSlackTactic = tactic.toLowerCase().includes("slack");
                        return (
                          <motion.li
                            key={i}
                            className="flex items-start gap-2 text-sm"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                          >
                            {isSlackTactic ? (
                              <Slack className="h-4 w-4 text-[#4A154B] mt-0.5 shrink-0" />
                            ) : (
                              <span
                                className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: persona.color }}
                              />
                            )}
                            <span className="text-muted-foreground">{tactic}</span>
                          </motion.li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Sample Messages */}
                  <div>
                    <h4 className="font-semibold mb-3 text-foreground/80">
                      Sample Collection Messages
                    </h4>
                    <div className="space-y-3">
                      {messages.map((message, i) => (
                        <motion.div
                          key={i}
                          className="bg-muted/30 rounded-xl p-4 border border-border/40"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                        >
                          <div className="flex items-start gap-3">
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-xs"
                              style={{
                                background: `${persona.color}15`,
                                color: persona.color,
                                borderColor: `${persona.color}30`,
                              }}
                            >
                              #{i + 1}
                            </Badge>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              {message}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/** Sticky agent nav bar */
function AgentNavBar({
  activeKey,
  onSelect,
}: {
  activeKey: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <motion.div
      className="sticky top-16 z-30 py-3 bg-background/80 backdrop-blur-lg border-b border-border/40 -mx-4 px-4"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="flex justify-center items-center gap-1 md:gap-2 overflow-x-auto no-scrollbar">
        {displayOrder
          .filter((k) => personaConfig[k])
          .map((key) => {
            const p = personaConfig[key];
            const isActive = activeKey === key;
            return (
              <motion.button
                key={key}
                onClick={() => onSelect(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap"
                style={{
                  background: isActive ? `${p.color}15` : "transparent",
                  color: isActive ? p.color : undefined,
                  border: isActive ? `1px solid ${p.color}30` : "1px solid transparent",
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <PersonaAvatar persona={p} size="xs" />
                <span className="hidden sm:inline">{p.name}</span>
              </motion.button>
            );
          })}
      </div>
    </motion.div>
  );
}

const Personas = () => {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleNavSelect = (key: string) => {
    setActiveKey(key);
    sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Track which section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveKey(entry.target.getAttribute("data-persona") || null);
          }
        }
      },
      { rootMargin: "-40% 0px -40% 0px" }
    );

    const refs = sectionRefs.current;
    Object.values(refs).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <MarketingLayout>
      <div className="py-16 md:py-20 px-4 bg-gradient-to-b from-background via-background to-muted/20 min-h-screen">
        <div className="container mx-auto max-w-6xl">
          {/* Animated header */}
          <motion.div
            className="text-center mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.h1
              className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              Meet Your AI{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Collections Team
              </span>
            </motion.h1>
            <motion.p
              className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              Seven specialized AI agents that adapt their communication style
              based on account needs and how overdue an invoice is. Each persona
              uses proven collections psychology while maintaining compliance.
            </motion.p>
          </motion.div>

          {/* Sticky agent nav */}
          <AgentNavBar activeKey={activeKey} onSelect={handleNavSelect} />

          {/* Persona sections */}
          <div className="space-y-12 md:space-y-16 mt-10">
            {displayOrder
              .filter((key) => personaConfig[key])
              .map((key, index) => (
                <div
                  key={key}
                  ref={(el) => {
                    sectionRefs.current[key] = el;
                  }}
                  data-persona={key}
                >
                  <PersonaSection personaKey={key} index={index} />
                </div>
              ))}
          </div>

          {/* CTA Section */}
          <motion.div
            className="mt-16 text-center bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-8 md:p-12 border border-primary/10"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-bold mb-4">
              Let AI Handle Your Collections Strategy
            </h2>
            <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
              Each persona is automatically assigned based on invoice age. No
              manual work required – just intelligent, compliant collections
              that adapt to each situation.
            </p>
          </motion.div>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default Personas;
