import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export interface ParsedAddress {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

interface AddressSuggestion {
  id: string;
  description: string;
  feature?: any; // For Mapbox features
}

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelected: (address: ParsedAddress) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const AddressAutocompleteInput = ({
  value,
  onChange,
  onAddressSelected,
  placeholder = "Start typing an address...",
  disabled = false,
  className,
}: AddressAutocompleteInputProps) => {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const { toast } = useToast();
  const debounceTimer = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (query: string) => {
    if (query.length < 3 || manualMode) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('address-autocomplete', {
        body: { query, action: 'search' },
      });

      if (error) {
        if (error.message.includes('not enabled') || error.message.includes('not configured')) {
          setManualMode(true);
          return;
        }
        throw error;
      }

      setSuggestions(data.suggestions || []);
      setShowSuggestions(true);
    } catch (error: any) {
      console.error('Failed to fetch address suggestions:', error);
      toast({
        title: "Address suggestions unavailable",
        description: "You can still enter the address manually.",
        variant: "destructive",
      });
      setManualMode(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (newValue: string) => {
    onChange(newValue);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  const handleSuggestionClick = async (suggestion: AddressSuggestion) => {
    setShowSuggestions(false);
    setIsLoading(true);

    try {
      // For Mapbox, we already have the feature with full details
      // For Google Places, we need to fetch place details
      const payload = suggestion.feature
        ? { query: JSON.stringify(suggestion.feature), action: 'details' }
        : { query: suggestion.id, action: 'details' };

      const { data, error } = await supabase.functions.invoke('address-autocomplete', {
        body: payload,
      });

      if (error) throw error;

      if (data.parsedAddress) {
        onChange(data.parsedAddress.address_line1);
        onAddressSelected(data.parsedAddress);
        toast({
          title: "Address populated",
          description: "Please review and complete any missing fields.",
        });
      }
    } catch (error: any) {
      console.error('Failed to get address details:', error);
      toast({
        title: "Failed to load address details",
        description: "Please enter the address manually.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="px-4 py-2 hover:bg-accent cursor-pointer text-sm"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion.description}
            </div>
          ))}
        </div>
      )}

      {!manualMode && (
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Start typing to see address suggestions</span>
          <button
            type="button"
            onClick={() => setManualMode(true)}
            className="text-primary hover:underline"
          >
            Enter manually
          </button>
        </div>
      )}

      {manualMode && (
        <div className="mt-1 text-xs text-muted-foreground">
          Manual entry mode
          <button
            type="button"
            onClick={() => setManualMode(false)}
            className="ml-2 text-primary hover:underline"
          >
            Enable autocomplete
          </button>
        </div>
      )}
    </div>
  );
};
