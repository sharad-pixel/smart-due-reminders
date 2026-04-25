import { useMemo } from "react";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";

export interface SetupItem {
  label: string;
  completed: boolean;
  route: string;
  missingFields?: string[];
}

export function useOnboardingCompletion() {
  const status = useOnboardingStatus();

  const { percentage, completedSteps, totalSteps, items } = useMemo(() => {
    const allItems: SetupItem[] = [
      {
        label: "Business Profile",
        completed: status.businessProfileConfigured,
        route: "/branding",
        missingFields: status.businessProfileMissingFields,
      },
      {
        label: "Sender Identity",
        completed: status.senderIdentityConfigured,
        route: "/branding",
        missingFields: status.senderIdentityMissingFields,
      },
      { label: "Company Logo", completed: status.hasLogo, route: "/branding" },
      { label: "Customer Accounts", completed: status.hasAccounts, route: "/accounts" },
      { label: "Invoices Uploaded", completed: status.hasInvoices, route: "/invoices" },
      {
        label: "Payment Instructions",
        completed: status.hasPaymentInstructions,
        route: "/branding",
        missingFields: status.paymentMissingFields,
      },
      { label: "Collection Workflows", completed: status.workflowsConfigured, route: "/ai-workflows" },
    ];

    const completed = allItems.filter(i => i.completed).length;
    return {
      percentage: (completed / allItems.length) * 100,
      completedSteps: completed,
      totalSteps: allItems.length,
      items: allItems,
    };
  }, [status]);

  const missingItems = items.filter(i => !i.completed);
  const isComplete = missingItems.length === 0;

  return {
    percentage,
    completedSteps,
    totalSteps,
    items,
    missingItems,
    isComplete,
    loading: status.isLoading,
    showRing: !status.isLoading && !isComplete,
  };
}
