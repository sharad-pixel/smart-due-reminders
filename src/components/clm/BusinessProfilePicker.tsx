import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Boxes, Cloud, Wrench, HeartPulse, FileText } from "lucide-react";
import { BUSINESS_PROFILES, BusinessProfileId } from "@/lib/clm/businessProfiles";
import { cn } from "@/lib/utils";

const ICONS: Record<BusinessProfileId, JSX.Element> = {
  general: <FileText className="h-4 w-4" />,
  saas: <Cloud className="h-4 w-4" />,
  goods: <Boxes className="h-4 w-4" />,
  services: <Wrench className="h-4 w-4" />,
  healthcare: <HeartPulse className="h-4 w-4" />,
};

interface Props {
  value: BusinessProfileId;
  onChange: (id: BusinessProfileId) => void;
  compact?: boolean;
}

export const BusinessProfilePicker = ({ value, onChange, compact }: Props) => {
  return (
    <div
      className={cn(
        "grid gap-2",
        compact ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5",
      )}
    >
      {BUSINESS_PROFILES.map((p) => {
        const active = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={cn(
              "text-left rounded-lg border p-3 transition-colors hover:bg-muted/50 relative",
              active && "border-primary ring-1 ring-primary/40 bg-primary/5",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-6 w-6 rounded grid place-items-center",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {ICONS[p.id]}
              </span>
              <p className="text-sm font-semibold">{p.short}</p>
              {active && (
                <Badge variant="default" className="ml-auto h-5 px-1.5">
                  <Check className="h-3 w-3" />
                </Badge>
              )}
            </div>
            {!compact && (
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">{p.description}</p>
            )}
          </button>
        );
      })}
    </div>
  );
};
