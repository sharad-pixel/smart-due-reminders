import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Reusable empty state component for tables, lists, and panels.
 * Replaces the repeated pattern of centered icon + text across the codebase.
 */
export function EmptyState({ icon: Icon, title, description, children, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-8 text-muted-foreground', className)}>
      {Icon && <Icon className="h-8 w-8 mx-auto mb-2 opacity-50" />}
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm mt-1">{description}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
