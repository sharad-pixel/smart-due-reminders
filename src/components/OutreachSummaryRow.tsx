import { Mail, MessageSquare, ChevronRight, FileText, Building } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OutreachSummaryRowProps {
  channel: string;
  subject: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string;
  activityType?: string;
  invoiceNumber?: string | null;
  invoiceAmount?: number | null;
  onClick: () => void;
  className?: string;
}

export const OutreachSummaryRow = ({
  channel,
  subject,
  status,
  sentAt,
  createdAt,
  activityType,
  invoiceNumber,
  invoiceAmount,
  onClick,
  className
}: OutreachSummaryRowProps) => {
  const isAccountLevel = activityType === 'account_level_outreach';
  const displayDate = sentAt || createdAt;

  const truncateSubject = (text: string | null, maxLength: number = 50) => {
    if (!text) return "No subject";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors",
        isAccountLevel && "border-l-4 border-l-purple-500",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`p-2 rounded-full shrink-0 ${
          isAccountLevel
            ? 'bg-purple-100 text-purple-600'
            : status === 'sent' 
              ? 'bg-green-100 text-green-600' 
              : status === 'failed' 
                ? 'bg-red-100 text-red-600' 
                : 'bg-yellow-100 text-yellow-600'
        }`}>
          {channel === 'email' ? (
            <Mail className="h-4 w-4" />
          ) : (
            <MessageSquare className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">
              {truncateSubject(subject)}
            </p>
            {isAccountLevel && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs shrink-0">
                Account
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {displayDate ? new Date(displayDate).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : "Not sent"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {invoiceNumber && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span className="font-mono">{invoiceNumber}</span>
            {invoiceAmount !== null && invoiceAmount !== undefined && (
              <>
                <span className="mx-1">•</span>
                <span>${invoiceAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </>
            )}
          </div>
        )}
        {isAccountLevel && !invoiceNumber && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-purple-600">
            <Building className="h-3 w-3" />
            <span>Summary</span>
          </div>
        )}
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          status === "sent"
            ? "bg-green-100 text-green-700"
            : status === "failed"
            ? "bg-red-100 text-red-700"
            : "bg-yellow-100 text-yellow-700"
        }`}>
          {status}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
};
