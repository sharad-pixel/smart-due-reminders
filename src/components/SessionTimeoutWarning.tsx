import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield, Clock } from "lucide-react";

interface SessionTimeoutWarningProps {
  isOpen: boolean;
  secondsRemaining: number;
  onExtend: () => void;
}

export function SessionTimeoutWarning({
  isOpen,
  secondsRemaining,
  onExtend,
}: SessionTimeoutWarningProps) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeDisplay =
    minutes > 0
      ? `${minutes}:${seconds.toString().padStart(2, "0")}`
      : `${seconds}s`;

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <Shield className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-lg">
              Session Timeout Warning
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <p>
              Your session will expire due to inactivity in compliance with
              financial services security standards (PCI-DSS).
            </p>
            <div className="flex items-center justify-center gap-2 py-4">
              <Clock className="h-5 w-5 text-destructive animate-pulse" />
              <span className="text-3xl font-mono font-bold text-destructive">
                {timeDisplay}
              </span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Click below to continue your session, or you will be automatically
              signed out.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onExtend} className="w-full">
            Continue Session
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
