import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useState } from 'react';
import { groupSyncErrors, getErrorTypeLabel, type GroupedErrors } from './syncErrorParser';

interface SyncErrorBannerProps {
  errors: any[] | null | undefined;
  objectType?: string; // e.g. "invoices", "customers"
  onViewDetails?: () => void;
}

export const SyncErrorBanner = ({ errors, objectType = 'records', onViewDetails }: SyncErrorBannerProps) => {
  const [expanded, setExpanded] = useState(false);
  
  const grouped = groupSyncErrors(errors);
  
  if (!grouped || grouped.totalCount === 0) {
    return null;
  }

  return (
    <Alert variant="default" className="border-amber-200 bg-amber-50/50">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 text-sm font-medium">
        Sync issues detected
      </AlertTitle>
      <AlertDescription className="text-amber-700">
        <p className="text-sm mb-2">
          {grouped.totalCount} {objectType} failed to sync:
        </p>
        
        <ul className="space-y-2 text-sm mb-2">
          {grouped.groups.slice(0, expanded ? undefined : 2).map((group, i) => (
            <li key={i} className="border-l-2 border-amber-300 pl-2">
              <div className="flex items-start gap-1">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-medium">{group.message}</span>
                  {group.count > 1 && (
                    <span className="text-amber-600"> ({group.count}x)</span>
                  )}
                  {group.remedy && (
                    <p className="text-xs text-amber-600/80 mt-0.5">
                      💡 {group.remedy}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {grouped.groups.length > 2 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-100"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show {grouped.groups.length - 2} more issue types
              </>
            )}
          </Button>
        )}

        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-200">
          <Info className="h-3 w-3 text-amber-600" />
          <span className="text-xs text-amber-600">
            This does not affect successfully synced {objectType}.
          </span>
          {onViewDetails && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-amber-700 underline"
              onClick={onViewDetails}
            >
              View full details
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default SyncErrorBanner;