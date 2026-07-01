import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNicolasPreferences } from '@/hooks/useNicolasPreferences';
import { useNavigate } from 'react-router-dom';
import { Database, Bot, Mail, CheckSquare, FileSignature, ArrowRight, Sparkles, Mail as MailIcon } from 'lucide-react';
import sharadAvatar from '@/assets/founder-sharad.jpg';
import { founderConfig } from '@/lib/founderConfig';

const ONBOARDING_STEPS = [
  {
    icon: Database,
    title: 'Import Your Data',
    description: 'Start in the Data Center — pull accounts, invoices, and payments from CSV, Stripe, QuickBooks, NetSuite, Sage, or Google Sheets.',
    path: '/data-center',
  },
  {
    icon: FileSignature,
    title: 'Set Up Contract Intelligence',
    description: 'Upload your contracts and let AI review each one — capturing payment terms, dates, obligations, and risks so every revenue-related data point is tracked.',
    path: '/contracts',
  },
  {
    icon: Bot,
    title: 'Configure AI Workflows',
    description: 'Pick tone, cadence, and which AI agent handles each aging bucket. Your team stays in control of every send.',
    path: '/settings/ai-workflows',
  },
  {
    icon: Mail,
    title: 'Review & Approve Drafts',
    description: 'AI writes tone-matched outreach. You review, refine, and approve — nothing leaves without you.',
    path: '/outreach',
  },
  {
    icon: CheckSquare,
    title: 'Track Tasks & Responses',
    description: 'Every inbound reply, every follow-up — managed in one Kanban board so nothing slips.',
    path: '/tasks',
  },
];

export const OnboardingWelcome = () => {
  const { preferences, isLoaded, completeOnboarding } = useNicolasPreferences();
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  if (!isLoaded || preferences.onboardingCompleted || !preferences.assistantEnabled) {
    return null;
  }

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) setCurrentStep(currentStep + 1);
  };
  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };
  const handleComplete = () => completeOnboarding();
  const handleGoToStep = (path: string) => {
    completeOnboarding();
    navigate(path);
  };

  const currentStepData = ONBOARDING_STEPS[currentStep];
  const StepIcon = currentStepData.icon;

  return (
    <Dialog open onOpenChange={() => handleComplete()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <img
              src={sharadAvatar}
              alt={`${founderConfig.name}, ${founderConfig.title}`}
              className="h-12 w-12 rounded-full object-cover border-2 border-primary/20"
            />
            <div>
              <DialogTitle className="text-xl">Welcome to Recouply.ai — I'm glad you're here.</DialogTitle>
              <Badge variant="secondary" className="mt-1">
                <Sparkles className="h-3 w-3 mr-1" />
                A personal note from {founderConfig.name}, {founderConfig.title}
              </Badge>
            </div>
          </div>
          <DialogDescription className="text-base leading-relaxed space-y-3">
            <span className="block">
              Hey — Sharad here. I built Recouply.ai after 15+ years inside revenue and billing teams at Workday, ServiceTitan, Contentful, and Chegg, watching brilliant finance folks drown in spreadsheets and lose contracts in email threads. You deserve better tooling, and that's what we're handing you today.
            </span>
            <span className="block">
              Recouply is your <strong>Revenue Intelligence Platform</strong> — two services, one source of truth:
            </span>
            <span className="block pl-3 border-l-2 border-primary/30">
              <strong>Collections Intelligence</strong> — AI agents prioritize by risk and draft tone-matched outreach. You stay in the loop.
            </span>
            <span className="block pl-3 border-l-2 border-emerald-500/40">
              <strong>Contract Intelligence</strong> — engagement workspaces, templates, signatures, and renewal watchers so no contract slips through.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 my-4">
          {ONBOARDING_STEPS.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all ${
                index === currentStep
                  ? 'w-8 bg-primary'
                  : index < currentStep
                  ? 'w-2 bg-primary/50'
                  : 'w-2 bg-muted'
              }`}
            />
          ))}
        </div>

        <div className="bg-muted/30 rounded-lg p-6 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <StepIcon className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            Step {currentStep + 1}: {currentStepData.title}
          </h3>
          <p className="text-muted-foreground">{currentStepData.description}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => handleGoToStep(currentStepData.path)}
          >
            Take me there
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        <div className="flex items-center justify-between mt-4">
          <Button variant="ghost" onClick={handlePrev} disabled={currentStep === 0}>
            Previous
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={handleComplete}>Skip Tour</Button>
            {currentStep < ONBOARDING_STEPS.length - 1 ? (
              <Button onClick={handleNext}>Next</Button>
            ) : (
              <Button onClick={handleComplete}>Let's go</Button>
            )}
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-3 flex items-center justify-center gap-1">
          <MailIcon className="h-3 w-3" />
          If anything feels off, email me directly at{' '}
          <a href={`mailto:${founderConfig.email}`} className="underline hover:text-foreground">
            {founderConfig.email}
          </a>
          {' '}— I read every note. — Sharad
        </p>
      </DialogContent>
    </Dialog>
  );
};
