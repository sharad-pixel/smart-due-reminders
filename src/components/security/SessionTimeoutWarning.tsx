import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield } from "lucide-react";

interface SessionTimeoutWarningProps {
  isOpen: boolean;
  /** Kept for backwards-compat with existing callers; no longer displayed. */
  secondsRemaining?: number;
  /** Now used as the "Login" handler — signs out and routes to /login. */
  onExtend: () => void;
}

export function SessionTimeoutWarning({
  isOpen,
  onExtend,
}: SessionTimeoutWarningProps) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-full bg-destructive/10">
              <Shield className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle className="text-lg">
              Timed Out — Login
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            Your session has expired due to inactivity in compliance with
            financial services security standards (PCI-DSS). Please sign in
            again to continue.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onExtend} className="w-full">
            Login
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
