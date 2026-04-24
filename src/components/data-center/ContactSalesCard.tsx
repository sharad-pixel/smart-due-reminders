import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIntegrationToggles, ALL_INTEGRATION_KEYS, INTEGRATION_LABELS, INTEGRATION_DESCRIPTIONS } from "@/hooks/useIntegrationToggles";
import type { IntegrationKey } from "@/hooks/useIntegrationToggles";
import { NetSuiteIcon, SageIcon, OracleIcon, DnBIcon } from "@/components/icons/ERPIcons";

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

const GoogleDriveLogo = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA"/>
    <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L3.45 44.6c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00AC47"/>
    <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.85l5.85 10.65L73.55 76.8z" fill="#EA4335"/>
    <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2L43.65 25z" fill="#00832D"/>
    <path d="M59.85 49H27.5l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.4c1.6 0 3.15-.45 4.5-1.2L59.85 49z" fill="#2684FC"/>
    <path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.2 24h27.45c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#FFBA00"/>
  </svg>
);

const GoogleSheetsLogo = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path d="M37 45H11c-1.657 0-3-1.343-3-3V6c0-1.657 1.343-3 3-3h19l10 10v29c0 1.657-1.343 3-3 3z" fill="#43A047"/>
    <path d="M40 13H30V3l10 10z" fill="#C8E6C9"/>
    <path d="M30 3v10h10L30 3z" fill="#2E7D32" opacity=".5"/>
    <rect x="12" y="22" width="24" height="18" rx="1" fill="white" opacity=".9"/>
    <line x1="12" y1="28" x2="36" y2="28" stroke="#43A047" strokeWidth="1"/>
    <line x1="12" y1="34" x2="36" y2="34" stroke="#43A047" strokeWidth="1"/>
    <line x1="22" y1="22" x2="22" y2="40" stroke="#43A047" strokeWidth="1"/>
  </svg>
);

const AIIngestionLogo = ({ className = "h-8 w-8" }: { className?: string }) => (
  <div className={`flex items-center gap-1 ${className}`}>
    <GoogleDriveLogo className="h-full w-auto" />
    <GoogleSheetsLogo className="h-full w-auto" />
  </div>
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
  erp_oracle: OracleIcon,
  erp_sage: SageIcon,
  dnb: DnBIcon,
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