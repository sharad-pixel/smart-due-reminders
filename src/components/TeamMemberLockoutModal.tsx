import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Mail, User, Building2, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface TeamMemberLockoutModalProps {
  open: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerCompanyName: string | null;
  lockoutReason: 'past_due' | 'expired' | 'canceled' | 'locked';
}

export function TeamMemberLockoutModal({
  open,
  ownerName,
  ownerEmail,
  ownerCompanyName,
  lockoutReason,
}: TeamMemberLockoutModalProps) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const getReasonTitle = () => {
    switch (lockoutReason) {
      case 'past_due':
        return 'Payment Past Due';
      case 'expired':
        return 'Subscription Expired';
      case 'canceled':
        return 'Subscription Canceled';
      case 'locked':
        return 'Account Locked';
      default:
        return 'Access Restricted';
    }
  };

  const getReasonDescription = () => {
    switch (lockoutReason) {
      case 'past_due':
        return 'The parent account has a past due payment. Access has been temporarily restricted until the payment issue is resolved.';
      case 'expired':
        return 'The parent account subscription has expired. Access has been restricted until the subscription is renewed.';
      case 'canceled':
        return 'The parent account subscription has been canceled. Access has been restricted until a new subscription is activated.';
      case 'locked':
        return 'The parent account has been locked. Please contact the account owner to restore access.';
      default:
        return 'Your access has been restricted. Please contact the account owner for assistance.';
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-xl">
              {getReasonTitle()}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base text-foreground/80">
            {getReasonDescription()}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 p-4 bg-muted rounded-lg space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            Please contact your account administrator to resolve this issue:
          </p>
          
          <div className="space-y-2">
            {ownerCompanyName && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{ownerCompanyName}</span>
              </div>
            )}
            {ownerName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{ownerName}</span>
              </div>
            )}
            {ownerEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a 
                  href={`mailto:${ownerEmail}?subject=Account Access Issue`}
                  className="text-primary hover:underline"
                >
                  {ownerEmail}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {ownerEmail && (
            <Button 
              variant="default"
              onClick={() => window.location.href = `mailto:${ownerEmail}?subject=Account Access Issue - ${getReasonTitle()}&body=Hello ${ownerName || 'Admin'},%0D%0A%0D%0AI'm a team member on your Recouply account and currently unable to access the platform due to: ${getReasonTitle()}.%0D%0A%0D%0ACould you please help resolve this issue?%0D%0A%0D%0AThank you!`}
            >
              <Mail className="mr-2 h-4 w-4" />
              Contact Account Owner
            </Button>
          )}
          <Button 
            variant="outline"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
