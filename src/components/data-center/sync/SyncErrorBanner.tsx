import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronDown, ChevronUp, Info, X, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { groupSyncErrors, getErrorTypeLabel, type GroupedErrors } from './syncErrorParser';

interface SyncErrorBannerProps {
  errors: any[] | null | undefined;
  dismissedErrors?: string[] | null;
  objectType?: string; // e.g. "invoices", "customers"
  onViewDetails?: () => void;
  onDismissError?: (errorMessage: string) => void;
  onDismissAll?: () => void;
}

export const SyncErrorBanner = ({ 
  errors, 
  dismissedErrors = [],
  objectType = 'records', 
  onViewDetails,
  onDismissError,
  onDismissAll
}: SyncErrorBannerProps) => {
  const [expanded, setExpanded] = useState(false);
  
  // Filter out dismissed errors before grouping
  const activeErrors = errors?.filter(e => {
    const errorStr = typeof e === 'string' ? e : JSON.stringify(e);
    return !dismissedErrors?.includes(errorStr);
  });
  
  const grouped = groupSyncErrors(activeErrors);
  const totalDismissed = (errors?.length || 0) - (activeErrors?.length || 0);
  
  // Show nothing if all errors are dismissed
  if (!grouped || grouped.totalCount === 0) {
    if (totalDismissed > 0) {
      return (
        <Alert variant="default" className="border-green-200 bg-green-50/50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-sm font-medium text-green-800">
            All sync issues resolved
          </AlertTitle>
          <AlertDescription className="text-green-700">
            <p className="text-sm">
              {totalDismissed} issue{totalDismissed !== 1 ? 's' : ''} manually acknowledged. Next sync will show fresh results.
            </p>
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  }

  // Check if all errors are "fixed" types that can be resolved by re-running sync
  const fixableTypes = ['unsupported_status', 'invoice_status_error', 'contact_error', 'constraint_error'];
  const allFixable = grouped.groups.every(g => fixableTypes.includes(g.type));

  return (
    <Alert variant="default" className={allFixable ? "border-blue-200 bg-blue-50/50" : "border-amber-200 bg-amber-50/50"}>
      <AlertTriangle className={`h-4 w-4 ${allFixable ? 'text-blue-600' : 'text-amber-600'}`} />
      <AlertTitle className={`text-sm font-medium ${allFixable ? 'text-blue-800' : 'text-amber-800'} flex items-center justify-between`}>
        <span>{allFixable ? 'Previous sync had issues (now fixed)' : 'Sync issues detected'}</span>
        {onDismissAll && grouped.totalCount > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-2 text-xs ${allFixable ? 'text-blue-700 hover:text-blue-800 hover:bg-blue-100' : 'text-amber-700 hover:text-amber-800 hover:bg-amber-100'}`}
            onClick={onDismissAll}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Dismiss all
          </Button>
        )}
      </AlertTitle>
      <AlertDescription className={allFixable ? 'text-blue-700' : 'text-amber-700'}>
        <p className="text-sm mb-2">
          {grouped.totalCount} {objectType} {allFixable ? 'had issues in last sync' : 'failed to sync'}
          {totalDismissed > 0 && <span className="text-green-600"> ({totalDismissed} dismissed)</span>}:
        </p>
        
        <ul className="space-y-2 text-sm mb-2">
          {grouped.groups.slice(0, expanded ? undefined : 2).map((group, i) => (
            <li key={i} className={`border-l-2 pl-2 ${allFixable ? 'border-blue-300' : 'border-amber-300'}`}>
              <div className="flex items-start gap-1">
                <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${allFixable ? 'text-blue-600' : 'text-amber-600'}`} />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-medium">{group.message}</span>
                      {group.count > 1 && (
                        <span className={allFixable ? 'text-blue-600' : 'text-amber-600'}> ({group.count}x)</span>
                      )}
                    </div>
                    {onDismissError && group.details && group.details.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-5 w-5 p-0 shrink-0 ${allFixable ? 'text-blue-600 hover:text-blue-800 hover:bg-blue-100' : 'text-amber-600 hover:text-amber-800 hover:bg-amber-100'}`}
                        onClick={() => {
                          // Dismiss all errors in this group
                          group.details?.forEach(detail => onDismissError(detail));
                        }}
                        title="Mark as resolved (aligned with source system)"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {group.remedy && (
                    <p className={`text-xs mt-0.5 ${allFixable ? 'text-blue-600/80' : 'text-amber-600/80'}`}>
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
            className={`h-6 px-2 text-xs ${allFixable ? 'text-blue-700 hover:text-blue-800 hover:bg-blue-100' : 'text-amber-700 hover:text-amber-800 hover:bg-amber-100'}`}
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

        <div className={`flex items-center gap-2 mt-2 pt-2 border-t ${allFixable ? 'border-blue-200' : 'border-amber-200'}`}>
          <Info className={`h-3 w-3 ${allFixable ? 'text-blue-600' : 'text-amber-600'}`} />
          <span className={`text-xs ${allFixable ? 'text-blue-600' : 'text-amber-600'}`}>
            {allFixable 
              ? 'These issues have been fixed. Re-run sync to resolve them.'
              : `Click ✕ to mark issues as aligned with source system.`
            }
          </span>
          {onViewDetails && (
            <Button
              variant="link"
              size="sm"
              className={`h-auto p-0 text-xs underline ${allFixable ? 'text-blue-700' : 'text-amber-700'}`}
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