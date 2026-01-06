import { useState } from 'react';
import { AlertTriangle, Mail, PlayCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface EmailDeliveryWarningProps {
  status: string | null | undefined;
  bounceReason?: string | null;
  bounceCount?: number;
  onUpdateEmail?: () => void;
  onResumeOutreach?: () => Promise<void>;
  isResuming?: boolean;
}

export function EmailDeliveryWarning({ 
  status, 
  bounceReason, 
  bounceCount,
  onUpdateEmail,
  onResumeOutreach,
  isResuming = false
}: EmailDeliveryWarningProps) {
  if (!status || (status !== 'bounced' && status !== 'complained')) {
    return null;
  }

  const isBounced = status === 'bounced';
  const isComplained = status === 'complained';

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        {isBounced ? '📧 Email Delivery Issue' : '⚠️ Spam Complaint'}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-2">
          {isBounced && (
            <>
              <p>
                <strong>Email bounced:</strong> {bounceReason || 'Mailbox does not exist or is unavailable'}
              </p>
              {bounceCount && bounceCount > 1 && (
                <p className="text-sm opacity-80">
                  This email has bounced {bounceCount} times.
                </p>
              )}
              <p>
                Outreach is <strong>PAUSED</strong> until the email address is corrected.
              </p>
            </>
          )}
          {isComplained && (
            <>
              <p>
                The recipient marked your email as spam.
              </p>
              <p>
                All outreach has been <strong>STOPPED</strong> to protect your sender reputation.
              </p>
            </>
          )}
          
          {isBounced && (
            <div className="flex flex-wrap gap-2 mt-3">
              {onUpdateEmail && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onUpdateEmail}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Update Email Address
                </Button>
              )}
              {onResumeOutreach && (
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={onResumeOutreach}
                  disabled={isResuming}
                >
                  {isResuming ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PlayCircle className="h-4 w-4 mr-2" />
                  )}
                  {isResuming ? 'Resuming...' : 'Resume Outreach'}
                </Button>
              )}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
