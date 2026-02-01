import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LeadSegmentFilterProps {
  activeSegment: string;
  onSegmentChange: (segment: string) => void;
  counts: {
    all: number;
    new: number;
    engaged: number;
    hot: number;
    cold: number;
    converted: number;
  };
}

const segments = [
  { id: "all", label: "All Leads", color: "bg-slate-500" },
  { id: "new", label: "New", color: "bg-blue-500" },
  { id: "engaged", label: "Engaged", color: "bg-green-500" },
  { id: "hot", label: "Hot", color: "bg-orange-500" },
  { id: "cold", label: "Cold", color: "bg-slate-400" },
  { id: "converted", label: "Converted", color: "bg-emerald-500" },
];

export const LeadSegmentFilter = ({
  activeSegment,
  onSegmentChange,
  counts,
}: LeadSegmentFilterProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      {segments.map((segment) => (
        <Button
          key={segment.id}
          variant={activeSegment === segment.id ? "default" : "outline"}
          size="sm"
          onClick={() => onSegmentChange(segment.id)}
          className={cn(
            "transition-all",
            activeSegment === segment.id && "shadow-md"
          )}
        >
          <span
            className={cn(
              "w-2 h-2 rounded-full mr-2",
              segment.color
            )}
          />
          {segment.label}
          <Badge
            variant="secondary"
            className="ml-2 text-xs"
          >
            {counts[segment.id as keyof typeof counts] || 0}
          </Badge>
        </Button>
      ))}
    </div>
  );
};
