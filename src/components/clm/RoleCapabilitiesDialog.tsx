import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { RoleCapabilitiesCard } from "./RoleCapabilitiesCard";

interface Props {
  myRole?: string | null;
  trigger?: React.ReactNode;
}

export const RoleCapabilitiesDialog = ({ myRole, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Role Matrix
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Role Permissions
          </DialogTitle>
          <DialogDescription>
            One simple collaborator role keeps governance frictionless. Signers are added once the
            contract is finalized.
          </DialogDescription>
        </DialogHeader>
        <RoleCapabilitiesCard myRole={myRole} />
      </DialogContent>
    </Dialog>
  );
};
