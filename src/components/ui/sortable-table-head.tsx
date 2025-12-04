import { useState, useMemo } from "react";
import { TableHead } from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc" | null;

interface SortableTableHeadProps {
  children: React.ReactNode;
  sortKey: string;
  currentSortKey: string | null;
  currentSortDirection: SortDirection;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableTableHead({
  children,
  sortKey,
  currentSortKey,
  currentSortDirection,
  onSort,
  className,
}: SortableTableHeadProps) {
  const isActive = currentSortKey === sortKey;

  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:bg-muted/50 transition-colors", className)}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {children}
        {isActive ? (
          currentSortDirection === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </div>
    </TableHead>
  );
}

export function useSorting<T>(
  data: T[],
  initialKey: string | null = null,
  initialDirection: SortDirection = null
) {
  const [sortKey, setSortKey] = useState<string | null>(initialKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialDirection);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortKey(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aValue = getNestedValue(a, sortKey);
      const bValue = getNestedValue(b, sortKey);

      if (aValue === null || aValue === undefined) return sortDirection === "asc" ? 1 : -1;
      if (bValue === null || bValue === undefined) return sortDirection === "asc" ? -1 : 1;

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }, [data, sortKey, sortDirection]);

  return { sortedData, sortKey, sortDirection, handleSort };
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}
