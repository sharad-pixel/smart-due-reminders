import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIntegrationToggles, ALL_INTEGRATION_KEYS, INTEGRATION_LABELS, INTEGRATION_DESCRIPTIONS } from "@/hooks/useIntegrationToggles";
import type { IntegrationKey } from "@/hooks/useIntegrationToggles";
import { NetSuiteIcon, SageIcon } from "@/components/icons/ERPIcons";

// Inline SVG logos for each integration
const StripeLogo = ({ className = "h-8 w-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#635BFF" />
    <path d="M22.5 18.9c0-1.2 1-1.7 2.6-1.7 2.3 0 5.3.7 7.6 2V12.7c-2.5-1-5.1-1.4-7.6-1.4-6.2 0-10.3 3.2-10.3 8.6 0 8.4 11.6 7.1 11.6 10.7 0 1.4-1.2 1.9-3 1.9-2.6 0-5.9-1.1-8.5-2.5v6.6c2.9 1.2 5.8 1.8 8.5 1.8 6.4 0 10.7-3.2 10.7-8.6.1-9.1-11.6-7.5-11.6-10.9z" fill="white" />
  </svg>
);

const QuickBooksLogo = ({ className = "h-8 w-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#2CA01C" />
    <circle cx="24" cy="24" r="13" fill="none" stroke="white" strokeWidth="2.5" />
    <path d="M18 19v10h2.5v-3h3c2.5 0 4-1.5 4-3.5S26 19 23.5 19H18z M20.5 21.5h3c.8 0 1.5.6 1.5 1.5s-.7 1.5-1.5 1.5h-3v-3z" fill="white" />
  </svg>
);

const SalesforceLogo = ({ className = "h-8 w-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#00A1E0" />
    <path d="M20 14c2.2 0 4.1 1.2 5.1 3 1-.8 2.3-1.2 3.7-1.2 3.5 0 6.2 2.8 6.2 6.2 0 .3 0 .6-.1.9 1.8.9 3.1 2.8 3.1 5 0 3.1-2.5 5.6-5.6 5.6H16.4c-3.5 0-6.4-2.9-6.4-6.4 0-2.6 1.6-4.9 3.9-5.8-.1-.5-.2-1-.2-1.5C13.7 16.5 16.5 14 20 14z" fill="white" />
  </svg>
);

const AIIngestionLogo = ({ className = "h-8 w-8" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="8" fill="#4285F4" />
    <path d="M24 12l-10 6v12l10 6 10-6V18l-10-6z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="24" cy="24" r="4" fill="white" />
    <line x1="24" y1="20" x2="24" y2="12" stroke="white" strokeWidth="1.5" />
    <line x1="27.5" y1="26" x2="34" y2="30" stroke="white" strokeWidth="1.5" />
    <line x1="20.5" y1="26" x2="14" y2="30" stroke="white" strokeWidth="1.5" />
  </svg>
);

const HubSpotLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" fill="#FF7A59" />
    <text x="20" y="26" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Arial">H</text>
  </svg>
);

const INTEGRATION_ICONS: Record<IntegrationKey, React.FC<{ className?: string }>> = {
  stripe: StripeLogo,
  quickbooks: QuickBooksLogo,
  salesforce: SalesforceLogo,
  hubspot: HubSpotLogo,
  erp_netsuite: NetSuiteIcon,
  erp_sage: SageIcon,
  ai_ingestion: AIIngestionLogo,
};

export const ContactSalesCard = () => {
  const { isEnabled, isLoading } = useIntegrationToggles();

  if (isLoading) return null;

  const disabledIntegrations = ALL_INTEGRATION_KEYS.filter(key => !isEnabled(key));

  if (disabledIntegrations.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="border-dashed border-muted-foreground/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Available Integrations
          </CardTitle>
          <CardDescription className="text-xs">
            These integrations are available for your account. Hover for details. Contact sales to get them enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {disabledIntegrations.map((key) => {
              const Icon = INTEGRATION_ICONS[key];
              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-2 p-3 rounded-lg border border-dashed border-muted-foreground/20 bg-muted/30 cursor-help transition-colors hover:bg-muted/50">
                      <Icon className="h-10 w-10 opacity-60" />
                      <span className="text-[11px] text-muted-foreground text-center font-medium leading-tight">
                        {INTEGRATION_LABELS[key]}
                      </span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                        Locked
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px] text-xs leading-relaxed">
                    <p className="font-semibold mb-1">{INTEGRATION_LABELS[key]}</p>
                    <p>{INTEGRATION_DESCRIPTIONS[key]}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          <div className="flex items-center justify-center pt-2">
            <Button variant="outline" size="sm" asChild>
              <a href="mailto:Support@recouply.ai" className="gap-2">
                <Mail className="h-4 w-4" />
                Contact Sales to Enable
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};