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
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const iconSizeClasses = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export const NavProfileAvatar = ({
  avatarUrl,
  userName,
  size = "md",
}: NavProfileAvatarProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Avatar className={cn(sizeClasses[size], "ring-2 ring-transparent transition-all duration-200", isHovered && "ring-primary/30")}>
        <AvatarImage 
          src={avatarUrl || undefined} 
          alt={userName} 
          className="object-cover"
        />
        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-sm">
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
        <Camera className={cn(iconSizeClasses[size], "text-white")} />
      </div>
    </div>
  );
};
