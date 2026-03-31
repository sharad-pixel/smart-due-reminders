import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, ChevronDown, ChevronUp, MousePointerClick, Info, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TutorialStep {
  title: string;
  description: string;
  action?: string;
}

interface DemoTutorialCalloutProps {
  title: string;
  description: string;
  steps?: TutorialStep[];
  proTip?: string;
  variant?: "info" | "action" | "tip";
  platformPath?: string;
}

export const DemoTutorialCallout = ({
  title,
  description,
  steps,
  proTip,
  variant = "info",
  platformPath,
}: DemoTutorialCalloutProps) => {
  const [expanded, setExpanded] = useState(false);

  const variantStyles = {
    info: "border-primary/20 bg-primary/5",
    action: "border-accent/20 bg-accent/5",
    tip: "border-yellow-500/20 bg-yellow-500/5",
  };

  const IconComponent = variant === "action" ? MousePointerClick : variant === "tip" ? Lightbulb : Info;
  const iconColor = variant === "action" ? "text-accent" : variant === "tip" ? "text-yellow-500" : "text-primary";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${variantStyles[variant]} overflow-hidden`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <IconComponent className={`h-5 w-5 ${iconColor} shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-sm text-foreground">{title}</p>
              {platformPath && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  {platformPath}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {steps && steps.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && steps && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border/50"
          >
            <div className="p-4 space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                    {step.action && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <MousePointerClick className="h-3 w-3 text-primary" />
                        <span className="text-xs font-medium text-primary">{step.action}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {proTip && (
                <div className="flex items-start gap-2 mt-3 p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                  <Lightbulb className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">{proTip}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface FeatureScreenshotProps {
  src: string;
  alt: string;
  caption?: string;
}

export const FeatureScreenshot = ({ src, alt, caption }: FeatureScreenshotProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.98 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.2 }}
    className="rounded-xl border border-border overflow-hidden bg-muted/20"
  >
    <div className="bg-muted/50 px-3 py-2 flex items-center gap-1.5 border-b border-border">
      <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
      <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
      <div className="h-2.5 w-2.5 rounded-full bg-accent/60" />
      <span className="text-[10px] text-muted-foreground ml-2 font-mono">recouply.ai</span>
    </div>
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="w-full h-auto"
    />
    {caption && (
      <div className="px-3 py-2 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">{caption}</p>
      </div>
    )}
  </motion.div>
);

interface TryItPromptProps {
  label: string;
  description: string;
  onAction?: () => void;
  actionLabel?: string;
  completed?: boolean;
}

export const TryItPrompt = ({ label, description, onAction, actionLabel = "Try It", completed }: TryItPromptProps) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
      completed ? "border-accent/30 bg-accent/5" : "border-primary/20 bg-primary/5 hover:bg-primary/10"
    }`}
  >
    {completed ? (
      <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
    ) : (
      <MousePointerClick className="h-5 w-5 text-primary shrink-0 animate-pulse" />
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    {onAction && !completed && (
      <button
        onClick={onAction}
        className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
      >
        {actionLabel}
      </button>
    )}
  </motion.div>
);
