import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Smartphone, Mail, Key } from "lucide-react";
import { useMFA } from "@/hooks/useMFA";
import { toast } from "sonner";

export function MFASettings() {
  const { mfaSettings, isLoading, enableMFA, disableMFA } = useMFA();
  const [mfaMethod, setMfaMethod] = useState<"email" | "sms" | "totp">("email");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  const handleEnableMFA = async () => {
    try {
      const result = await enableMFA({
        method: mfaMethod,
        phoneNumber: mfaMethod === "sms" ? phoneNumber : undefined,
      });
      setBackupCodes(result.backupCodes);
      setShowBackupCodes(true);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Multi-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!mfaSettings?.mfa_enabled ? (
          <>
            <div className="space-y-2">
              <Label>Authentication Method</Label>
              <Select value={mfaMethod} onValueChange={(value: any) => setMfaMethod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Code
                    </div>
                  </SelectItem>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      SMS Code
                    </div>
                  </SelectItem>
                  <SelectItem value="totp">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Authenticator App
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mfaMethod === "sms" && (
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
            )}

            {showBackupCodes && backupCodes.length > 0 && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">Save these backup codes safely:</p>
                    <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                      {backupCodes.map((code, i) => (
                        <div key={i} className="p-2 bg-muted rounded">
                          {code}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You can use these codes to sign in if you lose access to your authentication method.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <Button onClick={handleEnableMFA} className="w-full">
              Enable MFA
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">MFA is enabled</p>
                    <p className="text-sm text-muted-foreground">
                      Method: {mfaSettings.mfa_method?.toUpperCase()}
                    </p>
                  </div>
                  <Shield className="h-8 w-8 text-green-500" />
                </div>
              </AlertDescription>
            </Alert>
            <Button onClick={() => disableMFA()} variant="destructive" className="w-full">
              Disable MFA
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
