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

  // Check if all errors are "fixed" types that can be resolved by re-running sync
  const fixableTypes = ['unsupported_status', 'invoice_status_error', 'contact_error', 'constraint_error'];
  const allFixable = grouped.groups.every(g => fixableTypes.includes(g.type));

  return (
    <Alert variant="default" className={allFixable ? "border-blue-200 bg-blue-50/50" : "border-amber-200 bg-amber-50/50"}>
      <AlertTriangle className={`h-4 w-4 ${allFixable ? 'text-blue-600' : 'text-amber-600'}`} />
      <AlertTitle className={`text-sm font-medium ${allFixable ? 'text-blue-800' : 'text-amber-800'}`}>
        {allFixable ? 'Previous sync had issues (now fixed)' : 'Sync issues detected'}
      </AlertTitle>
      <AlertDescription className={allFixable ? 'text-blue-700' : 'text-amber-700'}>
        <p className="text-sm mb-2">
          {grouped.totalCount} {objectType} {allFixable ? 'had issues in last sync' : 'failed to sync'}:
        </p>
        
        <ul className="space-y-2 text-sm mb-2">
          {grouped.groups.slice(0, expanded ? undefined : 2).map((group, i) => (
            <li key={i} className={`border-l-2 pl-2 ${allFixable ? 'border-blue-300' : 'border-amber-300'}`}>
              <div className="flex items-start gap-1">
                <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${allFixable ? 'text-blue-600' : 'text-amber-600'}`} />
                <div>
                  <span className="font-medium">{group.message}</span>
                  {group.count > 1 && (
                    <span className={allFixable ? 'text-blue-600' : 'text-amber-600'}> ({group.count}x)</span>
                  )}
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
              : `This does not affect successfully synced ${objectType}.`
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