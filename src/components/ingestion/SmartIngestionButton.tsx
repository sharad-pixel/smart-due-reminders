import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { SmartIngestionChooserDialog } from "./SmartIngestionChooserDialog";

interface Props {
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
  className?: string;
}

/**
 * AI Smart Ingestion entry point — uses the AI sparkles icon and opens
 * the chooser dialog where the user picks Invoices or Contracts.
 */
export function SmartIngestionButton({
  variant = "outline",
  size = "default",
  label = "AI Smart Ingestion",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <Sparkles className="h-4 w-4 mr-2" />
        {label}
      </Button>
      <SmartIngestionChooserDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export default SmartIngestionButton;
