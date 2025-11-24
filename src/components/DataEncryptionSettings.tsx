import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Key, CheckCircle } from "lucide-react";

export const DataEncryptionSettings = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Data Encryption</CardTitle>
        </div>
        <CardDescription>
          Your data is protected with enterprise-grade encryption
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Encryption at Rest</p>
                <p className="text-xs text-muted-foreground">
                  AES-256 encryption for stored data
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Active
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <Key className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Encryption in Transit</p>
                <p className="text-xs text-muted-foreground">
                  TLS 1.3 for all data transfers
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Active
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Field-Level Encryption</p>
                <p className="text-xs text-muted-foreground">
                  Sensitive fields encrypted separately
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Active
            </Badge>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground">
            <strong>Protected Data:</strong> Payment information, authentication tokens, 
            API keys, personal identifiable information (PII), and financial records are 
            all encrypted using industry-standard algorithms.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
