import { useMemo } from "react";
import { useOnboarding } from "@/hooks/useOnboarding";

export function useOnboardingCompletion() {
  const onboarding = useOnboarding();

  const { percentage, completedSteps, totalSteps } = useMemo(() => {
    if (!onboarding.progress) {
      return { percentage: 0, completedSteps: 0, totalSteps: 4 };
    }

    const steps = [
      onboarding.progress.business_profile_completed,
      onboarding.progress.documents_uploaded,
      onboarding.progress.branding_completed,
      onboarding.progress.training_viewed,
    ];

    const completed = steps.filter(Boolean).length;
    return {
      percentage: (completed / steps.length) * 100,
      completedSteps: completed,
      totalSteps: steps.length,
    };
  }, [onboarding.progress]);

  return {
    ...onboarding,
    percentage,
    completedSteps,
    totalSteps,
    showRing: !onboarding.loading && !!onboarding.progress && !onboarding.isComplete,
  };
}
