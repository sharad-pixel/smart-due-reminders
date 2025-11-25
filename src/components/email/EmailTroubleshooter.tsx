import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HelpCircle, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailTroubleshooterProps {
  email: string;
}

export const EmailTroubleshooter = ({ email }: EmailTroubleshooterProps) => {
  const [issue, setIssue] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState("");

  const handleGetHelp = async () => {
    if (!issue.trim()) {
      toast.error("Please describe the issue you're experiencing");
      return;
    }

    setLoading(true);
    setSuggestion("");

    try {
      const { data, error } = await supabase.functions.invoke('email-setup-assistant', {
        body: { 
          action: "troubleshoot", 
          email,
          issue 
        }
      });

      if (error) throw error;

      setSuggestion(data.suggestion);
    } catch (error: any) {
      console.error("Error getting help:", error);
      toast.error("Failed to get AI assistance. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-orange-600" />
          <CardTitle className="text-orange-900 dark:text-orange-100">Having Trouble?</CardTitle>
        </div>
        <CardDescription>
          Describe the issue you're experiencing and get AI-powered troubleshooting help
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Example: I'm getting authentication errors when trying to connect Gmail..."
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          rows={3}
          className="bg-background"
        />
        
        <Button 
          onClick={handleGetHelp}
          disabled={loading || !issue.trim()}
          variant="outline"
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing issue...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Get AI Help
            </>
          )}
        </Button>

        {suggestion && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <Sparkles className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm whitespace-pre-wrap">
              {suggestion}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
