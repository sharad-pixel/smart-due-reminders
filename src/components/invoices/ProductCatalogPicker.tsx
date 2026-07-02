import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { BookOpen, Trash2 } from "lucide-react";
import { useProductCatalog, ProductCatalogItem } from "@/hooks/useProductCatalog";

interface ProductCatalogPickerProps {
  onSelect: (item: ProductCatalogItem) => void;
  disabled?: boolean;
}

export const ProductCatalogPicker = ({ onSelect, disabled }: ProductCatalogPickerProps) => {
  const [open, setOpen] = useState(false);
  const { list, remove } = useProductCatalog();
  const items = (list.data || []).filter((i) => i.active !== false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={disabled}>
          <BookOpen className="h-4 w-4 mr-1" />
          Add from catalog
          {items.length > 0 && (
            <span className="ml-1.5 text-xs text-muted-foreground">({items.length})</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search saved products..." />
          <CommandList>
            <CommandEmpty>
              <div className="py-6 text-center text-sm text-muted-foreground px-4">
                No saved products yet.
                <div className="mt-1 text-xs">
                  Save any line item using the bookmark icon to reuse it later.
                </div>
              </div>
            </CommandEmpty>
            <CommandGroup heading="Your products">
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.description} ${item.unit_type}`}
                  onSelect={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.currency} {Number(item.unit_cost).toFixed(2)} / {item.unit_type}
                      {item.times_used > 0 && ` · used ${item.times_used}×`}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove.mutate(item.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
