import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertCircle, Sparkles, Check, X } from "lucide-react";

interface AIPromptCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedDebtor {
  data: {
    name: string;
    company_name: string;
    email: string;
    phone: string;
    notes: string;
  };
  duplicate_status: "none" | "existing_match" | "multiple_matches";
  matched_debtor_id: string | null;
  matched_debtor_name: string | null;
  possible_matches: Array<{ id: string; name: string; company_name: string }>;
  missing_required_fields: string[];
  has_errors: boolean;
}

interface ParsedInvoice {
  data: {
    invoice_number: string;
    amount: number | null;
    currency: string;
    issue_date: string;
    due_date: string;
    external_link: string;
    notes: string;
  };
  duplicate_invoice: boolean;
  existing_invoice_id: string | null;
  missing_required_fields: string[];
  has_errors: boolean;
}

export const AIPromptCreationModal = ({ open, onOpenChange, onSuccess }: AIPromptCreationModalProps) => {
  const [step, setStep] = useState<"prompt" | "preview">("prompt");
  const [promptText, setPromptText] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<{
    debtor: ParsedDebtor;
    invoices: ParsedInvoice[];
  } | null>(null);
  const [debtorChoice, setDebtorChoice] = useState<"use_existing" | "create_new">("create_new");
  const [selectedExistingId, setSelectedExistingId] = useState("");
  const [editedDebtor, setEditedDebtor] = useState<any>(null);
  const [editedInvoices, setEditedInvoices] = useState<any[]>([]);

  const examplePrompts = [
    "Create a new customer: John Smith at Smith Plumbing, email john@smithplumbing.com, phone 555-2020. Add an invoice for $350 for water heater repair, due Friday.",
    "Add a new invoice for existing customer Acme Garage: $120 brake inspection, due next Tuesday.",
    "New company: BlueSky HVAC. Create 3 invoices: $200 diagnostic due today, $600 install deposit due Friday, $400 balance due in 30 days."
  ];

  const handleGenerate = async () => {
    if (!promptText.trim()) {
      toast.error("Please enter a description");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-parse-creation-prompt", {
        body: { prompt_text: promptText }
      });

      if (error) throw error;

      setParsedData(data);
      setEditedDebtor(data.debtor.data);
      setEditedInvoices(data.invoices.map((inv: ParsedInvoice) => inv.data));
      
      if (data.debtor.duplicate_status === "existing_match") {
        setDebtorChoice("use_existing");
        setSelectedExistingId(data.debtor.matched_debtor_id);
      }

      setStep("preview");
    } catch (error: any) {
      console.error("Parse error:", error);
      toast.error(error.message || "Failed to parse prompt. Please try again with more details.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!parsedData) return;

    // Validate before creation
    const hasDebtorErrors = debtorChoice === "create_new" && 
      (!editedDebtor.name && !editedDebtor.company_name);
    
    const hasInvoiceErrors = editedInvoices.some(inv => 
      !inv.amount || inv.amount <= 0 || !inv.due_date
    );

    if (hasDebtorErrors || hasInvoiceErrors) {
      toast.error("Please fix all required fields before creating");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-create-records", {
        body: {
          debtor_choice: debtorChoice,
          debtor_existing_id: debtorChoice === "use_existing" ? selectedExistingId : null,
          debtor_data: editedDebtor,
          invoice_list: editedInvoices,
          raw_prompt: promptText,
          structured_json: parsedData
        }
      });

      if (error) throw error;

      toast.success(`Created ${data.created_invoice_ids.length} invoice(s) successfully!`);
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error("Creation error:", error);
      toast.error(error.message || "Failed to create records");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep("prompt");
    setPromptText("");
    setParsedData(null);
    setEditedDebtor(null);
    setEditedInvoices([]);
    setDebtorChoice("create_new");
    setSelectedExistingId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Create with AI Prompt
          </DialogTitle>
          <DialogDescription>
            Describe the customer and invoice details in natural language. The AI will extract structured data for your approval.
          </DialogDescription>
        </DialogHeader>

        {step === "prompt" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">Describe what you want to create</Label>
              <Textarea
                id="prompt"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Example: Create a new customer John Doe at ABC Corp, email john@abc.com. Add an invoice for $500 due next Friday for consulting services."
                rows={6}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Example prompts:</Label>
              <div className="space-y-2">
                {examplePrompts.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPromptText(example)}
                    className="w-full text-left p-3 text-sm border rounded-md hover:bg-accent transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={loading || !promptText.trim()}>
                {loading ? "Generating..." : "Generate Records"}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && parsedData && (
          <div className="space-y-6">
            {/* Debtor Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Customer Information</h3>
                {parsedData.debtor.has_errors && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <X className="h-3 w-3" />
                    Missing Required Fields
                  </Badge>
                )}
              </div>

              {parsedData.debtor.duplicate_status === "existing_match" && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="space-y-2">
                    <p>This looks like an existing customer: <strong>{parsedData.debtor.matched_debtor_name}</strong></p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={debtorChoice === "use_existing" ? "default" : "outline"}
                        onClick={() => setDebtorChoice("use_existing")}
                      >
                        Use Existing
                      </Button>
                      <Button
                        size="sm"
                        variant={debtorChoice === "create_new" ? "default" : "outline"}
                        onClick={() => setDebtorChoice("create_new")}
                      >
                        Create New
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {parsedData.debtor.duplicate_status === "multiple_matches" && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="space-y-2">
                    <p>Multiple potential matches found. Select one or create new:</p>
                    <Select value={selectedExistingId} onValueChange={(val) => {
                      setSelectedExistingId(val);
                      setDebtorChoice("use_existing");
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select existing customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {parsedData.debtor.possible_matches.map(match => (
                          <SelectItem key={match.id} value={match.id}>
                            {match.name || match.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDebtorChoice("create_new")}
                    >
                      Create New Instead
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {debtorChoice === "create_new" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className={parsedData.debtor.missing_required_fields.includes("name or company_name") ? "text-destructive" : ""}>
                      Name {parsedData.debtor.missing_required_fields.includes("name or company_name") && "*"}
                    </Label>
                    <Input
                      id="name"
                      value={editedDebtor.name}
                      onChange={(e) => setEditedDebtor({ ...editedDebtor, name: e.target.value })}
                      className={parsedData.debtor.missing_required_fields.includes("name or company_name") && !editedDebtor.name && !editedDebtor.company_name ? "border-destructive" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name</Label>
                    <Input
                      id="company_name"
                      value={editedDebtor.company_name}
                      onChange={(e) => setEditedDebtor({ ...editedDebtor, company_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={editedDebtor.email}
                      onChange={(e) => setEditedDebtor({ ...editedDebtor, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={editedDebtor.phone}
                      onChange={(e) => setEditedDebtor({ ...editedDebtor, phone: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Invoices Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Invoices ({editedInvoices.length})</h3>
              <div className="space-y-4">
                {editedInvoices.map((invoice, idx) => {
                  const originalInvoice = parsedData.invoices[idx];
                  return (
                    <div key={idx} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Invoice #{idx + 1}</h4>
                        {originalInvoice.duplicate_invoice && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Duplicate Number
                          </Badge>
                        )}
                        {originalInvoice.has_errors && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <X className="h-3 w-3" />
                            Missing Required
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Invoice Number</Label>
                          <Input
                            value={invoice.invoice_number}
                            onChange={(e) => {
                              const updated = [...editedInvoices];
                              updated[idx].invoice_number = e.target.value;
                              setEditedInvoices(updated);
                            }}
                            placeholder="Auto-generated if empty"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className={originalInvoice.missing_required_fields.includes("amount") ? "text-destructive" : ""}>
                            Amount *
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={invoice.amount || ""}
                            onChange={(e) => {
                              const updated = [...editedInvoices];
                              updated[idx].amount = parseFloat(e.target.value);
                              setEditedInvoices(updated);
                            }}
                            className={originalInvoice.missing_required_fields.includes("amount") ? "border-destructive" : ""}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Issue Date</Label>
                          <Input
                            type="date"
                            value={invoice.issue_date}
                            onChange={(e) => {
                              const updated = [...editedInvoices];
                              updated[idx].issue_date = e.target.value;
                              setEditedInvoices(updated);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className={originalInvoice.missing_required_fields.includes("due_date") ? "text-destructive" : ""}>
                            Due Date *
                          </Label>
                          <Input
                            type="date"
                            value={invoice.due_date}
                            onChange={(e) => {
                              const updated = [...editedInvoices];
                              updated[idx].due_date = e.target.value;
                              setEditedInvoices(updated);
                            }}
                            className={originalInvoice.missing_required_fields.includes("due_date") ? "border-destructive" : ""}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep("prompt")}>
                Back
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={loading || (
                  debtorChoice === "create_new" && 
                  (!editedDebtor.name && !editedDebtor.company_name)
                ) || editedInvoices.some(inv => !inv.amount || !inv.due_date)}
              >
                {loading ? "Creating..." : "Create Records"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};