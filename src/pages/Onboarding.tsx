import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useOnboarding } from "@/hooks/useOnboarding";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Building2, FileUp, Palette, PlayCircle, 
  CheckCircle2, ChevronRight, ChevronLeft, 
  Sparkles, PartyPopper, Rocket, SkipForward
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  {
    id: 1,
    key: "business_profile_completed" as const,
    title: "Set Up Your Business Profile",
    subtitle: "Tell us about your company",
    icon: Building2,
    description: "Complete your business profile with your company name, address, and contact details. This information appears on invoices and outreach communications.",
    action: "Go to Business Profile",
    route: "/profile",
    tips: [
      "Add your company legal name and DBA if applicable",
      "Include your business address for invoice templates",
      "Upload a company logo for branded communications",
    ],
  },
  {
    id: 2,
    key: "documents_uploaded" as const,
    title: "Upload Your Data",
    subtitle: "Import accounts and invoices",
    icon: FileUp,
    description: "Upload your accounts receivable data to get started. You can import via CSV, Excel, or connect to your accounting system.",
    action: "Go to Data Center",
    route: "/data-center",
    tips: [
      "Prepare your AR aging report or open invoice list",
      "Include customer names, invoice numbers, amounts, and due dates",
      "You can always add more data later",
    ],
  },
  {
    id: 3,
    key: "branding_completed" as const,
    title: "Customize Your Branding",
    subtitle: "Make it yours",
    icon: Palette,
    description: "Configure your brand colors, email templates, and invoice design. Professional branding increases payment rates by up to 15%.",
    action: "Go to Branding",
    route: "/branding",
    tips: [
      "Upload your logo and set brand colors",
      "Customize your email signature and footer",
      "Preview your invoice template with live data",
    ],
  },
  {
    id: 4,
    key: "training_viewed" as const,
    title: "Product Training",
    subtitle: "Learn the platform",
    icon: PlayCircle,
    description: "Watch our quick training videos to master Recouply.ai's AI-powered collection tools, risk scoring, and automation features.",
    action: "View Training",
    route: null,
    tips: [
      "Each video is 2-5 minutes long",
      "Learn about AI agents and how they work for you",
      "Discover advanced features like risk scoring and payment plans",
    ],
  },
];

const TRAINING_VIDEOS = [
  {
    title: "Getting Started with Recouply.ai",
    description: "Platform overview and navigation",
    duration: "3 min",
    thumbnail: null,
    status: "coming_soon" as const,
  },
  {
    title: "AI Collection Agents",
    description: "How AI agents automate your outreach",
    duration: "4 min",
    thumbnail: null,
    status: "coming_soon" as const,
  },
  {
    title: "Risk Scoring & Intelligence",
    description: "Understanding customer risk profiles",
    duration: "3 min",
    thumbnail: null,
    status: "coming_soon" as const,
  },
  {
    title: "Workflows & Automation",
    description: "Setting up automated collection workflows",
    duration: "5 min",
    thumbnail: null,
    status: "coming_soon" as const,
  },
  {
    title: "Payment Plans & Portal",
    description: "Managing payment arrangements",
    duration: "3 min",
    thumbnail: null,
    status: "coming_soon" as const,
  },
  {
    title: "Reports & Analytics",
    description: "Tracking performance and ROI",
    duration: "2 min",
    thumbnail: null,
    status: "coming_soon" as const,
  },
];

export default function Onboarding() {
  usePageTitle("Getting Started");
  const navigate = useNavigate();
  const { progress, loading, updateStep, completeOnboarding } = useOnboarding();
  const [activeStep, setActiveStep] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (progress) {
      // Find first incomplete step
      const firstIncomplete = STEPS.findIndex(s => !progress[s.key]);
      setActiveStep(firstIncomplete === -1 ? STEPS.length - 1 : firstIncomplete);
    }
  }, [progress]);

  useEffect(() => {
    const fetchName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
        setUserName(data?.name || "");
      }
    };
    fetchName();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (showCelebration) {
    return <CelebrationScreen userName={userName} onContinue={() => navigate("/dashboard")} />;
  }

  const completedCount = STEPS.filter(s => progress?.[s.key]).length;
  const progressPct = (completedCount / STEPS.length) * 100;
  const currentStep = STEPS[activeStep];
  const isStepComplete = progress?.[currentStep.key] ?? false;
  const allComplete = completedCount === STEPS.length;

  const handleMarkComplete = async () => {
    await updateStep({ [currentStep.key]: true, current_step: activeStep + 2 });
    toast.success(`${currentStep.title} completed!`);

    if (completedCount + 1 === STEPS.length) {
      await completeOnboarding();
      setShowCelebration(true);
    } else if (activeStep < STEPS.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const handleSkipOnboarding = async () => {
    await completeOnboarding();
    navigate("/dashboard");
  };

  const handleNavigateToStep = () => {
    if (currentStep.route) {
      navigate(currentStep.route);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {userName ? `Welcome, ${userName.split(" ")[0]}!` : "Welcome to Recouply.ai!"}
              </h1>
              <p className="text-xs text-muted-foreground">Let's get your account set up</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSkipOnboarding} className="text-muted-foreground gap-1">
            <SkipForward className="h-3.5 w-3.5" />
            Skip Setup
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">{completedCount} of {STEPS.length} steps completed</span>
            <span className="text-sm text-muted-foreground">{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px,1fr] gap-6">
          {/* Step Sidebar */}
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const done = progress?.[step.key] ?? false;
              const isActive = i === activeStep;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(i)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all min-w-[200px] lg:min-w-0 ${
                    isActive
                      ? "bg-primary/10 border border-primary/20 text-foreground"
                      : "hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    done ? "bg-green-500/10" : isActive ? "bg-primary/10" : "bg-muted"
                  }`}>
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <StepIcon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${done ? "line-through opacity-60" : ""}`}>
                      {step.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="border-border/50">
                <CardContent className="p-6 space-y-6">
                  {/* Step Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                        isStepComplete ? "bg-green-500/10" : "bg-primary/10"
                      }`}>
                        {isStepComplete ? (
                          <CheckCircle2 className="h-6 w-6 text-green-500" />
                        ) : (
                          <currentStep.icon className="h-6 w-6 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Step {activeStep + 1} of {STEPS.length}
                        </p>
                        <h2 className="text-xl font-bold text-foreground mt-0.5">{currentStep.title}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{currentStep.subtitle}</p>
                      </div>
                    </div>
                    {isStepComplete && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
                        <CheckCircle2 className="h-3 w-3" /> Complete
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentStep.description}
                  </p>

                  {/* Training Videos (Step 4) */}
                  {currentStep.key === "training_viewed" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {TRAINING_VIDEOS.map((video, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-2"
                        >
                          <div className="aspect-video bg-muted rounded-md flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
                            <div className="text-center z-10">
                              <PlayCircle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                              <span className="text-[10px] text-muted-foreground/60 mt-1 block font-medium uppercase tracking-wider">
                                Coming Soon
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{video.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-muted-foreground">{video.description}</p>
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {video.duration}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tips */}
                  <div className="rounded-lg bg-muted/40 border border-border/30 p-4">
                    <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> Pro Tips
                    </p>
                    <ul className="space-y-1.5">
                      {currentStep.tips.map((tip, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={activeStep === 0}
                      onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" /> Back
                    </Button>
                    <div className="flex gap-2">
                      {currentStep.route && (
                        <Button variant="outline" size="sm" onClick={handleNavigateToStep} className="gap-1">
                          {currentStep.action} <ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                      {!isStepComplete ? (
                        <Button size="sm" onClick={handleMarkComplete} className="gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Mark as Complete
                        </Button>
                      ) : activeStep < STEPS.length - 1 ? (
                        <Button size="sm" onClick={() => setActiveStep(activeStep + 1)} className="gap-1">
                          Next Step <ChevronRight className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function CelebrationScreen({ userName, onContinue }: { userName: string; onContinue: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex items-center justify-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 15, stiffness: 100 }}
        className="text-center max-w-md mx-auto px-4"
      >
        <motion.div
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.2, type: "spring" }}
        >
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/10 flex items-center justify-center mx-auto mb-6">
            <PartyPopper className="h-10 w-10 text-primary" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-bold text-foreground mb-3"
        >
          You're All Set! 🎉
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground mb-2"
        >
          {userName ? `Great job, ${userName.split(" ")[0]}!` : "Great job!"} Your account is fully configured and ready to go.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-sm text-muted-foreground mb-8"
        >
          Your AI collection agents are standing by to help you recover revenue faster.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button size="lg" onClick={onContinue} className="gap-2 px-8">
            <Rocket className="h-5 w-5" />
            Go to Dashboard
          </Button>
        </motion.div>

        {/* Confetti dots */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 8 + 4,
              height: Math.random() * 8 + 4,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: ["hsl(var(--primary))", "hsl(var(--accent))", "#f59e0b", "#ec4899"][i % 4],
              opacity: 0.3,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: [0, 1, 0.5],
              opacity: [0, 0.4, 0],
              y: [0, -100 - Math.random() * 200],
            }}
            transition={{ delay: 0.5 + Math.random() * 0.5, duration: 2, ease: "easeOut" }}
          />
        ))}
      </motion.div>
    </div>
  );
}
