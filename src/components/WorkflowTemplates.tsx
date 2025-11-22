import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, DollarSign, TrendingUp, Briefcase, Home, Zap } from "lucide-react";

interface Template {
  id: string;
  name: string;
  category: "scenario" | "value" | "industry";
  icon: any;
  description: string;
  bestFor: string[];
  steps: {
    day_offset: number;
    channel: "email" | "sms";
    label: string;
    tone: "friendly" | "firm" | "neutral";
  }[];
}

const templates: Template[] = [
  {
    id: "b2b_standard",
    name: "B2B Professional",
    category: "scenario",
    icon: Building2,
    description: "Professional, relationship-focused approach for business clients",
    bestFor: ["Business-to-business", "Long-term partnerships", "Enterprise clients"],
    steps: [
      { day_offset: 1, channel: "email", label: "Friendly Reminder", tone: "friendly" },
      { day_offset: 7, channel: "email", label: "Payment Due Notice", tone: "neutral" },
      { day_offset: 14, channel: "email", label: "Urgent Payment Request", tone: "firm" },
      { day_offset: 21, channel: "sms", label: "Final Notice", tone: "firm" },
    ],
  },
  {
    id: "b2c_friendly",
    name: "B2C Friendly",
    category: "scenario",
    icon: Users,
    description: "Gentle, consumer-friendly approach with multiple touchpoints",
    bestFor: ["Individual consumers", "Subscription services", "Retail customers"],
    steps: [
      { day_offset: 3, channel: "email", label: "Payment Reminder", tone: "friendly" },
      { day_offset: 7, channel: "sms", label: "Quick Reminder", tone: "friendly" },
      { day_offset: 14, channel: "email", label: "Payment Required", tone: "neutral" },
      { day_offset: 21, channel: "email", label: "Account Action Notice", tone: "firm" },
      { day_offset: 30, channel: "sms", label: "Final Notice", tone: "firm" },
    ],
  },
  {
    id: "high_value",
    name: "High-Value VIP",
    category: "value",
    icon: DollarSign,
    description: "Premium, personalized approach for large accounts",
    bestFor: ["Invoices over $10,000", "Key accounts", "Strategic partners"],
    steps: [
      { day_offset: 1, channel: "email", label: "Personal Check-in", tone: "friendly" },
      { day_offset: 5, channel: "email", label: "Payment Coordination", tone: "friendly" },
      { day_offset: 10, channel: "email", label: "Resolution Discussion", tone: "neutral" },
      { day_offset: 15, channel: "email", label: "Executive Escalation", tone: "neutral" },
    ],
  },
  {
    id: "small_invoice",
    name: "Small Invoice Fast Track",
    category: "value",
    icon: TrendingUp,
    description: "Quick, automated approach for low-value invoices",
    bestFor: ["Invoices under $500", "High-volume accounts", "Subscription renewals"],
    steps: [
      { day_offset: 3, channel: "email", label: "Auto Reminder", tone: "friendly" },
      { day_offset: 10, channel: "sms", label: "Quick Notice", tone: "neutral" },
      { day_offset: 20, channel: "email", label: "Final Reminder", tone: "firm" },
    ],
  },
  {
    id: "saas_subscription",
    name: "SaaS Subscription",
    category: "industry",
    icon: Zap,
    description: "Optimized for subscription-based SaaS businesses",
    bestFor: ["Software subscriptions", "Cloud services", "Recurring billing"],
    steps: [
      { day_offset: 1, channel: "email", label: "Payment Failed Notice", tone: "neutral" },
      { day_offset: 3, channel: "email", label: "Update Payment Method", tone: "friendly" },
      { day_offset: 7, channel: "sms", label: "Service Interruption Warning", tone: "neutral" },
      { day_offset: 14, channel: "email", label: "Account Suspension Notice", tone: "firm" },
    ],
  },
  {
    id: "professional_services",
    name: "Professional Services",
    category: "industry",
    icon: Briefcase,
    description: "Tailored for consultants, agencies, and service providers",
    bestFor: ["Consulting firms", "Marketing agencies", "Professional services"],
    steps: [
      { day_offset: 3, channel: "email", label: "Invoice Delivery", tone: "friendly" },
      { day_offset: 10, channel: "email", label: "Payment Follow-up", tone: "neutral" },
      { day_offset: 20, channel: "email", label: "Overdue Notice", tone: "firm" },
      { day_offset: 30, channel: "sms", label: "Collections Notice", tone: "firm" },
    ],
  },
  {
    id: "home_services",
    name: "Home Services",
    category: "industry",
    icon: Home,
    description: "Perfect for contractors, plumbers, and home service providers",
    bestFor: ["Contractors", "Home repairs", "Service providers"],
    steps: [
      { day_offset: 1, channel: "email", label: "Thank You + Invoice", tone: "friendly" },
      { day_offset: 7, channel: "sms", label: "Payment Reminder", tone: "friendly" },
      { day_offset: 14, channel: "email", label: "Payment Due", tone: "neutral" },
      { day_offset: 21, channel: "email", label: "Final Notice", tone: "firm" },
    ],
  },
];

interface WorkflowTemplatesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: Template) => void;
  selectedBucket?: string;
  bucketLabel?: string;
}

const WorkflowTemplates = ({ open, onOpenChange, onSelectTemplate, selectedBucket, bucketLabel }: WorkflowTemplatesProps) => {
  const categoryGroups = {
    scenario: templates.filter(t => t.category === "scenario"),
    value: templates.filter(t => t.category === "value"),
    industry: templates.filter(t => t.category === "industry"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Workflow Templates</DialogTitle>
          <DialogDescription>
            Choose a pre-built template optimized for your collection scenario
          </DialogDescription>
          {selectedBucket && bucketLabel && (
            <div className="mt-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm font-medium text-foreground">
                Applying template to: <span className="text-primary">{bucketLabel}</span>
              </p>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-8 mt-4">
          {/* Scenario-Based Templates */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Collection Scenarios</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {categoryGroups.scenario.map((template) => {
                const Icon = template.icon;
                return (
                  <Card key={template.id} className="hover:border-primary transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            <Badge variant="secondary" className="mt-1">
                              {template.steps.length} steps
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <CardDescription className="mt-2">{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-2">Best for:</p>
                          <div className="flex flex-wrap gap-1">
                            {template.bestFor.map((item, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button 
                          onClick={() => onSelectTemplate(template)}
                          className="w-full"
                          size="sm"
                        >
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Value-Based Templates */}
          <div>
            <h3 className="text-lg font-semibold mb-4">By Invoice Value</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {categoryGroups.value.map((template) => {
                const Icon = template.icon;
                return (
                  <Card key={template.id} className="hover:border-primary transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            <Badge variant="secondary" className="mt-1">
                              {template.steps.length} steps
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <CardDescription className="mt-2">{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-2">Best for:</p>
                          <div className="flex flex-wrap gap-1">
                            {template.bestFor.map((item, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button 
                          onClick={() => onSelectTemplate(template)}
                          className="w-full"
                          size="sm"
                        >
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Industry-Specific Templates */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Industry-Specific</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryGroups.industry.map((template) => {
                const Icon = template.icon;
                return (
                  <Card key={template.id} className="hover:border-primary transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            <Badge variant="secondary" className="mt-1">
                              {template.steps.length} steps
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <CardDescription className="mt-2">{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-2">Best for:</p>
                          <div className="flex flex-wrap gap-1">
                            {template.bestFor.map((item, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button 
                          onClick={() => onSelectTemplate(template)}
                          className="w-full"
                          size="sm"
                        >
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkflowTemplates;
export type { Template };