import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface LeadTableFiltersProps {
  // Status filter
  statusFilter: string;
  onStatusChange: (value: string) => void;
  statusOptions: FilterOption[];
  
  // Score filter
  scoreFilter: string;
  onScoreChange: (value: string) => void;
  
  // Campaign filter
  campaignFilter: string;
  onCampaignChange: (value: string) => void;
  campaignOptions: FilterOption[];
  
  // Stage filter
  stageFilter: string;
  onStageChange: (value: string) => void;
  stageOptions: FilterOption[];
  
  // Industry filter
  industryFilter: string;
  onIndustryChange: (value: string) => void;
  industryOptions: FilterOption[];
  
  // Clear all
  hasActiveFilters: boolean;
  onClearAll: () => void;
}

const scoreOptions: FilterOption[] = [
  { value: "all", label: "All Scores" },
  { value: "hot", label: "Hot (80+)" },
  { value: "warm", label: "Warm (50-79)" },
  { value: "cold", label: "Cold (0-49)" },
];

export function LeadTableFilters({
  statusFilter,
  onStatusChange,
  statusOptions,
  scoreFilter,
  onScoreChange,
  campaignFilter,
  onCampaignChange,
  campaignOptions,
  stageFilter,
  onStageChange,
  stageOptions,
  industryFilter,
  onIndustryChange,
  industryOptions,
  hasActiveFilters,
  onClearAll,
}: LeadTableFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Score Filter */}
      <Select value={scoreFilter} onValueChange={onScoreChange}>
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Score" />
        </SelectTrigger>
        <SelectContent>
          {scoreOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Campaign Filter */}
      <Select value={campaignFilter} onValueChange={onCampaignChange}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue placeholder="Campaign" />
        </SelectTrigger>
        <SelectContent>
          {campaignOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Stage Filter */}
      <Select value={stageFilter} onValueChange={onStageChange}>
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          {stageOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Industry Filter */}
      <Select value={industryFilter} onValueChange={onIndustryChange}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder="Industry" />
        </SelectTrigger>
        <SelectContent>
          {industryOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3 mr-1" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
