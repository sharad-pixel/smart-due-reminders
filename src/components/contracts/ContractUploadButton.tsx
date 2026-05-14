import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSearch } from "lucide-react";
import { ContractUploadDialog } from "./ContractUploadDialog";

interface Props {
  debtorId?: string;
  debtorName?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
  className?: string;
}

export function ContractUploadButton({
  debtorId, debtorName, variant = "default", size = "default", label = "AI Smart Ingestion", className,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <FileSearch className="h-4 w-4 mr-2" />
        {label}
      </Button>
      <ContractUploadDialog
        open={open}
        onOpenChange={setOpen}
        debtorId={debtorId}
        debtorName={debtorName}
      />
    </>
  );
}
