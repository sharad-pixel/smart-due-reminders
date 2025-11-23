import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PersonaAvatar } from "./PersonaAvatar";
import { getPersonaByName, PersonaConfig } from "@/lib/personaConfig";

interface PersonaPreviewProps {
  persona: string | PersonaConfig;
}

export const PersonaPreview = ({ persona }: PersonaPreviewProps) => {
  const personaConfig = typeof persona === "string" 
    ? getPersonaByName(persona)
    : persona;

  if (!personaConfig) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <PersonaAvatar persona={personaConfig} size="lg" />
          <div>
            <CardTitle>{personaConfig.name}</CardTitle>
            <CardDescription>{personaConfig.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-semibold mb-1">Aging Bucket</p>
          <Badge variant="outline">
            {personaConfig.bucketMin}-{personaConfig.bucketMax || "+"} Days Past Due
          </Badge>
        </div>
        <div>
          <p className="text-sm font-semibold mb-1">Tone</p>
          <p className="text-sm text-muted-foreground">{personaConfig.tone}</p>
        </div>
      </CardContent>
    </Card>
  );
};
