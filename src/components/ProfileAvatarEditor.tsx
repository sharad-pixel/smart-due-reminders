import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Camera, Trash2, User, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfileAvatarEditorProps {
  avatarUrl: string | null;
  name: string | null;
  email: string | null;
  uploading: boolean;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: () => void;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-12 w-12",
  md: "h-16 w-16",
  lg: "h-24 w-24",
  xl: "h-32 w-32",
};

const iconSizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
};

const textSizeClasses = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-3xl",
};

export const ProfileAvatarEditor = ({
  avatarUrl,
  name,
  email,
  uploading,
  onUpload,
  onDelete,
  size = "lg",
}: ProfileAvatarEditorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string | null, email: string | null): string => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
    setIsOpen(false);
  };

  const handleDeleteClick = () => {
    onDelete();
    setIsOpen(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onUpload(event);
  };

  return (
    <div className="relative">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            className="relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            disabled={uploading}
            aria-label="Edit profile picture"
          >
            <Avatar className={cn(sizeClasses[size], "ring-2 ring-border transition-all duration-200", isHovered && "ring-primary/50")}>
              {avatarUrl && (
                <AvatarImage 
                  src={avatarUrl} 
                  alt={name || "User"} 
                  className="object-cover"
                />
              )}
              <AvatarFallback className={cn(textSizeClasses[size], "bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold")}>
                {getInitials(name, email)}
              </AvatarFallback>
            </Avatar>
            
            {/* Hover overlay - Gmail style */}
            <div 
              className={cn(
                "absolute inset-0 rounded-full bg-black/60 flex items-center justify-center transition-opacity duration-200",
                (isHovered || isOpen) ? "opacity-100" : "opacity-0"
              )}
            >
              <Camera className={cn(iconSizeClasses[size], "text-white")} />
            </div>

            {/* Loading spinner overlay */}
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-black/70 flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
              </div>
            )}
          </button>
        </PopoverTrigger>
        
        <PopoverContent 
          className="w-56 p-2" 
          align="center" 
          side="bottom"
          sideOffset={8}
        >
          <div className="flex flex-col gap-1">
            {/* Header with current avatar preview */}
            <div className="flex items-center gap-3 p-2 mb-1">
              <Avatar className="h-10 w-10">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={name || "User"} />}
                <AvatarFallback className="text-sm bg-primary/10 text-primary">
                  {getInitials(name, email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{name || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              </div>
            </div>
            
            <div className="border-t border-border my-1" />
            
            {/* Upload option */}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-10 px-3 font-normal hover:bg-accent"
              onClick={handleUploadClick}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span>{avatarUrl ? "Change photo" : "Add a photo"}</span>
            </Button>
            
            {/* Delete option - only show if avatar exists */}
            {avatarUrl && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-10 px-3 font-normal text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDeleteClick}
                disabled={uploading}
              >
                <Trash2 className="h-4 w-4" />
                <span>Remove photo</span>
              </Button>
            )}
            
            {/* No photo option - to show initials */}
            {avatarUrl && (
              <>
                <div className="border-t border-border my-1" />
                <div className="px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    Your profile photo is visible to anyone who can view your profile.
                  </p>
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
};
