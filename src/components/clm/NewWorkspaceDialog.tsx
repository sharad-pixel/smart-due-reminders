import { EngagementSetupWizard } from "./wizard/EngagementSetupWizard";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Legacy quick-create dialog has been replaced by the guided
// Engagement Setup Wizard. The component name is kept so existing
// triggers across the app (Contracts page, etc.) continue to work.
export const NewWorkspaceDialog = ({ open, onOpenChange }: Props) => (
  <EngagementSetupWizard open={open} onOpenChange={onOpenChange} />
);
