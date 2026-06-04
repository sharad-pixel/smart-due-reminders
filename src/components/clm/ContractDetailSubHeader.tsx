import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PRESET_TYPES = [
  "MSA",
  "SOW",
  "Order Form",
  "Subscription",
  "Amendment",
  "Renewal",
  "Addendum",
  "NDA",
  "Other",
];

interface Props {
  importId: string;
  initialContractType?: string | null;
  onChanged: () => void;
  onScrollToLinks: () => void;
}

export const ContractDetailSubHeader = ({
  importId,
  initialContractType,
  onChanged,
  onScrollToLinks,
}: Props) => {
  const initial = initialContractType?.trim() || "";
  const initialMatch = useMemo(
    () =>
      PRESET_TYPES.find(
        (t) => t.toLowerCase() === initial.toLowerCase(),
      ) || (initial ? "__custom__" : ""),
    [initial],
  );

  const [value, setValue] = useState<string>(initialMatch);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(initialMatch);
  }, [initialMatch]);

  const save = async (next: string) => {
    const toSave =
      next === "__custom__" ? initial : next === "" ? null : next;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("live_contract_imports")
        .update({ contract_type: toSave } as any)
        .eq("id", importId);
      if (error) throw error;
      toast.success("Contract type updated");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update contract type");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 -mt-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        <span>Type</span>
        <Select
          value={value}
          onValueChange={(v) => {
            setValue(v);
            save(v);
          }}
          disabled={saving}
        >
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="Select contract type…" />
          </SelectTrigger>
          <SelectContent>
            {PRESET_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">
                {t}
              </SelectItem>
            ))}
            {initial && !PRESET_TYPES.some((t) => t.toLowerCase() === initial.toLowerCase()) && (
              <SelectItem value="__custom__" className="text-xs italic">
                {initial} (current)
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        {saving && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
      <Button size="sm" variant="outline" onClick={onScrollToLinks} className="h-8">
        <Link2 className="h-3.5 w-3.5 mr-1.5" />
        Link contracts
      </Button>
    </div>
  );
};

export default ContractDetailSubHeader;
