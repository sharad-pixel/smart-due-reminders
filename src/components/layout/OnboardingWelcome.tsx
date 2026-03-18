import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNicolasPreferences } from '@/hooks/useNicolasPreferences';
import { useNavigate } from 'react-router-dom';
import { 
  Database, 
  Users, 
  FileText, 
  Bot, 
  Mail, 
  CheckSquare,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import nicolasAvatar from '@/assets/personas/nicolas.png';

const ONBOARDING_STEPS = [
  {
    icon: Database,
    title: 'Import Your Data',
    description: 'Start by uploading your accounts, invoices, and payments through the Data Center.',
    path: '/data-center',
  },
  {
    icon: Bot,
    title: 'Configure AI Workflows',
    description: 'Set up automated collection outreach with our AI personas for each aging bucket.',
    path: '/settings/ai-workflows',
  },
  {
    icon: Mail,
    title: 'Review & Approve Drafts',
    description: 'AI generates personalized collection messages. Review and approve before sending.',
    path: '/outreach',
  },
  {
    icon: CheckSquare,
    title: 'Track Tasks & Responses',
    description: 'Monitor inbound responses and manage follow-up tasks from one place.',
    path: '/tasks',
  },
];

export const OnboardingWelcome = () => {
  const { preferences, isLoaded, completeOnboarding } = useNicolasPreferences();
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  // Don't show if loaded and onboarding completed or assistant disabled
  if (!isLoaded || preferences.onboardingCompleted || !preferences.assistantEnabled) {
    return null;
  }

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    completeOnboarding();
  };

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
              src={nicolasAvatar} 
              alt="Nicolas" 
              className="h-12 w-12 rounded-full object-cover border-2 border-primary/20"
            />
            <div>
              <DialogTitle className="text-xl">Welcome to Recouply.ai!</DialogTitle>
              <Badge variant="secondary" className="mt-1">
                <Sparkles className="h-3 w-3 mr-1" />
                Hi, I'm Nicolas - your collection assistant
              </Badge>
            </div>
          </div>
          <DialogDescription className="text-base">
            I'll help you get started and guide you through the platform. Here's a quick overview of how to get the most out of Recouply.ai.
          </DialogDescription>
        </DialogHeader>

        {/* Step progress */}
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

        {/* Current step content */}
        <div className="bg-muted/30 rounded-lg p-6 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <StepIcon className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            Step {currentStep + 1}: {currentStepData.title}
          </h3>
          <p className="text-muted-foreground">
            {currentStepData.description}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => handleGoToStep(currentStepData.path)}
          >
            Go to {currentStepData.title.split(' ')[0]}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={handleComplete}
            >
              Skip Tour
            </Button>
            {currentStep < ONBOARDING_STEPS.length - 1 ? (
              <Button onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button onClick={handleComplete}>
                Get Started
              </Button>
            )}
          </div>
        </div>

        {/* Help note */}
        <p className="text-xs text-center text-muted-foreground mt-2">
          I'll be available on every page to help. Look for me in the bottom-right corner!
        </p>
      </DialogContent>
    </Dialog>
  );
};
