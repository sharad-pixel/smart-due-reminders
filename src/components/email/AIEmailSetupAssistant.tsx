import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AIEmailSetupAssistantProps {
  onEmailDetected: (email: string, provider: string, config: any) => void;
}

export const AIEmailSetupAssistant = ({ onEmailDetected }: AIEmailSetupAssistantProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [guidance, setGuidance] = useState("");
  const [provider, setProvider] = useState("");

  const handleDetectProvider = async () => {
    if (!email || !email.includes('@')) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setGuidance("");
    
    try {
      // Get AI-powered guidance and auto-detect provider
      const { data, error } = await supabase.functions.invoke('email-setup-assistant', {
        body: { action: "get_guidance", email }
      });

      if (error) throw error;

      setProvider(data.config?.name || data.provider);
      setGuidance(data.guidance);
      onEmailDetected(email, data.provider, data.config);
      
      toast.success(`${data.config?.name || 'Email provider'} detected!`);
    } catch (error: any) {
      console.error("Error detecting provider:", error);
      toast.error("Failed to detect provider. Please try manual setup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>AI-Powered Email Setup</CardTitle>
        </div>
        <CardDescription>
          Enter your email address and let AI guide you through the setup process
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDetectProvider()}
              className="pl-10"
            />
          </div>
          <Button 
            onClick={handleDetectProvider}
            disabled={loading || !email}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Detecting...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Detect & Guide
              </>
            )}
          </Button>
        </div>

        {guidance && (
          <Alert className="border-primary/20 bg-primary/5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription>
              <div className="font-medium mb-2">{provider} detected!</div>
              <div className="text-sm text-muted-foreground">{guidance}</div>
            </AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Best Practices:</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside text-muted-foreground">
              <li>Use OAuth (Sign in with Google/Outlook) when available for maximum security</li>
              <li>Generate app-specific passwords instead of using your main password</li>
              <li>Enable 2FA on your email account for better security</li>
              <li>Test the connection before saving to ensure it works</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
