import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, Tablet, AlertCircle } from "lucide-react";
import { useSessions } from "@/hooks/useSessions";
import { format } from "date-fns";

export function SessionManager() {
  const { sessions, isLoading, revokeSession } = useSessions();

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case "mobile":
        return <Smartphone className="h-4 w-4" />;
      case "tablet":
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return <div>Loading sessions...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Sessions</CardTitle>
        <CardDescription>
          Manage your active sessions across different devices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessions && sessions.length > 0 ? (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-start gap-3">
                {getDeviceIcon(session.device_type)}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {session.device_name || session.browser || "Unknown Device"}
                    </p>
                    {session.is_current && (
                      <Badge variant="secondary">Current</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {session.os} • {session.browser}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    IP: {session.ip_address || "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last active: {format(new Date(session.last_active_at), "PPp")}
                  </p>
                </div>
              </div>
              {!session.is_current && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => revokeSession(session.id)}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))
        ) : (
          <div className="flex items-center gap-2 p-4 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <p>No active sessions found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
