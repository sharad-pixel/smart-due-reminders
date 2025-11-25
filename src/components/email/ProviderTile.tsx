import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProviderTileProps {
  provider: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  recommended?: boolean;
  onClick: () => void;
}

export const ProviderTile = ({
  provider,
  title,
  description,
  icon,
  recommended,
  onClick,
}: ProviderTileProps) => {
  return (
    <Card
      className={cn(
        "cursor-pointer hover:border-primary transition-all hover:shadow-lg",
        recommended && "border-primary"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="text-primary">{icon}</div>
            {recommended && (
              <Badge variant="secondary" className="text-xs">
                Recommended
              </Badge>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
