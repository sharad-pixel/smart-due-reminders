import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CheckCircle2,
  Circle,
  Database,
  CreditCard,
  FileText,
  Upload,
  Download,
  Bot,
  Mail,
  Users,
  ExternalLink,
  Sparkles,
  BookOpen,
  HelpCircle,
  Play,
} from "lucide-react";
import nicolasAvatar from "@/assets/personas/nicolas.png";
import stripeLogo from "@/assets/stripe-logo.png";
import quickbooksLogo from "@/assets/quickbooks-logo.png";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path?: string;
  isCompleted: boolean;
  action?: () => void;
  subSteps?: { label: string; completed: boolean }[];
}

interface KnowledgeBaseAgentProps {
  stripeConnected?: boolean;
  quickbooksConnected?: boolean;
  hasAccounts?: boolean;
  hasInvoices?: boolean;
  workflowsConfigured?: boolean;
  onSetupStripe?: () => void;
  onSetupQuickBooks?: () => void;
}

const COLLAPSED_STORAGE_KEY = "recouply-kb-collapsed";

export const KnowledgeBaseAgent = ({
  stripeConnected = false,
  quickbooksConnected = false,
  hasAccounts = false,
  hasInvoices = false,
  workflowsConfigured = false,
  onSetupStripe,
  onSetupQuickBooks,
}: KnowledgeBaseAgentProps) => {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    return saved === "true";
  });
  const [expandedSection, setExpandedSection] = useState<string | null>("getting-started");

  useEffect(() => {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const sections = [
    {
      id: "getting-started",
      title: "Getting Started",
      description: "Complete these steps to get your collections running",
      icon: Play,
      steps: [
        {
          id: "import-data",
          title: "Import Your Data",
          description: "Upload accounts and invoices through the Data Center",
          icon: Database,
          path: "/data-center",
          isCompleted: hasAccounts && hasInvoices,
          subSteps: [
            { label: "Import accounts", completed: hasAccounts },
            { label: "Import invoices", completed: hasInvoices },
          ],
        },
        {
          id: "configure-workflows",
          title: "Configure AI Workflows",
          description: "Set up automated outreach cadences",
          icon: Bot,
          path: "/settings/ai-workflows",
          isCompleted: workflowsConfigured,
        },
        {
          id: "branding",
          title: "Set Up Branding",
          description: "Add your logo and customize email appearance",
          icon: Mail,
          path: "/branding",
          isCompleted: false,
        },
      ],
    },
    {
      id: "integrations",
      title: "Connect Integrations",
      description: "Sync data automatically from your billing systems",
      icon: CreditCard,
      steps: [
        {
          id: "stripe",
          title: "Connect Stripe",
          description: "Import invoices and payments from Stripe automatically",
          icon: CreditCard,
          path: "/settings",
          isCompleted: stripeConnected,
          action: onSetupStripe,
        },
        {
          id: "quickbooks",
          title: "Connect QuickBooks",
          description: "Sync customers, invoices, and payments from QuickBooks Online",
          icon: Users,
          path: "/data-center",
          isCompleted: quickbooksConnected,
          action: onSetupQuickBooks,
        },
      ],
    },
    {
      id: "import-export",
      title: "Import & Export Data",
      description: "Bulk upload and download your AR data",
      icon: FileText,
      steps: [
        {
          id: "import-accounts",
          title: "Import Accounts",
          description: "Upload a CSV/Excel file with your customer accounts",
          icon: Upload,
          path: "/data-center",
          isCompleted: hasAccounts,
        },
        {
          id: "import-invoices",
          title: "Import Invoices",
          description: "Bulk upload invoices with account mapping",
          icon: Upload,
          path: "/data-center",
          isCompleted: hasInvoices,
        },
        {
          id: "export-data",
          title: "Export Data",
          description: "Download your data in CSV or Excel format",
          icon: Download,
          path: "/data-center",
          isCompleted: false,
        },
        {
          id: "download-templates",
          title: "Download Templates",
          description: "Get properly formatted templates for import",
          icon: FileText,
          path: "/data-center?tab=sources",
          isCompleted: false,
        },
      ],
    },
  ];

  const totalSteps = sections.reduce((acc, s) => acc + s.steps.length, 0);
  const completedSteps = sections.reduce(
    (acc, s) => acc + s.steps.filter((step) => step.isCompleted).length,
    0
  );
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  return (
    <Card className="border-primary/20 shadow-md">
      <CardHeader className={isCollapsed ? "pb-4" : "pb-4"}>
        <div className="flex items-start gap-4">
          <img
            src={nicolasAvatar}
            alt="Nicolas"
            className="h-14 w-14 rounded-full object-cover border-2 border-primary/30"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg">Knowledge Base & Setup</CardTitle>
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Nicolas Guide
              </Badge>
            </div>
            {!isCollapsed && (
              <CardDescription>
                I'll help you get Recouply.ai set up for success. Complete these steps to automate your collections.
              </CardDescription>
            )}
            {isCollapsed && (
              <CardDescription className="text-xs">
                {completedSteps} of {totalSteps} steps complete
              </CardDescription>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="shrink-0"
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Progress indicator - only show when expanded */}
        {!isCollapsed && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Setup Progress</span>
              <span className="font-medium">
                {completedSteps} of {totalSteps} complete
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}
      </CardHeader>

      {!isCollapsed && (
      <CardContent className="space-y-3">
        {sections.map((section) => {
          const SectionIcon = section.icon;
          const sectionComplete = section.steps.every((s) => s.isCompleted);
          const isExpanded = expandedSection === section.id;

          return (
            <Collapsible key={section.id} open={isExpanded} onOpenChange={() => toggleSection(section.id)}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center ${
                        sectionComplete
                          ? "bg-green-100 text-green-700"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {sectionComplete ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <SectionIcon className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{section.title}</h4>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {section.steps.filter((s) => s.isCompleted).length}/{section.steps.length}
                    </Badge>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-2 space-y-2 pl-4">
                {section.steps.map((step) => {
                  const StepIcon = step.icon;
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        step.isCompleted
                          ? "bg-green-50/50 border-green-200"
                          : "bg-card hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center ${
                            step.isCompleted
                              ? "bg-green-100 text-green-700"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {step.isCompleted ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <StepIcon className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{step.title}</span>
                            {step.id === "stripe" && (
                              <img src={stripeLogo} alt="Stripe" className="h-4 w-4 object-contain" />
                            )}
                            {step.id === "quickbooks" && (
                              <img src={quickbooksLogo} alt="QuickBooks" className="h-4 w-4 object-contain rounded-full" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{step.description}</p>
                          {step.subSteps && (
                            <div className="flex gap-3 mt-1">
                              {step.subSteps.map((sub, idx) => (
                                <span
                                  key={idx}
                                  className={`text-xs flex items-center gap-1 ${
                                    sub.completed ? "text-green-600" : "text-muted-foreground"
                                  }`}
                                >
                                  {sub.completed ? (
                                    <CheckCircle2 className="h-3 w-3" />
                                  ) : (
                                    <Circle className="h-3 w-3" />
                                  )}
                                  {sub.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {!step.isCompleted && (
                        <Button
                          size="sm"
                          variant={step.action ? "default" : "outline"}
                          onClick={() => {
                            if (step.action) {
                              step.action();
                            } else if (step.path) {
                              navigate(step.path);
                            }
                          }}
                        >
                          {step.action ? "Connect" : "Go"}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {/* Help Resources */}
        <div className="pt-4 border-t mt-4">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Help Resources</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-xs h-auto py-2"
              onClick={() => navigate("/data-center")}
            >
              <Upload className="h-3 w-3 mr-2" />
              Import Guide
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-xs h-auto py-2"
              onClick={() => navigate("/settings/ai-workflows")}
            >
              <Bot className="h-3 w-3 mr-2" />
              Workflow Setup
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-xs h-auto py-2"
              onClick={() => navigate("/personas")}
            >
              <Users className="h-3 w-3 mr-2" />
              Meet AI Agents
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-xs h-auto py-2"
              onClick={() => navigate("/branding")}
            >
              <Mail className="h-3 w-3 mr-2" />
              Email Branding
            </Button>
          </div>
        </div>
      </CardContent>
      )}
    </Card>
  );
};

export default KnowledgeBaseAgent;
