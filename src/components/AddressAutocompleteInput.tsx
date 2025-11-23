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
        // Check if autocomplete is not enabled or configured
        const errorMsg = error.message || JSON.stringify(error);
        if (errorMsg.includes('not enabled') || errorMsg.includes('not configured')) {
          setManualMode(true);
          setSuggestions([]);
          return;
        }
        throw error;
      }

      // Check if response has an error property (when function returns 400)
      if (data?.error) {
        if (data.error.includes('not enabled') || data.error.includes('not configured')) {
          setManualMode(true);
          setSuggestions([]);
          return;
        }
      }

      setSuggestions(data?.suggestions || []);
      if (data?.suggestions && data.suggestions.length > 0) {
        setShowSuggestions(true);
      }
    } catch (error: any) {
      console.error('Failed to fetch address suggestions:', error);
      setManualMode(true);
      setSuggestions([]);
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

      if (error) {
        console.error('Failed to get address details:', error);
        setManualMode(true);
        return;
      }

      // Check for error in response data
      if (data?.error) {
        console.error('Address details error:', data.error);
        setManualMode(true);
        return;
      }

      if (data?.parsedAddress) {
        onChange(data.parsedAddress.address_line1);
        onAddressSelected(data.parsedAddress);
        toast({
          title: "Address populated",
          description: "Please review and complete any missing fields.",
        });
      }
    } catch (error: any) {
      console.error('Failed to get address details:', error);
      setManualMode(true);
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
          <span>Start typing to see address suggestions or</span>
          <button
            type="button"
            onClick={() => setManualMode(true)}
            className="text-primary hover:underline"
          >
            enter manually
          </button>
        </div>
      )}

      {manualMode && (
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Manual entry mode.</span>
          <button
            type="button"
            onClick={() => setManualMode(false)}
            className="text-primary hover:underline"
          >
            Try autocomplete
          </button>
        </div>
      )}
    </div>
  );
};
