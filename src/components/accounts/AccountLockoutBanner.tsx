import { AlertTriangle, Mail, CreditCard } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface AccountLockoutBannerProps {
  lockoutReason: 'past_due' | 'expired' | 'canceled' | 'locked';
  isTeamMember?: boolean;
  ownerEmail?: string | null;
  ownerName?: string | null;
}

export function AccountLockoutBanner({
  lockoutReason,
  isTeamMember = false,
  ownerEmail,
  ownerName,
}: AccountLockoutBannerProps) {
  const navigate = useNavigate();

  const getReasonText = () => {
    switch (lockoutReason) {
      case 'past_due':
        return {
          title: 'Payment Past Due',
          description: isTeamMember 
            ? 'The parent account has a past due payment. Some features may be restricted.'
            : 'Your payment is past due. Please update your payment method to restore full access.',
        };
      case 'expired':
        return {
          title: 'Subscription Expired',
          description: isTeamMember
            ? 'The parent account subscription has expired. Some features may be restricted.'
            : 'Your subscription has expired. Renew now to continue using all features.',
        };
      case 'canceled':
        return {
          title: 'Subscription Canceled',
          description: isTeamMember
            ? 'The parent account subscription has been canceled. Some features may be restricted.'
            : 'Your subscription has been canceled. Reactivate to restore access.',
        };
      case 'locked':
        return {
          title: 'Account Locked',
          description: isTeamMember
            ? 'The parent account has been locked. Please contact the account owner.'
            : 'Your account has been locked. Please contact support for assistance.',
        };
      default:
        return {
          title: 'Access Restricted',
          description: 'Your access has been restricted. Please resolve the subscription issue.',
        };
    }
  };

  const { title, description } = getReasonText();

  const handleContactOwner = () => {
    if (!ownerEmail) return;
    
    const subject = encodeURIComponent(`URGENT: Account Access Issue - ${title} on Recouply.ai`);
    const body = encodeURIComponent(
`Hello ${ownerName || 'Admin'},

I'm a team member on your Recouply.ai account and some features are restricted.

Issue: ${title}

To restore full access, please visit: https://smart-due-reminders.lovable.app/upgrade

Thank you for your prompt attention to this matter.

Best regards`
    );
    window.location.href = `mailto:${ownerEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <Alert variant="destructive" className="mb-4 border-destructive/50 bg-destructive/10">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="font-semibold">{title}</AlertTitle>
      <AlertDescription className="mt-1">
        <span className="block mb-3">{description}</span>
        <div className="flex flex-wrap gap-2">
          {isTeamMember ? (
            ownerEmail && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleContactOwner}
                className="border-destructive/30 hover:bg-destructive/20"
              >
                <Mail className="mr-2 h-3 w-3" />
                Contact Account Owner
              </Button>
            )
          ) : (
            <Button 
              size="sm" 
              onClick={() => navigate('/billing')}
              className="bg-destructive hover:bg-destructive/90"
            >
              <CreditCard className="mr-2 h-3 w-3" />
              {lockoutReason === 'past_due' ? 'Update Payment' : 'Renew Subscription'}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
