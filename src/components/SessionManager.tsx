import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, Tablet, AlertCircle, Shield, Clock, Globe, LogOut } from "lucide-react";
import { useSessions } from "@/hooks/useSessions";
import { format, formatDistanceToNow } from "date-fns";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const IDLE_TIMEOUT_MIN = 15;
const ABSOLUTE_TIMEOUT_HR = 8;

export function SessionManager() {
  const { sessions, isLoading, revokeSession } = useSessions();

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case "mobile":
        return <Smartphone className="h-5 w-5" />;
      case "tablet":
        return <Tablet className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  const activeSessions = sessions?.filter((s) => !s.is_current) || [];
  const currentSession = sessions?.find((s) => s.is_current);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3 mx-auto" />
            <div className="h-3 bg-muted rounded w-1/2 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security Policy Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Session Security Policy</CardTitle>
          </div>
          <CardDescription>
            Enterprise-grade session management compliant with PCI-DSS and FFIEC standards
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Idle Timeout</p>
                <p className="text-muted-foreground">{IDLE_TIMEOUT_MIN} minutes of inactivity</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Absolute Timeout</p>
                <p className="text-muted-foreground">{ABSOLUTE_TIMEOUT_HR}-hour maximum session</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Cross-Tab Sync</p>
                <p className="text-muted-foreground">Activity synced across tabs</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Session */}
      {currentSession && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-green-600" />
                <CardTitle className="text-base">Current Session</CardTitle>
              </div>
              <Badge variant="secondary" className="border">
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-muted">
                {getDeviceIcon(currentSession.device_type)}
              </div>
              <div className="flex-1 space-y-1">
                <p className="font-medium">
                  {currentSession.device_name || currentSession.browser || "Unknown Device"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentSession.os} • {currentSession.browser}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>IP: {currentSession.ip_address || "Unknown"}</span>
                  <span>
                    Started: {format(new Date(currentSession.created_at), "PPp")}
                  </span>
                  <span>
                    Last active:{" "}
                    {formatDistanceToNow(new Date(currentSession.last_active_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Other Active Sessions</CardTitle>
              <CardDescription>
                {activeSessions.length === 0
                  ? "No other sessions detected"
                  : `${activeSessions.length} other session${activeSessions.length > 1 ? "s" : ""} active`}
              </CardDescription>
            </div>
            {activeSessions.length > 1 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <LogOut className="h-4 w-4 mr-1" />
                    Revoke All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke all other sessions?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will immediately sign out all other devices. This action
                      is recommended if you suspect unauthorized access to your
                      account.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        activeSessions.forEach((s) => revokeSession(s.id));
                      }}
                    >
                      Revoke All Sessions
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeSessions.length > 0 ? (
            activeSessions.map((session, index) => (
              <div key={session.id}>
                {index > 0 && <Separator className="mb-3" />}
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      {getDeviceIcon(session.device_type)}
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-sm">
                        {session.device_name || session.browser || "Unknown Device"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.os} • {session.browser}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>IP: {session.ip_address || "Unknown"}</span>
                        <span>
                          Last active:{" "}
                          {formatDistanceToNow(new Date(session.last_active_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                        Revoke
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke this session?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will immediately sign out the device:{" "}
                          <strong>
                            {session.device_name || session.browser || "Unknown"}
                          </strong>
                          {session.ip_address && ` (IP: ${session.ip_address})`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => revokeSession(session.id)}
                        >
                          Revoke Session
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-2 p-4 text-muted-foreground bg-muted/50 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">No other active sessions. Your account is only signed in on this device.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
