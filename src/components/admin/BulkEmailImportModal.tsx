import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ClipboardPaste, Users, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BulkEmailImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (emails: string[], segment: string, leadScore: number) => void;
  isImporting: boolean;
  campaigns: { id: string; name: string }[];
  onAssignToCampaign?: (emails: string[], campaignId: string) => void;
}

const leadPersonas = [
  { id: "new", label: "New Lead", score: 10, description: "Just discovered, needs nurturing" },
  { id: "engaged", label: "Engaged", score: 40, description: "Showing interest, opened emails" },
  { id: "hot", label: "Hot Lead", score: 80, description: "High intent, ready for conversion" },
  { id: "cold", label: "Cold Lead", score: 5, description: "Low engagement, needs reactivation" },
];

export const BulkEmailImportModal = ({
  open,
  onOpenChange,
  onImport,
  isImporting,
  campaigns,
  onAssignToCampaign,
}: BulkEmailImportModalProps) => {
  const [emailText, setEmailText] = useState("");
  const [selectedPersona, setSelectedPersona] = useState("new");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("none");

  // Parse and validate emails
  const parseEmails = (text: string): string[] => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    return [...new Set(matches.map(e => e.toLowerCase()))];
  };

  const parsedEmails = parseEmails(emailText);
  const persona = leadPersonas.find(p => p.id === selectedPersona)!;

  const handleImport = () => {
    if (parsedEmails.length === 0) return;
    onImport(parsedEmails, selectedPersona, persona.score);
    
    // If campaign selected, assign after import
    if (selectedCampaign && selectedCampaign !== "none" && onAssignToCampaign) {
      onAssignToCampaign(parsedEmails, selectedCampaign);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setEmailText(prev => prev ? `${prev}\n${text}` : text);
    } catch (err) {
      console.error("Clipboard paste failed:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5 text-primary" />
            Bulk Import Leads
          </DialogTitle>
          <DialogDescription>
            Paste email addresses to quickly add leads and assign them to a persona for targeted outreach
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Email Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Email Addresses</Label>
              <Button variant="outline" size="sm" onClick={handlePaste}>
                <ClipboardPaste className="h-3 w-3 mr-2" />
                Paste from Clipboard
              </Button>
            </div>
            <Textarea
              placeholder="Paste email addresses here (one per line, comma-separated, or any format - we'll extract valid emails automatically)"
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            {emailText && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={parsedEmails.length > 0 ? "default" : "destructive"}>
                  {parsedEmails.length} valid email{parsedEmails.length !== 1 ? "s" : ""} found
                </Badge>
                {parsedEmails.length > 0 && parsedEmails.length <= 10 && (
                  <span className="text-muted-foreground truncate">
                    {parsedEmails.slice(0, 3).join(", ")}
                    {parsedEmails.length > 3 && ` +${parsedEmails.length - 3} more`}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Lead Persona Selection */}
          <div className="space-y-3">
            <Label>Lead Persona (Segment)</Label>
            <p className="text-sm text-muted-foreground">
              Assign these leads to a persona for targeted outreach messaging
            </p>
            <div className="grid grid-cols-2 gap-3">
              {leadPersonas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPersona(p.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedPersona === p.id
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium">{p.label}</p>
                    <Badge variant="secondary" className="text-xs">
                      Score: {p.score}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Campaign Assignment */}
          {campaigns.length > 0 && (
            <div className="space-y-2">
              <Label>Assign to Campaign (Optional)</Label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No campaign</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {parsedEmails.length > 50 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Large import detected ({parsedEmails.length} emails). This may take a moment to process.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsedEmails.length === 0 || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Users className="h-4 w-4 mr-2" />
                Import {parsedEmails.length} Lead{parsedEmails.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
