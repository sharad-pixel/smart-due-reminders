import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getPersonaByName, PersonaConfig } from "@/lib/personaConfig";

interface PersonaAvatarProps {
  persona: string | PersonaConfig;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showName?: boolean;
  showRing?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

const ringWidthClasses = {
  xs: "ring-1",
  sm: "ring-2",
  md: "ring-2",
  lg: "ring-[3px]",
  xl: "ring-4",
};

const nameSizeClasses = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base font-medium",
  xl: "text-lg font-semibold",
};

export const PersonaAvatar = ({ 
  persona, 
  size = "md", 
  showName = false,
  showRing = true,
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
      <Avatar 
        className={cn(
          sizeClasses[size],
          showRing && ringWidthClasses[size],
          showRing && personaConfig.ringColor,
          "ring-offset-2 ring-offset-background transition-all duration-200"
        )}
      >
        <AvatarImage 
          src={personaConfig.avatar} 
          alt={personaConfig.name}
          className="object-cover"
        />
        <AvatarFallback 
          className={cn(
            "bg-gradient-to-br text-white font-semibold",
            personaConfig.bgGradient
          )}
        >
          {personaConfig.name[0]}
        </AvatarFallback>
      </Avatar>
      {showName && (
        <span className={cn(nameSizeClasses[size], personaConfig.textColor)}>
          {personaConfig.name}
        </span>
      )}
    </div>
  );
};
