import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavProfileAvatarProps {
  avatarUrl: string | null;
  userName: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
};

export const NavProfileAvatar = ({
  avatarUrl,
  userName,
  size = "md",
}: NavProfileAvatarProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={cn("relative flex-shrink-0", sizeClasses[size])}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Avatar className={cn("h-full w-full transition-all duration-200", isHovered && "ring-2 ring-primary/30")}>
        <AvatarImage 
          src={avatarUrl || undefined} 
          alt={userName} 
          className="object-cover"
        />
        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-xs">
          {userName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      
      {/* Hover overlay - Gmail style */}
      <div 
        className={cn(
          "absolute inset-0 rounded-full bg-black/50 flex items-center justify-center transition-opacity duration-200 pointer-events-none",
          isHovered ? "opacity-100" : "opacity-0"
        )}
      >
        <Camera className="h-4 w-4 text-white" />
      </div>
    </div>
  );
};
