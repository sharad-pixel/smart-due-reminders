import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getPersonaByName, PersonaConfig } from "@/lib/personaConfig";

interface PersonaAvatarProps {
  persona: string | PersonaConfig;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showName?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-12 w-12 text-lg",
  xl: "h-16 w-16 text-xl",
};

export const PersonaAvatar = ({ 
  persona, 
  size = "md", 
  showName = false,
  className 
}: PersonaAvatarProps) => {
  const personaConfig = typeof persona === "string" 
    ? getPersonaByName(persona)
    : persona;

  if (!personaConfig) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={personaConfig.avatar} alt={personaConfig.name} />
        <AvatarFallback className={`${personaConfig.bgColor} text-white`}>
          {personaConfig.name[0]}
        </AvatarFallback>
      </Avatar>
      {showName && (
        <span className="text-sm font-medium">{personaConfig.name}</span>
      )}
    </div>
  );
};
