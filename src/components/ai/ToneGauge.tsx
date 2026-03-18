import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toneIntensityModifiers } from "@/lib/personaTones";
import { cn } from "@/lib/utils";

interface ToneGaugeProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export const ToneGauge = ({ value, onChange, className }: ToneGaugeProps) => {
  const currentModifier = toneIntensityModifiers[value];
  
  const getColorClass = (val: number) => {
    switch (val) {
      case 1: return "text-emerald-500";
      case 2: return "text-green-500";
      case 3: return "text-amber-500";
      case 4: return "text-orange-500";
      case 5: return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Tone Intensity</Label>
        <span className={cn("text-sm font-semibold", getColorClass(value))}>
          {currentModifier?.label || "Standard"}
        </span>
      </div>
      
      <Slider
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
        min={1}
        max={5}
        step={1}
        className="w-full"
      />
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Softer</span>
        <span>Standard</span>
        <span>Firmer</span>
      </div>
    </div>
  );
};
