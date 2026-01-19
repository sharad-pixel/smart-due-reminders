import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { RecouplyLogo } from '@/components/RecouplyLogo';

export default function EmailVerificationRequired() {
  const navigate = useNavigate();
  const [isResending, setIsResending] = useState(false);

  const handleResendVerification = async () => {
    setIsResending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Session expired. Please log in again.');
        navigate('/login');
        return;
      }

      const { data, error } = await supabase.functions.invoke('send-verification-email', {
        body: { email: user.email, userId: user.id, resend: true }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'Failed to resend verification email');
        return;
      }

      toast.success('Verification email sent! Please check your inbox.');
    } catch (err) {
      console.error('Resend error:', err);
      toast.error('Failed to resend verification email');
    } finally {
      setIsResending(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <RecouplyLogo size="lg" />
          </div>
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription>
            Please verify your email address to access Recouply.ai
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="text-foreground font-medium">Check Your Email</p>
              <p className="text-muted-foreground text-sm">
                We've sent a verification link to your email address. 
                Click the link in the email to verify your account and access the platform.
              </p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p>Didn't receive the email? Check your spam folder or click below to resend.</p>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <Button 
              onClick={handleResendVerification} 
              disabled={isResending}
              className="w-full"
            >
              {isResending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Resend Verification Email
                </>
              )}
            </Button>
            <Button 
              onClick={handleSignOut} 
              variant="outline"
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
