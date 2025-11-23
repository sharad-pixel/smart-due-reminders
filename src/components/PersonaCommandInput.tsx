import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PersonaCommandInputProps {
  placeholder?: string;
  onSubmit: (command: string) => Promise<void>;
  contextType?: "invoice" | "debtor" | "global";
  contextId?: string;
  suggestions?: string[];
}

export const PersonaCommandInput = ({
  placeholder = "Ask your AI agents… e.g., 'Send a reminder for this invoice'",
  onSubmit,
  contextType = "global",
  contextId,
  suggestions = [
    "Send an email for this invoice",
    "Draft a friendly reminder",
    "Generate a firm message",
    "Ask Katy to send a follow-up",
    "Have Sam write a polite reminder"
  ]
}: PersonaCommandInputProps) => {
  const [command, setCommand] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      await onSubmit(command);
      setCommand("");
      setShowSuggestions(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuggestionClick = async (suggestion: string) => {
    setCommand(suggestion);
    setShowSuggestions(false);
    setIsProcessing(true);
    try {
      await onSubmit(suggestion);
      setCommand("");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative w-full">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder}
            disabled={isProcessing}
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={!command.trim() || isProcessing}>
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing
            </>
          ) : (
            "Send"
          )}
        </Button>
      </form>

      {showSuggestions && !isProcessing && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-lg shadow-lg z-50 p-3">
          <p className="text-xs text-muted-foreground mb-2 font-semibold">Quick Commands:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <Badge
                key={index}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </Badge>
            ))}
          </div>
          <button
            onClick={() => setShowSuggestions(false)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
