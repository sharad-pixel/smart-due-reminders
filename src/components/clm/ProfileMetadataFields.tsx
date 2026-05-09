import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBusinessProfile, BusinessProfileId } from "@/lib/clm/businessProfiles";

interface Props {
  profile: BusinessProfileId;
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  /** Optionally limit to a subset of fields */
  only?: string[];
}

export const ProfileMetadataFields = ({ profile, value, onChange, only }: Props) => {
  const def = getBusinessProfile(profile);
  const fields = only ? def.fields.filter((f) => only.includes(f.key)) : def.fields;
  const set = (k: string, v: any) => onChange({ ...value, [k]: v });

  if (fields.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fields.map((f) => {
        const v = value?.[f.key];
        if (f.type === "boolean") {
          return (
            <div key={f.key} className="flex items-center justify-between rounded border p-2">
              <Label className="text-xs font-medium" htmlFor={`pm-${f.key}`}>{f.label}</Label>
              <Switch id={`pm-${f.key}`} checked={!!v} onCheckedChange={(c) => set(f.key, c)} />
            </div>
          );
        }
        if (f.type === "select") {
          return (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs font-medium">{f.label}</Label>
              <Select value={v ?? ""} onValueChange={(val) => set(f.key, val)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {f.options?.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }
        const inputType = f.type === "number" || f.type === "currency" ? "number" : "text";
        return (
          <div key={f.key} className="space-y-1">
            <Label className="text-xs font-medium">{f.label}</Label>
            <Input
              type={inputType}
              value={v ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder ?? (f.type === "currency" ? "$" : "")}
            />
            
            {f.helper && <p className="text-[10px] text-muted-foreground">{f.helper}</p>}
          </div>
        );
      })}
    </div>
  );
};
